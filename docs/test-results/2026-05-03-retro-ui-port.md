# Retro UI Port Test Result

Date: 2026-05-03
Checklist: `docs/test-checklists/2026-05-03-retro-ui-port.md`
Environment: local Wrangler dev server at `http://127.0.0.1:8787`

## Summary

Result: passed for automated checks and local Worker HTTP smoke checks.

Manual multi-browser visual clicking was not repeated for this result file. The checklist's game-flow and persistence regressions overlap with `docs/test-results/2026-05-03-core-game-loop.md`, which was previously verified with scripted WebSocket clients and local D1 checks.

## Automated Verification

- `node --version`
  - Output: `v25.9.0`
  - Checklist expectation: `>=22.0.0`
  - Result: passed
- `npm test`
  - Output: `4 passed (4)` test files
  - Output: `21 passed (21)` tests
  - Files:
    - `tests/game.test.ts`
    - `tests/validation.test.ts`
    - `tests/messages.test.ts`
    - `tests/render.test.ts`
  - Result: passed
- `npm run typecheck`
  - Output: no TypeScript errors
  - Result: passed

## Local Worker Smoke Checks

- Command: `npm run dev -- --ip 127.0.0.1 --port 8787`
- Wrangler output: `Ready on http://127.0.0.1:8787`
- Bindings reported by Wrangler:
  - `ROOM_DO` Durable Object, local
  - `CONFIG` KV Namespace, local
  - `DB` D1 Database, local
  - `ASSETS` R2 Bucket, local
- `GET /`
  - Output: `200 OK`
  - Confirmed page includes `汝等是人是狼？`, `遊戲列表`, and `建立村子`.
- `GET /api/rooms`
  - Output: `200 OK`
  - Confirmed JSON room list response.

## Render Coverage

The Vitest render checks confirm:

- Home page includes fieldset/table-era structure, menu text, room list text, escaped room names, room links, and create-room controls.
- Room page includes WebSocket client script, room header, join button, chat submit button, start-game button, player list, action/vote section, and werewolf chat support.

## Notes

- The Wrangler dev server was shut down after verification.
- No files under `ref/` were modified.
