# Production Handoff

This project is locally implemented and smoke-testable, but production deployment requires Cloudflare account access and real resource IDs.

## Stable Candidate Snapshot

As of 2026-05-12, `main` has passed the full local deploy gate and local runtime smoke suite for the core playable path:

```bash
npm run check:deploy
npm run smoke:local
npm run smoke:local:ui
npm run smoke:local:write
npm run smoke:local:game
```

The verified path covers Worker metadata, rendered core/legacy pages, room creation, WebSocket join, avatar upload/read/delete through R2, an 8-player game through start, day vote, night actions, second-day execution, ended room status, D1 room records, winning-player stats/records, and rendered room history pages. See `docs/core-stable-audit.md` for the prompt-to-artifact checklist and non-blocking backlog.

## Current External Inputs

As of the latest local handoff pass, `npx wrangler whoami` reports `You are not authenticated. Please run wrangler login.` Remote D1 migration, deploy, and production smoke are therefore blocked until a Cloudflare session or `CLOUDFLARE_API_TOKEN` is available.

`npm run check:production-ready` currently passes the local stable gate and then stops at this same production authentication blocker.

Before `npm run check:deploy` can pass in production mode, copy the ignored production config and replace its placeholders:

```bash
cp wrangler.production.toml.example wrangler.production.toml
```

Do not commit `wrangler.production.toml`.

```toml
account_id = "<cloudflare-account-id>"

[[d1_databases]]
binding = "DB"
database_name = "werewolf-cf-db"
database_id = "<production D1 database id>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "CONFIG"
id = "<production KV namespace id>"
```

The R2 binding uses the bucket name `werewolf-cf-assets`; create that bucket before deploy if it does not already exist.

## Resource Setup

Authenticate Wrangler first. For local deployment, export a rotated API token in the shell; for CI, store it as a secret. Do not write the token into any tracked or ignored config file.

```bash
CLOUDFLARE_API_TOKEN="<rotated-api-token>"
export CLOUDFLARE_API_TOKEN
npx wrangler whoami
npm run check:production-access
```

Create or inspect the required production resources:

```bash
npx wrangler d1 create werewolf-cf-db --config wrangler.production.toml
npx wrangler kv namespace create CONFIG --config wrangler.production.toml
npx wrangler r2 bucket create werewolf-cf-assets --config wrangler.production.toml
```

Copy the D1 database UUID from the `d1 create` output into `database_id`, and copy the KV namespace id from the `kv namespace create` output into the `CONFIG` namespace `id`.

Confirm the reference bitmap asset upload plan before writing to R2:

```bash
npm run assets:reference:plan
```

## Deployment Order

Run the full local deploy gate:

```bash
npm run check:deploy
```

For the full local stable-candidate gate, including runtime smoke with a managed Wrangler server:

```bash
npm run check:stable
```

Before remote migration or deploy, run the production-ready gate. It includes the full local stable gate and then verifies Cloudflare authentication:

```bash
npm run check:production-ready
```

Apply remote D1 migrations and verify the schema:

```bash
npm run migrate:production
npm run check:d1-schema:remote
```

Upload the reference bitmap assets used by the retro UI:

```bash
npm run assets:reference:upload
```

Deploy the Worker:

```bash
npm run deploy
```

`npm run deploy` runs `check:production-ready` through `predeploy`, so it will stop before deployment when local stable checks fail or Wrangler is not authenticated.

Run the full production stable smoke suite:

```bash
export WORKER_HOST="https://<worker-host>"
npm run smoke:production:stable -- "$WORKER_HOST" --yes
```

To run the complete guarded production release sequence from one command:

```bash
export WORKER_HOST="https://<worker-host>"
npm run release:production -- "$WORKER_HOST" --yes
```

If production writes are not acceptable, run only the read-only production smoke:

```bash
npm run smoke:production -- "$WORKER_HOST"
```

The write smoke creates a temporary production room/player row and verifies the WebSocket join path plus avatar upload/read/delete. The game-loop smoke creates a temporary 8-player room, runs a minimal full game through ended status, and confirms the room game record, winning-player stats/records, and rendered room history pages are readable. Avatar data is deleted on the write-smoke success path; smoke room/player/game-record rows remain in D1.

## Local Verification Reference

For local validation before production access is available:

```bash
npx wrangler d1 migrations apply werewolf-cf-db --local
npm run check:wrangler
npm run check:d1-schema
npm run smoke:local:stable
```

`smoke:local:stable` uses port `8787` when available and otherwise chooses the next open local port. Pass `-- --port=8787` when a fixed port is required.

To run the local smoke checks against an already-running Worker instead:

```bash
npm run smoke:local
npm run smoke:local:ui
npm run smoke:local:write
npm run smoke:local:game
```
