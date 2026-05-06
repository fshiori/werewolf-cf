# werewolf-cf

Cloudflare Workers port of the Werewolf game.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```

Check local Cloudflare binding configuration:

```bash
npm run check:wrangler
```

Start local Worker:

```bash
npm run dev
```

Apply local D1 migrations before local smoke testing:

```bash
npx wrangler d1 migrations apply werewolf-cf --local
```

Smoke check the local Worker:

```bash
npm run smoke:local
npm run smoke:local:write
```

The read-only smoke checks local Worker metadata and HTML pages at `http://127.0.0.1:8787`. The write smoke creates a temporary local room, verifies WebSocket join, and checks avatar upload/read/delete against the local R2 binding.

Run production smoke checks after deployment:

```bash
export WORKER_HOST="https://<worker-host>"
npm run smoke:production -- "$WORKER_HOST"
npm run smoke:production:write -- "$WORKER_HOST" --yes
```

The write smoke creates temporary room/player/avatar data, so run it only when production writes are acceptable. It deletes the smoke avatar on the success path and attempts best-effort avatar cleanup after upload failures; smoke room/player rows remain in D1.

## Cloudflare Bindings

The Worker expects these bindings from `wrangler.toml`:

- `ROOM_DO`: Durable Object namespace for per-room live state and WebSockets.
- `DB`: D1 database for rooms, player stats, game records, Trip registry, and audit events.
- `ASSETS`: R2 bucket for uploaded avatar assets.
- `CONFIG`: KV namespace for runtime configuration such as `home_announcement` and `maintenance_mode`.

## HTTP API

Runtime and public metadata:

- `GET /api/health`: Worker, D1, KV, Durable Object, and R2 binding health.
- `GET /api/version`: Application version, runtime, bindings, and capability metadata.
- `GET /api/protocol`: Machine-readable WebSocket route, message, and private-channel metadata.
- `GET /api/config`: Public runtime config summary.

Rooms and records:

- `GET /api/rooms`: List recent rooms.
- `GET /api/rooms/:roomId`: Room summary and option metadata.
- `POST /api/rooms`: Create a room unless `maintenance_mode=true`.
- `GET /api/rooms/:roomId/records`: Recent game records for a room.
- `GET /api/rooms/:roomId/events`: Recent room audit events.

Players and stats:

- `GET /api/stats/leaderboard`: Aggregated leaderboard.
- `GET /api/players/:playerId/stats`: Player stats, aggregated by claimed Trip when present.
- `GET /api/players/:playerId/records`: Player game history, aggregated by claimed Trip when present.

Trip and avatar management:

- `POST /api/trips`: Register a Trip identity.
- `POST /api/trips/claim`: Claim a registered Trip for a local player identity.
- `POST /api/trips/exclusions`: Exclude a Trip from Trip-limited rooms.
- `DELETE /api/trips/exclusions`: Remove a Trip exclusion.
- `POST /api/assets/avatar`: Upload a PNG, JPEG, GIF, or WebP avatar to R2, up to 512 KiB.
- `DELETE /api/assets/avatar`: Remove the current player's avatar from R2.
- `GET /assets/avatar/:playerId`: Read a player's avatar.

## WebSocket Protocol

Room WebSockets connect through the room Durable Object. The client opens:

```text
GET /ws/room/:roomId
Upgrade: websocket
```

Every frame is a JSON object with a `type` string. The first client frame must be `join`; every other command returns an `error` server message until the socket has joined.

Client messages:

- `join`: `{ "type": "join", "playerId": "player_...", "nickname": "...", "trip": "Abc123", "wishRole": "seer" }`. `trip` is required only for Trip-limited rooms. `wishRole` is used only when wished roles are enabled.
- `chat`: public chat, `{ "type": "chat", "text": "..." }`. During the game, only living players and GM may use it.
- `wolf_chat`, `fox_chat`, `common_chat`, `lovers_chat`: private night channels for living members of the matching side or pair.
- `dead_chat`: private dead-player chat during an active game.
- `set_last_words`: `{ "type": "set_last_words", "text": "..." }`, available only when last words are enabled.
- `start_game`: room host or GM starts the game from lobby.
- `kick_player`: `{ "type": "kick_player", "targetPlayerId": "player_..." }`, lobby-only host or GM kick.
- `vote`: day vote, `{ "type": "vote", "targetPlayerId": "player_..." }`.
- `night_kill`: werewolf night action, `{ "type": "night_kill", "targetPlayerId": "player_..." }`.
- `divine`: seer night action, `{ "type": "divine", "targetPlayerId": "player_..." }`.
- `child_fox_divine`: child fox night action, `{ "type": "child_fox_divine", "targetPlayerId": "player_..." }`.
- `guard`: guard night action, `{ "type": "guard", "targetPlayerId": "player_..." }`.
- `cat_revive`: cat revive action, `{ "type": "cat_revive", "targetPlayerId": "player_..." }`.
- `gm_chat`: GM broadcast chat, `{ "type": "gm_chat", "text": "..." }`.
- `gm_whisper`: GM private message to one player, `{ "type": "gm_whisper", "targetPlayerId": "player_...", "text": "..." }`.
- `gm_advance_phase`: GM forces the current day or night phase to advance.
- `gm_end_game`: GM adjudicates a winner, `{ "type": "gm_end_game", "winner": "villagers" }`.
- `gm_set_alive`: GM changes life state, `{ "type": "gm_set_alive", "targetPlayerId": "player_...", "alive": true }`.
- `gm_set_role`: GM changes role, `{ "type": "gm_set_role", "targetPlayerId": "player_...", "role": "seer" }`.
- `gm_set_flag`: GM changes `authority`, `decider`, or `lover`, `{ "type": "gm_set_flag", "targetPlayerId": "player_...", "flag": "authority", "enabled": true }`.

Server messages:

- `joined`: confirms room id, player id, and current members.
- `presence`: current connected members, including `gm: true` for GM connections.
- `game_state`: public phase, day, players, vote visibility, winner, timer, and log state.
- `role`: sent privately after game start with the receiver's role and visible partners.
- `chat`, `wolf_chat`, `fox_chat`, `common_chat`, `lovers_chat`, `dead_chat`, `gm_chat`, `gm_whisper`: chat events with escaped nickname/text and `sentAt`. When `commonTalkVisible` is enabled, living non-common players and dead common partners receive the same `common_chat` event as an anonymous public voice with `playerId: "common_voice"` and nickname `共有者的聲音`.
- `action_ack`: confirms `vote`, `night_kill`, `guard`, `child_fox_divine`, `cat_revive`, or `kick_player`.
- `divination_result`, `child_fox_result`, `medium_result`: private role result messages.
- `revealed_roles`: sent to dead players when dead-role visibility is enabled, and to everyone after the game ends.
- `last_words_ack`: confirms saved last words.
- `error`: validation, permission, phase, or rule failure; the socket stays open unless a kick closes it.

Private channel delivery is enforced inside the Durable Object. Werewolf, fox, common, lovers, dead-player, GM-only, and GM-whisper messages are filtered per socket before sending.

## Deployment

Run the same checks used for local development:

```bash
npm run check:deploy
```

Apply remote D1 migrations before deploying code that depends on new columns or tables:

```bash
npx wrangler d1 migrations apply werewolf-cf --remote
npm run check:d1-schema:remote
```

Deploy:

```bash
npm run deploy
```

`npm run deploy` runs `npm run check:deploy` first and fails while production resource IDs still use `local-dev-placeholder`.

After deploy, smoke check the production Worker:

```bash
curl -i https://<worker-host>/api/health
curl -i https://<worker-host>/api/version
curl -i https://<worker-host>/api/protocol
curl -i https://<worker-host>/api/config
```

`/api/health` should return HTTP 200 with `ok: true`. `/api/version` should return the expected `appVersion` and bindings list. If `maintenance_mode` is set to `true` in KV, new room creation is blocked with HTTP 503 while existing rooms and read APIs remain available.

Use `docs/deployment-smoke.md` for the full production checklist, including remote D1 verification, automated read-only/write smoke checks, maintenance mode, and optional manual R2 avatar checks.
