# Deployment Smoke Checklist

Use this checklist after remote D1 migrations and every production deploy.

Set the deployed Worker URL first:

```bash
export WORKER_HOST="https://<worker-host>"
```

## Preflight

Run local gates before touching remote resources:

```bash
node --version
npm test
npm run typecheck
git diff --check
npm run check:wrangler -- --production
```

Expected:

- Node.js is `>=22.0.0`.
- Vitest passes.
- TypeScript typecheck passes.
- `git diff --check` prints no whitespace errors.
- `npm run check:wrangler -- --production` passes.

## Remote Resource Setup

If the production config check fails, confirm `wrangler.toml` has production resource IDs, not placeholders:

```bash
rg -n "local-dev-placeholder" wrangler.toml
```

Expected:

- No output for production deployment.

Apply remote D1 migrations:

```bash
npx wrangler d1 migrations apply werewolf-cf --remote
```

Confirm core D1 tables exist:

```bash
npx wrangler d1 execute werewolf-cf --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
```

Expected tables include:

- `rooms`
- `players`
- `player_stats`
- `game_records`
- `room_events`
- `registered_trips`
- `excluded_trips`

## Read-Only HTTP Smoke

These checks should not create rooms or write player data.

Run the automated read-only smoke first:

```bash
npm run smoke:production -- "$WORKER_HOST"
```

Or run the equivalent manual checks:

```bash
curl -fsS "$WORKER_HOST/api/health"
curl -fsS "$WORKER_HOST/api/version"
curl -fsS "$WORKER_HOST/api/protocol"
curl -fsS "$WORKER_HOST/api/config"
curl -fsS "$WORKER_HOST/api/rooms"
curl -fsS "$WORKER_HOST/"
curl -fsS "$WORKER_HOST/rules"
curl -fsS "$WORKER_HOST/protocol"
curl -fsS "$WORKER_HOST/version"
```

Expected:

- `/api/health` returns `ok: true`.
- `/api/version` lists `ROOM_DO`, `DB`, `ASSETS`, and `CONFIG`.
- `/api/version` capabilities include `websocket_protocol`.
- `/api/protocol` returns `path: "/ws/room/:roomId"` and `firstClientMessage: "join"`.
- `/api/config` returns `maintenanceMode`.
- HTML pages return `200 OK`.

## WebSocket Upgrade Smoke

Create a short-lived smoke room only when production writes are acceptable:

```bash
ROOM_ID="$(curl -fsS -X POST "$WORKER_HOST/api/rooms" \
  -H "content-type: application/json" \
  --data '{"name":"Smoke","comment":"deployment smoke","maxPlayers":8,"playerId":"player_smoke_host","nickname":"SmokeHost","options":{"realTime":true,"dayMinutes":1,"nightMinutes":1}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).roomId))')"
curl -fsS "$WORKER_HOST/api/rooms/$ROOM_ID"
```

Expected:

- `POST /api/rooms` returns a room id.
- `GET /api/rooms/:roomId` returns the smoke room summary.

Use a WebSocket client to verify the DO upgrade and first `join` frame. With `wscat`:

```bash
npx wscat -c "${WORKER_HOST/https:/wss:}/ws/room/$ROOM_ID"
```

Send:

```json
{"type":"join","playerId":"player_smoke_host","nickname":"SmokeHost"}
```

Expected server messages:

- `joined`
- `presence`
- `game_state`

Close the WebSocket after verifying the messages.

## Maintenance Mode Smoke

Only run this when temporarily blocking new rooms is acceptable.

Enable maintenance mode:

```bash
npx wrangler kv key put maintenance_mode true --binding CONFIG --remote
```

Verify new room creation is blocked:

```bash
curl -i -X POST "$WORKER_HOST/api/rooms" \
  -H "content-type: application/json" \
  --data '{"name":"Blocked","maxPlayers":8,"playerId":"player_blocked","nickname":"Blocked"}'
```

Expected:

- HTTP `503`.
- Response body includes `Server is under maintenance`.

Disable maintenance mode:

```bash
npx wrangler kv key put maintenance_mode false --binding CONFIG --remote
```

## Avatar R2 Smoke

Only run this when production writes are acceptable.

Avatar uploads accept PNG, JPEG, GIF, and WebP content types up to 512 KiB.

```bash
printf '\x89PNG\r\n\x1a\n' > /tmp/werewolf-smoke-avatar.png
curl -fsS -X POST "$WORKER_HOST/api/assets/avatar" \
  -F "playerId=player_smoke_avatar" \
  -F "avatar=@/tmp/werewolf-smoke-avatar.png;type=image/png"
curl -fsS -o /tmp/werewolf-smoke-avatar-read.png "$WORKER_HOST/assets/avatar/player_smoke_avatar"
curl -fsS -X DELETE "$WORKER_HOST/api/assets/avatar" \
  -H "content-type: application/json" \
  --data '{"playerId":"player_smoke_avatar"}'
```

Expected:

- Upload returns JSON with the avatar key.
- Read returns the uploaded object.
- Delete returns success.

## Final Audit

Record the deploy result with:

```bash
date -u
npx wrangler --version
git rev-parse --short HEAD
```

Also record:

- Worker URL.
- Whether write smoke checks were run.
- Any failed endpoint, status code, and response body.
