# Core Game Loop Test Result

Date: 2026-05-03
Checklist: `docs/test-checklists/2026-05-03-core-game-loop.md`
Environment: local Wrangler dev server at `http://127.0.0.1:8787`

## Summary

Result: passed for automated checks, scripted WebSocket/game-loop checks, local D1 persistence checks, and Durable Object alarm timing checks.

Manual browser-profile clicking was not performed. The multi-client browser scenarios were exercised with scripted WebSocket clients against the local Worker instead.

## Automated Verification

Latest automated rerun:

- Date: 2026-05-04
- `npm test`
  - Output: `10 passed (10)` test files
  - Output: `218 passed (218)` tests
  - Files:
    - `tests/d1-schema.test.mjs`
    - `tests/game.test.ts`
    - `tests/index.test.ts`
    - `tests/production-write-smoke.test.mjs`
    - `tests/production-smoke.test.mjs`
    - `tests/validation.test.ts`
    - `tests/messages.test.ts`
    - `tests/render.test.ts`
    - `tests/room.test.ts`
    - `tests/wrangler-config.test.mjs`
  - Result: passed
- `npm run typecheck`
  - Output: no TypeScript errors
  - Result: passed
- `git diff --check`
  - Output: no whitespace errors
  - Result: passed

Original checklist run:

- `node --version`
  - Output: `v25.9.0`
  - Checklist expectation: `>=22.0.0`
  - Result: passed
- `npm install`
  - Output: `up to date, audited 86 packages in 3s`
  - Output: `found 0 vulnerabilities`
  - Result: passed
- `npm test`
  - Output: `4 passed (4)` test files
  - Output: `18 passed (18)` tests
  - Files:
    - `tests/game.test.ts`
    - `tests/validation.test.ts`
    - `tests/messages.test.ts`
    - `tests/render.test.ts`
  - Result: passed
- `npm run typecheck`
  - Output: no TypeScript errors
  - Result: passed
- `git status --short --branch`
  - Output:

```text
## main...origin/main [ahead 2]
?? docs/test-checklists/
```

## Local Worker Startup

- Command: `npm run dev -- --ip 127.0.0.1 --port 8787`
- Wrangler output: `Ready on http://127.0.0.1:8787`
- Bindings reported by Wrangler:
  - `ROOM_DO` Durable Object, local
  - `CONFIG` KV Namespace, local
  - `DB` D1 Database, local
  - `ASSETS` R2 Bucket, local
- `curl -i http://127.0.0.1:8787/`
  - Output: `HTTP/1.1 200 OK`
  - Confirmed page includes retro table UI, nickname input, room name input, `建立房間`, and room list table.
- `curl -i http://127.0.0.1:8787/room/room_77ffc9871ede4624`
  - Output: `HTTP/1.1 200 OK`
  - Confirmed room page includes `進入房間`, `生存者`, chat controls, `開始遊戲`, player action buttons, and game log markup.

## Scripted Room And WebSocket Verification

The following checklist items were verified with Node WebSocket clients against the local Worker:

- Room creation returns `/room/<room_id>` compatible room ID.
- Newly-created room appears in `/api/rooms` with `lobby` status.
- Sending `chat` before `join` returns `Join required`.
- 4 separate WebSocket clients can join the same room with distinct nicknames.
- Presence updates show all joined players.
- Chat message `<script>alert(1)</script>` is escaped as text and does not appear as raw HTML.
- Starting with at least 3 players moves all clients to `day 1`.
- Public `game_state` messages do not include player `role`.
- Each client receives only its own private `role` message.
- Villagers receive an empty wolf list.
- Werewolf receives the expected wolf list for the current game.
- Room list status updates to `playing` after game start.
- Completed day vote moves the game to `night`.
- Highest-vote player is marked dead.
- Tied day vote moves to `night` with no deaths.
- Dead players cannot effectively vote; server returns `Living player is required`.
- Villager `night_kill` is rejected with `Only werewolves can perform night kills`.
- Werewolf targeting another werewolf is rejected with `Werewolves cannot target each other`.
- Valid werewolf night kill resolves the night.
- Werewolf win condition was reached and broadcast.
- Villager win condition was reached and broadcast.
- Ended room status updates to `ended`.

Primary scripted run output:

```json
{
  "roomId": "room_5b71ba53d46d4f67",
  "clients": 4,
  "wolf": "player_d",
  "checks": [
    "room lobby",
    "join required",
    "presence",
    "escaped chat",
    "role privacy",
    "playing status",
    "day vote",
    "night auth",
    "werewolf win",
    "ended status"
  ]
}
```

Additional state-machine branch output:

```json
{
  "checks": [
    "tied vote no death",
    "villager win",
    "dead player vote rejected"
  ]
}
```

## D1 Persistence Verification

Command:

```sh
npx wrangler d1 execute werewolf-cf --local --command "SELECT room_id, result_json FROM game_records ORDER BY id DESC LIMIT 3"
```

Confirmed local D1 `game_records` contained final result for `room_5b71ba53d46d4f67`:

```json
{
  "room_id": "room_5b71ba53d46d4f67",
  "result_json": "{\"winner\":\"werewolves\",\"day\":1,\"players\":[{\"playerId\":\"player_a\",\"nickname\":\"Alice\",\"role\":\"villager\",\"alive\":false},{\"playerId\":\"player_b\",\"nickname\":\"Bob\",\"role\":\"villager\",\"alive\":false},{\"playerId\":\"player_c\",\"nickname\":\"Carol\",\"role\":\"villager\",\"alive\":true},{\"playerId\":\"player_d\",\"nickname\":\"Dave\",\"role\":\"werewolf\",\"alive\":true}]}"
}
```

Follow-up count query:

```sh
npx wrangler d1 execute werewolf-cf --local --command "SELECT COUNT(*) AS count FROM game_records"
```

Output:

```json
{
  "count": 2
}
```

## Durable Object Alarm Verification

Alarm test room: `room_77ffc9871ede4624`

Observed WebSocket state transitions:

```text
2026-05-03T13:13:27.754Z player_aa day 1
2026-05-03T13:13:27.755Z player_ab day 1
2026-05-03T13:13:27.756Z player_ac day 1
2026-05-03T13:16:27.734Z player_aa night 1
2026-05-03T13:16:27.735Z player_ab night 1
2026-05-03T13:16:27.736Z player_ac night 1
2026-05-03T13:17:57.736Z player_ab day 2
2026-05-03T13:17:57.736Z player_aa day 2
2026-05-03T13:17:57.737Z player_ac day 2
```

Result:

- Day alarm advanced from `day 1` to `night 1` after the configured 180 seconds.
- Night alarm advanced from `night 1` to `day 2` after the configured 90 seconds.

Script output:

```json
{
  "roomId": "room_77ffc9871ede4624",
  "checks": [
    "day alarm advanced to night",
    "night alarm advanced to day 2"
  ]
}
```

## Notes

- The Wrangler dev server was shut down after verification.
- `npm install` did not produce changes to `package.json` or `package-lock.json`.
- No files under `ref/` were modified.
