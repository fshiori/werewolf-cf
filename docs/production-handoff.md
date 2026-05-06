# Production Handoff

This project is locally implemented and smoke-testable, but production deployment requires Cloudflare account access and real resource IDs.

## Current External Inputs

Before `npm run check:deploy` can pass in production mode, replace the local placeholders in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "werewolf-cf"
database_id = "<production D1 database id>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "CONFIG"
id = "<production KV namespace id>"
```

The R2 binding uses the bucket name `werewolf-cf-assets`; create that bucket before deploy if it does not already exist.

## Resource Setup

Authenticate Wrangler first:

```bash
npx wrangler login
npx wrangler whoami
```

Create or inspect the required production resources:

```bash
npx wrangler d1 create werewolf-cf
npx wrangler kv namespace create CONFIG
npx wrangler r2 bucket create werewolf-cf-assets
```

Copy the D1 database UUID from the `d1 create` output into `database_id`, and copy the KV namespace id from the `kv namespace create` output into the `CONFIG` namespace `id`.

## Deployment Order

Run the full local deploy gate:

```bash
npm run check:deploy
```

Apply remote D1 migrations and verify the schema:

```bash
npx wrangler d1 migrations apply werewolf-cf --remote
npm run check:d1-schema:remote
```

Deploy the Worker:

```bash
npm run deploy
```

Run production smoke tests:

```bash
export WORKER_HOST="https://<worker-host>"
npm run smoke:production -- "$WORKER_HOST"
npm run smoke:production:write -- "$WORKER_HOST" --yes
```

The write smoke creates a temporary production room/player row and verifies the WebSocket join path plus avatar upload/read/delete. Avatar data is deleted on the success path; smoke room/player rows remain in D1.

## Local Verification Reference

For local validation before production access is available:

```bash
npx wrangler d1 migrations apply werewolf-cf --local
npm run check:wrangler
npm run check:d1-schema
npm run smoke:local
npm run smoke:local:write
```
