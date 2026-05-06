# Reference Port Gap Audit

Date: 2026-05-06

Reference target: `ref/diam1.3.61.kz_Build0912`

Scope: UI/UX and game-rule parity audit for the Cloudflare Workers/D1/Durable Objects port. This file is a tracking artifact; it does not change or copy files from `ref/`.

## Current Evidence

Implemented Cloudflare artifacts:

- Worker routes: `src/index.ts`
- Rendered pages: `src/render.ts`
- Room browser client: `src/room-client.ts`
- Durable Object room authority and WebSocket filtering: `src/room.ts`
- Core game state machine: `src/game.ts`
- D1 schema: `migrations/`
- Local rendered UI smoke: `scripts/smoke-local-ui.mjs`
- Reference asset inventory: `docs/reference-asset-inventory.md`, `scripts/inventory-reference-assets.mjs`
- Automated tests: `tests/`

Reference files inspected:

- `index.php`: top page, menu, room creation form, announcement, room list include.
- `list.php`: federated room list layout.
- `game_view.php`: spectator room layout, player list, logs, voting/death/last-words sections, phase color handling.
- `game_play.php`: logged-in player room layout, talk/action flow, death/heaven mode, exit handling.
- `game_functions.php`: output helpers for talk logs, victory, dead players, ability actions, votes, players, last words, revote, victory rules.
- `user_manager.php`: resident registration, icon/trip/wish role handling.
- `room_manager.php`: room creation and room list behavior.

## Prompt-To-Artifact Checklist

| Requirement | Current artifact/evidence | Status |
| --- | --- | --- |
| Cloudflare Workers runtime | `src/index.ts`, `wrangler.toml`, `npm run check:wrangler` | Implemented |
| D1 persistence | `migrations/`, `RoomDurableObject.syncRoomStatus`, `tests/d1-schema.test.mjs` | Implemented |
| Durable Objects + WebSockets source of truth | `src/room.ts`, `tests/room.test.ts` | Implemented |
| DO alarms for day/night | `RoomDurableObject.alarm`, `advancePhaseByAlarm`, alarm tests | Implemented |
| R2 avatar storage | `/api/assets/avatar`, `/assets/avatar/:playerId`, write smoke | Implemented |
| KV runtime config | `/api/config`, `/status`, `getHomeAnnouncement`, `isMaintenanceMode` | Implemented |
| Rendered non-JSON pages | `/`, `/room/:id`, `/leaderboard`, `/status`, `/room/:id/records`, `/room/:id/events`, `/player/:id`, `/rules`, `/protocol`, `/version` | Implemented |
| Room page client script not inline | `/assets/room-client.js`, `src/room-client.ts`, local UI smoke | Implemented |
| Reference top/menu visual style | Table layout, side menu, fieldsets, colors, and reference top title/background asset URLs in `src/render.ts` | Partial |
| Reference room player grid visual style | `renderRoom`, `.player-card`, `.player-icon`, role/death/vote styling | Partial |
| Reference chat/log/death/vote sections | Room page has chat/game log/records/events; game functions have log/death/vote handling | Partial |
| Reference icons and bitmap assets | R2 upload exists; `docs/reference-asset-inventory.md` classifies 130 reference assets; `/assets/reference/:path` serves vetted copied R2 assets; top chrome and home room-list status/option marks emit reference image URLs with text fallback | Partial |
| Browser E2E/manual visual verification | Local HTTP UI smoke only; no installed browser detected | Missing |
| Screenshot/visual parity against ref | No screenshot baseline or comparison artifact | Missing |
| Complete PHP rule parity | Core roles/options implemented, but no line-by-line rule parity manifest | Partial |
| Federated room list (`list.php`) | No cross-server/federated list equivalent | Missing |
| Discussion board (`bbs.php`) | No forum equivalent | Missing |
| Icon catalog/upload parity | Avatar upload exists, but no reference-style icon catalog/default icon picker | Partial |
| Old logs (`old_log.php`) | `/room/:roomId/log` renders the D1 game-record and audit-event transcript summary; full talk/vote replay persistence is still missing | Partial |
| Trip identity parity | Trip register/claim/exclusion exists, but no full reference-style Trip public lookup UI | Partial |

## UI Parity Findings

### Implemented or close

- Top page uses a reference-like table shell, side menu, fieldsets, room list, announcement, and create-room form.
- Room creation covers max users, comments, real-time timing, wish role, Trip-required, GM, dummy boy, last words, open vote, common voice, dead role visibility, self-vote, vote-status, and major optional roles.
- Room page uses retro table panels for header, player list, actions/votes, chat, logs, records, and events.
- Room page now loads client logic through `/assets/room-client.js` instead of embedding the whole WebSocket client in the HTML.

### Still missing or weak

- Reference uses bitmap title/background/role/status/option images such as `img/top_title.jpg`, `img/top_bg.jpg`, `img/playing.gif`, `img/waiting.gif`, role images, and option icons. Current top chrome and room list now emit copied R2 asset URLs while keeping text fallback; role images are still mostly CSS/text.
- Reference menu includes `聯合列表`, script info, old logs, icon view/upload, win-rate analysis, BBS, Trip registration. Current menu has the core app pages but not every legacy page.
- Reference room view has phase-specific body colors, manual/auto refresh links, login/resident registration links, and different layouts for spectator/player/heaven modes. Current room page is a single realtime WebSocket view.
- Reference player list includes default icons, hover image swap, Trip links, role reveal text colors, already-voted background, and dead icon handling. Current player cards approximate only part of this.
- Reference talk log has many location-specific render paths: public day, night wolf, common, lovers, fox, self talk, heaven, GM broadcast/whisper, system action visibility, and post-game/dead visibility. Current WebSocket channels cover the major private channels, but the visual transcript is simpler.
- Reference vote output renders per-day vote tables, open-vote visibility, revote messages, and dead/spectator differences. Current UI shows summary/action state, but not full historical vote-table rendering.

## Rule Parity Findings

### Implemented or close

- Role deck for 8 to 30 players exists in `REFERENCE_ROLE_DECKS`.
- Core phases: lobby, day, night, ended.
- Day vote, revote on tie, authority vote weight, decider tie handling.
- Night kill, seer, child fox, guard, cat revive.
- Poison/cat linked deaths, lover linked deaths, betrayer linked deaths.
- Winners: villagers, werewolves, foxes, lovers.
- Private channels: wolf, fox, common, lovers, dead, GM, GM whisper.
- Dead role visibility and end-game role reveal.
- Last words and dummy boy first night.
- D1 final records and player stats after game end.

### Still missing or weak

- `game_functions.php` has additional visibility branches for many system talk locations. Current implementation has equivalent permission checks for channels but not full transcript parity.
- `game_functions.php` victory logic includes special handling around lover-only victory and heavy wolf / fox edge cases. Current `getWinner` is simpler and needs explicit parity tests against reference scenarios.
- Reference has "cult" images/options in assets and talk-role handling. Current `PlayerRole` and options do not include cult.
- Reference has objection/sound/revote SWF paths and cookie-driven sound notifications. Current port has no sound notification equivalent.
- Reference has silence/sudden-death checks in `game_play.php` flow. Current DO alarm advances phases but does not implement reference-style silence/sudden death.
- Reference has resident exit/reset vote handling while waiting. Current lobby kick exists; voluntary leave/reset semantics are not equivalent.
- Reference has manual/auto refresh spectator view. Current app is realtime only.

## Next Concrete Work Items

1. Wire copied R2 reference assets into more rendered pages, starting with role/result images.
2. Add default icon picker/catalog parity for `icon_view.php` and `user_manager.php` icon registration.
3. Add full talk/vote/action transcript persistence so `/room/:roomId/log` can replay more than final records and audit events.
4. Add a visual parity checklist with screenshots once a browser is available in the environment.
5. Add focused parity tests for lover-only victory, heavy wolf/fox edge cases, silence/sudden death, and vote table visibility.
6. Decide whether to implement or explicitly defer federated room list and BBS features.

## Current Verification Gaps

- No Playwright/browser E2E is installed or runnable in the current environment; `chromium`, `chromium-browser`, `google-chrome`, and `chrome` were not found.
- Local rendered UI smoke verifies HTTP-rendered pages but does not execute browser JavaScript.
- No screenshot baseline exists against the reference PHP UI.
