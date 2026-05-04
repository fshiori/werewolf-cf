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
curl -i http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/version
curl -i http://127.0.0.1:8787/
```

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
- `POST /api/assets/avatar`: Upload an image avatar to R2.
- `DELETE /api/assets/avatar`: Remove the current player's avatar from R2.
- `GET /assets/avatar/:playerId`: Read a player's avatar.

## Deployment

Run the same checks used for local development:

```bash
npm test
npm run typecheck
git diff --check
```

Apply remote D1 migrations before deploying code that depends on new columns or tables:

```bash
npx wrangler d1 migrations apply werewolf-cf --remote
```

Deploy:

```bash
npm run deploy
```

After deploy, smoke check the production Worker:

```bash
curl -i https://<worker-host>/api/health
curl -i https://<worker-host>/api/version
curl -i https://<worker-host>/api/config
```

`/api/health` should return HTTP 200 with `ok: true`. `/api/version` should return the expected `appVersion` and bindings list. If `maintenance_mode` is set to `true` in KV, new room creation is blocked with HTTP 503 while existing rooms and read APIs remain available.
