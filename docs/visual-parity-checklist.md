# Visual Parity Checklist

Date: 2026-05-06

Reference target: `ref/diam1.3.61.kz_Build0912`

Purpose: define the browser/manual screenshot pass required to judge UI parity with the reference PHP build. This checklist does not modify, copy, or normalize files under `ref/`.

## Current Status

Playwright Chromium is available in the current environment. `npm run check:visual-prereqs` checks system Chromium/Chrome candidates and falls back to Playwright-managed Chromium when it is installed.

The first automated capture path is available:

```bash
npm run assets:reference:local
npm run capture:visual -- --dry-run
npm run capture:visual -- --yes
npm run capture:visual -- --yes --include-game-states
```

The local asset seed copies priority reference bitmaps into local Wrangler R2 storage so screenshots do not contain broken `/assets/reference/...` images. The capture command then captures static pages, a temporary lobby room, and the PHP-style frame/up/bottom/vote room aliases across the required desktop/tablet/mobile viewports. Passing `--include-game-states` drives an 8-player smoke game and also captures day, night, ended, and public/player/dead/GM old-log views. GM live-control captures and manual comparison against `ref/diam1.3.61.kz_Build0912` remain.

## Prerequisites

1. Start from a clean worktree.
2. Run the normal verification gates:
   - `npm test`
   - `npm run typecheck`
   - `npm run check:wrangler`
   - `npm run check:whitespace`
   - `npm run check:d1-schema`
3. Start the local Worker:
   - `npm run dev -- --ip 127.0.0.1 --port 8787`
4. Use a browser-capable environment with Chromium, Chrome, or Playwright available.
   - Verify with `npm run check:visual-prereqs`.
5. Seed local reference bitmaps into Wrangler R2:
   - `npm run assets:reference:local`
6. Run the automated capture for static/lobby/frame pages:
   - `npm run capture:visual -- --yes`
7. Run the stateful automated capture for day/night/ended/public old-log pages:
   - `npm run capture:visual -- --yes --include-game-states`
8. Prepare rooms that cover GM live controls and any manual reference-comparison variants not covered by the automated capture.

## Evidence Paths

Write the manual pass report to:

- `docs/test-results/YYYY-MM-DD-visual-parity.md`

Store screenshots under:

- `docs/screenshots/YYYY-MM-DD/home.png`
- `docs/screenshots/YYYY-MM-DD/list.png`
- `docs/screenshots/YYYY-MM-DD/room-lobby.png`
- `docs/screenshots/YYYY-MM-DD/room-day.png`
- `docs/screenshots/YYYY-MM-DD/room-night.png`
- `docs/screenshots/YYYY-MM-DD/room-ended.png`
- `docs/screenshots/YYYY-MM-DD/room-spectator-dead-votes.png`
- `docs/screenshots/YYYY-MM-DD/room-gm-controls.png`
- `docs/screenshots/YYYY-MM-DD/old-log-public.png`
- `docs/screenshots/YYYY-MM-DD/old-log-player.png`
- `docs/screenshots/YYYY-MM-DD/old-log-dead.png`
- `docs/screenshots/YYYY-MM-DD/old-log-gm.png`
- `docs/screenshots/YYYY-MM-DD/icons.png`
- `docs/screenshots/YYYY-MM-DD/trip.png`
- `docs/screenshots/YYYY-MM-DD/bbs.png`
- `docs/screenshots/YYYY-MM-DD/stats.png`
- `docs/screenshots/YYYY-MM-DD/status.png`

## Viewports

Capture every route at these viewport sizes:

| Name | Size |
| --- | --- |
| Desktop | `1280x900` |
| Tablet | `768x1024` |
| Narrow mobile | `390x844` |

## Capture Matrix

| Reference screen | Current route | Required captures | Checks |
| --- | --- | --- | --- |
| `index.php` | `/` | `home` | Top title/background, side menu placement, create-room table, announcement area, room list option/status icons. Automated capture available. |
| `list.php` | `/list` | `list` | Federated list table structure, local room rows, remote-peer failure text behavior, retro colors. Automated capture available. |
| `game_view.php` lobby | `/room/:roomId` | `room-lobby` | Room header, participant grid, join form, host controls, lobby vote/kick controls, selected default icons. Automated capture available. |
| `game_play.php` day | `/room/:roomId` | `room-day`, `room-spectator-dead-votes` | Day body color, player cards, voted-player background, chat, public log, live vote-status panel for allowed viewers. Automated capture available for `room-day`. |
| `game_play.php` night | `/room/:roomId` | `room-night` | Night body color, private-channel controls, night action panel, hidden target/status behavior for unauthorized viewers. Automated capture available for `room-night`. |
| `game_play.php` GM paths | `/room/:roomId` | `room-gm-controls` | GM buttons, whisper controls, forced phase/life/role/winner controls, common-channel toggle. |
| `game_view.php` ended | `/room/:roomId` | `room-ended` | Ended body color, role reveal icons/text, winner result, records/events links. Automated capture available. |
| `old_log.php` | `/logs`, `/room/:roomId/log` | `old-log-public`, `old-log-player`, `old-log-dead`, `old-log-gm` | Ended-room index, normal/reverse/heaven links, day/phase transcript grouping, vote tables, viewer masking. Automated capture available for public/player/dead/GM old-log. |
| `user_manager.php` icon paths | `/icons`, room join controls | `icons` | Default icon catalog, upload/remove controls, selected icon rendering in room. Automated capture available for `/icons`. |
| `user_manager.php` Trip paths | `/trip`, `/trips` | `trip` | Registration, claim, exclusion, lookup tables, no Trip hash exposure. Automated capture available for `/trip`. |
| `bbs.php` | `/bbs`, `/bbs/:id` | `bbs` | Topic list, digest list, detail page, reply form, moderation controls. Automated capture available for `/bbs`. |
| `stats.php` | `/stats`, `/leaderboard`, `/player/:id` | `stats` | Win-rate tables, leaderboard rows, profile stat layout. Automated capture available for `/stats`. |
| `admin.php` and status pages | `/admin/rooms`, `/status`, `/rules`, `/script-info`, `/protocol`, `/version` | `status` | Management/status tables, menu consistency, reference asset fallbacks. Automated capture available for `/status`. |

## Acceptance Checks

- The first viewport strongly resembles the reference table-based layout, color palette, and menu positioning.
- Text is readable and does not overlap, truncate incoherently, or escape button/table boundaries at any viewport.
- Reference bitmap assets served by `/assets/reference/:path` render without broken images where the port intentionally uses them.
- Room WebSocket behavior works in the browser: join, chat, start, day vote, night action, last words, objection, GM commands, and sound toggle.
- Private information is not visually leaked in live state: non-wolves cannot see wolf-channel messages, non-foxes cannot see fox-channel messages, non-lovers cannot see lovers-channel messages, and unauthorized viewers cannot see hidden vote/night targets.
- Old-log viewer modes remain additive evidence views after game end and do not expose private transcript entries on `/events` or public logs while the room is active.
- Mobile and tablet captures preserve the retro layout without nested card-heavy presentation.

## Report Template

Use this structure in `docs/test-results/YYYY-MM-DD-visual-parity.md`:

```md
# Visual Parity Pass

Date:
Browser:
Worker command:
Commit:

## Summary

- Result: Pass / Partial / Fail
- Remaining blockers:

## Screenshot Index

| Capture | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |

## Functional Browser Checks

| Check | Result | Notes |
| --- | --- | --- |

## Privacy Checks

| Check | Result | Notes |
| --- | --- | --- |
```
