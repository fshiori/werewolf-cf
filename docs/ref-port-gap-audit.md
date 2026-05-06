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
- Rule parity manifest: `docs/rule-parity-manifest.md`
- Visual parity checklist: `docs/visual-parity-checklist.md`
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
| Rendered non-JSON pages | `/`, `/list`, `/logs`, `/bbs`, `/admin/rooms`, `/trip`, `/trips`, `/room/:id`, `/leaderboard`, `/stats`, `/icons`, `/status`, `/room/:id/records`, `/room/:id/events`, `/player/:id`, `/rules`, `/script-info`, `/protocol`, `/version` | Implemented |
| Room page client script not inline | `/assets/room-client.js`, `src/room-client.ts`, local UI smoke | Implemented |
| Reference top/menu visual style | Table layout, side menu, fieldsets, colors, and reference top title/background asset URLs in `src/render.ts` | Partial |
| Reference room player grid visual style | `renderRoom`, `.player-card`, `.player-icon`, role/death/vote styling; client emits reference role icons and colored role text for revealed roles plus grave fallback for dead players | Partial |
| Reference chat/log/death/vote sections | Room page has chat/game log/records/events; public and private channel/action events, including objection notifications and player leave events, persist to `room_events`; private transcript entries are hidden from `/events` and `/log` until the room status is ended | Partial |
| Reference icons and bitmap assets | R2 upload exists; `docs/reference-asset-inventory.md` classifies 130 reference assets; `/assets/reference/:path` serves vetted copied R2 assets; top chrome, home room-list status/options, rules role rows, live revealed role markers, and game-record victory rows emit reference image URLs with text fallback | Partial |
| Browser E2E/manual visual verification | Local HTTP UI smoke plus `docs/visual-parity-checklist.md` capture plan; no installed browser detected | Partial |
| Screenshot/visual parity against ref | `docs/visual-parity-checklist.md` defines the capture matrix and evidence paths; no screenshot baseline has been generated | Missing |
| Complete PHP rule parity | `docs/rule-parity-manifest.md` maps PHP rule areas to TypeScript artifacts and focused tests; core roles/options implemented; focused tests cover lover-only normal wins, one-lover non-wins, big-wolf win counting, child-fox fox wins, vote visibility, non-realtime silence acceleration, timed sudden-death warning windows, and timed sudden-death alarm handling | Partial |
| Federated room list (`list.php`) | `/list` renders a reference-style federated list from local D1 rooms and optional remote peers configured by KV `federated_servers`; failed peers are ignored | Partial |
| Discussion board (`bbs.php`) | `/bbs` renders a reference-style topic list, digest-topic list, topic detail view, post form, reply form, and topic moderation panel backed by D1 `bbs_topics`/`bbs_replies`; token-protected moderation can pin, lock, and mark digest topics | Partial |
| Icon catalog/upload parity | `/icons` renders the reference default icon catalog and R2 avatar upload/remove controls; room join can send a vetted default `iconPath`; avatar upload exists on room and icon pages | Partial |
| Old logs (`old_log.php`) | `/logs` renders a reference-style ended-room index with normal/reverse/heaven links; `/room/:roomId/log` renders D1 game records, day/phase transcript sections, historical vote tables grouped by day/revote round, reference-inspired location labels/colors for public/private/system/action rows, `heaven_talk`/`heaven_only`/`reverse_log` display modes, and additive `viewer=public/player/dead/gm` masking modes; private entries are visible only after the room ends | Partial |
| Trip identity parity | `/trip` provides reference-style identity registration, claim, exclusion, and lookup controls; `/trips` and `/api/trips/lookup` provide public lookup for registered/excluded status, claimed players, and aggregate stats without exposing Trip hashes | Partial |

## UI Parity Findings

### Implemented or close

- Top page uses a reference-like table shell, side menu, fieldsets, room list, announcement, and create-room form.
- Room creation covers max users, comments, real-time timing, wish role, Trip-required, GM, dummy boy, last words, open vote, common voice, dead role visibility, self-vote, vote-status, and major optional roles; the room join selector and assignment path now support enabled optional-role wishes.
- Room page uses retro table panels for header, player list, actions/votes, chat, logs, records, and events.
- Room page now loads client logic through `/assets/room-client.js` instead of embedding the whole WebSocket client in the HTML.
- `/admin/rooms` now provides a KV-token-protected reference-style `廢村管理` list with room comments, capacity, option context, log/event links, and D1-backed room-ending action for active rooms.

### Still missing or weak

- Reference uses bitmap title/background/role/status/option/victory images such as `img/top_title.jpg`, `img/top_bg.jpg`, `img/playing.gif`, `img/waiting.gif`, role images, option icons, and victory result images. Current top chrome, room list, rules role rows, revealed live-room role markers, dead fallback, and game-record victory rows now emit copied R2 asset URLs while keeping text fallback.
- Reference menu includes `聯合列表`, script info, old logs, icon view/upload, win-rate analysis, BBS, Trip registration. Current menu has the core app pages, a configurable federated-list page, an old-log index/detail flow, script info, win-rate analysis, a default icon catalog, Trip registration/lookup, and a basic BBS topic/reply board, but not every legacy page.
- Reference room view has phase-specific body colors, manual/auto refresh links, login/resident registration links, and different layouts for spectator/player/heaven modes. Current room page now applies reference-style lobby/day/night/ended body colors as realtime state changes and includes manual/auto refresh controls for auxiliary panels, but remains a single WebSocket view without separate spectator/heaven layouts.
- Reference player list includes default icons, hover image swap, Trip links, role reveal text colors, already-voted background, and dead icon handling. Current player cards now emit selected default icons, reference role icons and colored text for revealed roles, profile links from nicknames, already-voted backgrounds, a grave icon for dead players, and reference-style dead-icon hover swap back to the selected default icon, but still lack full Trip-page parity.
- Reference talk log has many location-specific render paths: public day, night wolf, common, lovers, fox, self talk, heaven, GM broadcast/whisper, system action visibility, and post-game/dead visibility. Current WebSocket channels cover the major private channels plus night self-talk, and public/private transcript entries are persisted with room-status visibility filtering; `/room/:id/log` groups replay entries by day/phase, labels/styles major locations and role-action rows, includes GM channel-control operations as system-visible transcript rows, supports old-log heaven/reverse display modes, and now has additive public/player/dead/GM viewer masks with explicit player-viewer ids, but still lacks exact PHP layout and authenticated historical identity semantics.
- Reference vote output renders per-day vote tables, open-vote visibility, revote messages, and dead/spectator differences. Current room UI shows summary/action state, marks day voters and night action actors when vote-status is enabled without exposing hidden targets, adds a live spectator/dead vote-status panel derived from public `game_state`, and old logs now render historical vote tables by day/revote round with per-target vote totals, but exact PHP vote table layout variants are still not fully compatible.

## Rule Parity Findings

### Implemented or close

- Role deck for 8 to 30 players exists in `REFERENCE_ROLE_DECKS`.
- Core phases: lobby, day, night, ended.
- Day vote, revote on tie, authority vote weight, decider tie handling.
- Night kill, seer, child fox, guard, cat revive.
- Poison/cat linked deaths, lover linked deaths, betrayer linked deaths.
- Winners: villagers, werewolves, foxes, lovers.
- Private channels: wolf, fox, common, lovers, dead, GM, GM whisper; GM can toggle common voice visibility and persist `chdis` restrictions for wolf/common/lovers/fox channels during active games, and room summaries render those restrictions as option markers.
- Dead role visibility and end-game role reveal.
- Last words and dummy boy first night.
- D1 final records and player stats after game end.

### Still missing or weak

- `game_functions.php` has additional visibility branches for many system talk locations. Current implementation has equivalent permission checks for channels but not full transcript parity.
- `game_functions.php` victory logic includes special handling around lover-only victory and heavy wolf / fox edge cases. The rule manifest now maps implemented winner branches to focused tests; more reference scenarios may still need mapping as discovered.
- Reference `game_vote.php` assigns wishes by removing available wished roles from the current role list, then assigning leftovers. Current assignment now does this for core roles and enabled optional roles; exact reference random ordering and conflict priority remain only partially mapped.
- Reference `cult` image filenames are used for the `betr` / `背德` role in this build; `docs/reference-betrayer-cult-extraction.md` maps that evidence to the implemented `betrayer` role and no separate cult rule path has been found.
- Reference has objection/sound/revote SWF paths and cookie-driven sound notifications. Current port implements the objection command, count limit, persisted/broadcast notification, and optional browser beep for objection, phase/day changes, revotes, and sudden-death warnings instead of legacy SWF playback.
- Reference has silence/sudden-death checks in `game_play.php` flow. Current DO state now applies non-realtime silence acceleration when conversation resumes after the silence threshold; the DO alarm emits the reference-style final 2-minute warning, then sudden-deaths timed-out day voters and required night actors, resets action maps, and starts another same-phase deadline.
- Reference `GM_CHANNEL` can adjust several channel restrictions. Current GM controls cover kill, revive, role, flag, phase, winner declaration, whispers, common voice visibility, and the `chdis:ch_wolf:ch_common:ch_lovers:ch_fox` restriction matrix; exact PHP self-talk rerouting presentation and broader admin-management screens are still not fully mapped.
- Reference has resident exit/reset vote handling while waiting. Current lobby kick exists, players can voluntarily leave the lobby resident list with host reassignment, resident start votes follow the reference 8-player minimum before auto-starting, and 5 resident kick votes remove a target while resetting lobby votes; remaining reset semantics may still differ from PHP.
- Reference has manual/auto refresh spectator view. Current app is realtime only.

## Next Concrete Work Items

1. Continue improving `/room/:roomId/log` toward PHP-compatible viewer-specific transcript masking; day/phase grouping, historical vote tables, private talk/action transcript persistence, self-talk, old-log heaven/reverse display modes, and major per-location styling are now in place.
2. Continue converting the remaining partial/missing rows in `docs/rule-parity-manifest.md` into focused tests and implementation slices.
3. Run `docs/visual-parity-checklist.md` and attach screenshots once a browser is available in the environment.
4. Continue reducing remaining legacy menu/page gaps; the room-admin end screen exists, but other PHP-era server management pages are still not mapped.

## Current Verification Gaps

- No Playwright/browser E2E is installed or runnable in the current environment; `chromium`, `chromium-browser`, `google-chrome`, and `chrome` were not found.
- Local rendered UI smoke verifies HTTP-rendered pages but does not execute browser JavaScript.
- `docs/visual-parity-checklist.md` now defines the manual/browser evidence pass, but no screenshot baseline exists against the reference PHP UI.
