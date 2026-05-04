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
curl -i http://127.0.0.1:8787/
```

## Cloudflare Bindings

The Worker expects these bindings from `wrangler.toml`:

- `ROOM_DO`: Durable Object namespace for per-room live state and WebSockets.
- `DB`: D1 database for rooms, player stats, game records, Trip registry, and audit events.
- `ASSETS`: R2 bucket for uploaded avatar assets.
- `CONFIG`: KV namespace for runtime configuration such as `home_announcement` and `maintenance_mode`.

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
curl -i https://<worker-host>/api/config
```

`/api/health` should return HTTP 200 with `ok: true`. If `maintenance_mode` is set to `true` in KV, new room creation is blocked with HTTP 503 while existing rooms and read APIs remain available.
