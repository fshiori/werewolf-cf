# Core Stable Audit

Date: 2026-05-12

Scope: define the minimum stable candidate for the playable Cloudflare port. This audit intentionally treats BBS/forum parity as non-blocking because it is lower priority than the core room and game loop.

## Stable Candidate Criteria

| Requirement | Evidence | Status |
| --- | --- | --- |
| Cloudflare Workers project has deployable bindings for DO, D1, R2, and KV | `wrangler.toml`, `wrangler.production.toml.example`, `worker-configuration.d.ts`, `npm run check:wrangler -- --production --config wrangler.production.toml` through `npm run check:deploy` | Passed locally |
| D1 schema contains required gameplay, record, Trip, and BBS tables | `migrations/`, `scripts/check-d1-schema.mjs`, `npm run check:d1-schema` through `npm run check:deploy` | Passed locally |
| TypeScript and unit/integration tests pass | `npm test` through `npm run check:deploy`; 19 files / 557 tests passed on 2026-05-12 | Passed locally |
| Room creation works through HTTP | `scripts/smoke-production-write.mjs`, `scripts/smoke-game-loop.mjs`; `POST /api/rooms` returned smoke room ids during local smoke on 2026-05-12 | Passed locally |
| WebSocket join path works and returns room-scoped state | `scripts/smoke-production-write.mjs`; verifies `joined`, `presence`, and same-room `game_state` | Passed locally |
| Full 8-player game can start, progress, and end | `scripts/smoke-game-loop.mjs`; verifies 8 WebSocket joins, `start_game`, day-1 execution, night kill plus seer action, day-2 execution, and `ended` game state | Passed locally |
| Ended game persists room records and player stats | `scripts/smoke-game-loop.mjs`; verifies `/api/rooms/:roomId/records`, `/api/players/:playerId/stats`, and `/api/players/:playerId/records` | Passed locally |
| Ended game renders player-facing history pages | `scripts/smoke-game-loop.mjs`; verifies `/room/:roomId/records`, `/room/:roomId/events`, `/room/:roomId/log`, and `old_log.php?log_mode=on&room_no=:roomId` after the smoke game ends | Covered by smoke script |
| R2 avatar write/read/delete path works | `scripts/smoke-production-write.mjs`; verifies upload, readback, delete, and 404 after delete | Passed locally |
| Core rendered pages and legacy room entry pages return usable HTML | `scripts/smoke-local-ui.mjs`; verifies home/list/logs/room/player pages, PHP aliases such as `index.php`, `list.php`, `old_log.php`, `stats.php`, `trip.php`, `icon_view.php`, `icon_upload.php`, `rule.php`, `lang/jpn/rule.php`, `script_info.php`, `lang/jpn/script_info.php`, `version.php`, `lang/cht/version.htm`, plus `game_frame.php`, `game_up.php`, `game_play.php?frame=bottom`, and `game_vote.php` | Passed locally |
| Production handoff has deploy and smoke commands | `docs/production-handoff.md`, `docs/deployment-smoke.md` | Present |
| Cloudflare production authentication | `npx wrangler whoami` currently reports unauthenticated; `npm run check:production-access` and `npm run check:production-ready` verify this after local stable checks and reference asset upload dry-run, before remote migration/deploy/smoke | Blocked externally |

## Latest Verification Snapshot

The following commands were run successfully on 2026-05-12:

```bash
npm run check:deploy
npm run check:stable
npm run smoke:local
npm run smoke:local:ui
npm run smoke:local:write
npm run smoke:local:game
```

The local Wrangler server was shut down after smoke verification. The working tree was clean before this audit file was added. Later smoke-script coverage also verifies rendered room history pages after an ended game, and `npm run smoke:local:stable` now starts Wrangler locally, waits for `/api/health`, runs the full local smoke suite, and shuts the server down.

`npm run check:production-ready` was also exercised on 2026-05-12. It passed the full local stable gate and reference asset upload dry-run, then failed at `npm run check:production-access` because Wrangler is not authenticated in this environment. That is the expected external blocker before remote D1 migration, deploy, or production smoke.

## Non-Blocking Backlog

These items remain useful, but they should not block the core stable candidate:

| Area | Reason not blocking core stable |
| --- | --- |
| BBS/forum parity | User explicitly set forum and message-board priority low; existing implementation is partial and covered by tests, but not required for the playable room/game loop. |
| Full screenshot parity against the PHP reference | `docs/visual-parity-checklist.md` exists, but no browser screenshot baseline is available in this environment. Core HTML smoke covers page availability and legacy entry shapes. |
| Exact PHP historical transcript/authenticated-view behavior | Current transcript masking covers main public/player/dead/GM modes, but exact PHP identity semantics remain a parity backlog rather than a blocker for live gameplay. |
| Broader legacy admin/server-management pages | Core status/config/room admin paths exist; remaining PHP-era management parity is outside the minimum playable path. |
| Full federated-list parity | Local and configured peer list support exists, but exact reference parity is not required for a standalone stable game deployment. |

## Next Gate Before Production

Before calling a production deployment stable, run the remote-only steps that cannot be verified without Cloudflare account access:

```bash
npm run check:production-ready
npm run migrate:production
npm run check:d1-schema:remote
npm run assets:reference:plan
npm run assets:reference:upload
npm run deploy
export WORKER_HOST="https://<worker-host>"
npm run smoke:production:stable -- "$WORKER_HOST" --yes
```

The same ordered production release can be run with:

```bash
npm run release:production -- "$WORKER_HOST" --yes
```

Use the read-only `npm run smoke:production -- "$WORKER_HOST"` instead of the stable production smoke only when production writes are not acceptable.
