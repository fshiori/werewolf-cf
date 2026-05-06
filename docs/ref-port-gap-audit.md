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
| Rendered non-JSON pages | `/`, `/room/:id`, `/leaderboard`, `/icons`, `/trips`, `/status`, `/room/:id/records`, `/room/:id/events`, `/player/:id`, `/rules`, `/protocol`, `/version` | Implemented |
| Room page client script not inline | `/assets/room-client.js`, `src/room-client.ts`, local UI smoke | Implemented |
| Reference top/menu visual style | Table layout, side menu, fieldsets, colors, and reference top title/background asset URLs in `src/render.ts` | Partial |
| Reference room player grid visual style | `renderRoom`, `.player-card`, `.player-icon`, role/death/vote styling; client emits reference role icons for revealed roles and grave fallback for dead players | Partial |
| Reference chat/log/death/vote sections | Room page has chat/game log/records/events; public and private channel/action events persist to `room_events`; private transcript entries are hidden from `/events` and `/log` until the room status is ended | Partial |
| Reference icons and bitmap assets | R2 upload exists; `docs/reference-asset-inventory.md` classifies 130 reference assets; `/assets/reference/:path` serves vetted copied R2 assets; top chrome, home room-list status/options, rules role rows, live revealed role markers, and game-record victory rows emit reference image URLs with text fallback | Partial |
| Browser E2E/manual visual verification | Local HTTP UI smoke only; no installed browser detected | Missing |
| Screenshot/visual parity against ref | No screenshot baseline or comparison artifact | Missing |
| Complete PHP rule parity | Core roles/options implemented; focused tests now cover lover-only normal wins, one-lover non-wins, big-wolf win counting, child-fox fox wins, vote visibility, and timed sudden-death alarm handling, but no line-by-line rule parity manifest | Partial |
| Federated room list (`list.php`) | No cross-server/federated list equivalent | Missing |
| Discussion board (`bbs.php`) | No forum equivalent | Missing |
| Icon catalog/upload parity | `/icons` renders the reference default icon catalog; room join can send a vetted default `iconPath`; avatar upload exists | Partial |
| Old logs (`old_log.php`) | `/room/:roomId/log` renders D1 game records and room-event transcript sections grouped by day/phase with reference-like labels for chat, votes, and night actions; private entries are visible only after the room ends | Partial |
| Trip identity parity | Trip register/claim/exclusion exists; `/trips` and `/api/trips/lookup` provide a public lookup UI/API for registered/excluded status, claimed players, and aggregate stats without exposing Trip hashes | Partial |

## UI Parity Findings

### Implemented or close

- Top page uses a reference-like table shell, side menu, fieldsets, room list, announcement, and create-room form.
- Room creation covers max users, comments, real-time timing, wish role, Trip-required, GM, dummy boy, last words, open vote, common voice, dead role visibility, self-vote, vote-status, and major optional roles.
- Room page uses retro table panels for header, player list, actions/votes, chat, logs, records, and events.
- Room page now loads client logic through `/assets/room-client.js` instead of embedding the whole WebSocket client in the HTML.

### Still missing or weak

- Reference uses bitmap title/background/role/status/option/victory images such as `img/top_title.jpg`, `img/top_bg.jpg`, `img/playing.gif`, `img/waiting.gif`, role images, option icons, and victory result images. Current top chrome, room list, rules role rows, revealed live-room role markers, dead fallback, and game-record victory rows now emit copied R2 asset URLs while keeping text fallback.
- Reference menu includes `聯合列表`, script info, old logs, icon view/upload, win-rate analysis, BBS, Trip registration. Current menu has the core app pages, a default icon catalog, and Trip lookup, but not every legacy page.
- Reference room view has phase-specific body colors, manual/auto refresh links, login/resident registration links, and different layouts for spectator/player/heaven modes. Current room page is a single realtime WebSocket view.
- Reference player list includes default icons, hover image swap, Trip links, role reveal text colors, already-voted background, and dead icon handling. Current player cards now emit selected default icons, reference role icons for revealed roles, and a grave fallback for dead players, but still lack hover image swap and Trip links.
- Reference talk log has many location-specific render paths: public day, night wolf, common, lovers, fox, self talk, heaven, GM broadcast/whisper, system action visibility, and post-game/dead visibility. Current WebSocket channels cover the major private channels and public/private transcript entries are persisted with room-status visibility filtering; `/room/:id/log` groups replay entries by day/phase, but still lacks full PHP-compatible per-location styling.
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
- `game_functions.php` victory logic includes special handling around lover-only victory and heavy wolf / fox edge cases. Current tests now pin both-lovers win, one-lover non-win, big-wolf counting, and child-fox fox-win cases; more reference scenarios may still need mapping.
- Reference has "cult" images/options in assets and talk-role handling. Current `PlayerRole` and options do not include cult.
- Reference has objection/sound/revote SWF paths and cookie-driven sound notifications. Current port has no sound notification equivalent.
- Reference has silence/sudden-death checks in `game_play.php` flow. Current DO alarm now sudden-deaths timed-out day voters and required night actors, resets action maps, and starts another same-phase deadline; the separate reference-style warning window and conversation-time silence acceleration are still missing.
- Reference has resident exit/reset vote handling while waiting. Current lobby kick exists; voluntary leave/reset semantics are not equivalent.
- Reference has manual/auto refresh spectator view. Current app is realtime only.

## Next Concrete Work Items

1. Continue improving `/room/:roomId/log` toward PHP-compatible per-location styling and historical vote tables; day/phase grouping plus private talk, vote, and action transcript persistence is now in place.
2. Add focused parity tests for the remaining warning-window and conversation-time silence behavior; vote table visibility and timed sudden-death actor handling are now pinned.
3. Add a visual parity checklist with screenshots once a browser is available in the environment.
4. Decide whether to implement or explicitly defer federated room list and BBS features.

## Current Verification Gaps

- No Playwright/browser E2E is installed or runnable in the current environment; `chromium`, `chromium-browser`, `google-chrome`, and `chrome` were not found.
- Local rendered UI smoke verifies HTTP-rendered pages but does not execute browser JavaScript.
- No screenshot baseline exists against the reference PHP UI.
