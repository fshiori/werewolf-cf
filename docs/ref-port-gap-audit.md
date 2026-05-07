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
| KV runtime config | `/api/config`, `/status`, `getHomeAnnouncement`, `isMaintenanceMode`; `/status` renders reference-style health markers for overall, maintenance, and binding states | Implemented |
| Rendered non-JSON pages | `/`, `/list`, `/logs`, `/bbs`, `/admin`, `/admin/bbs`, `/admin/rooms`, `/admin/config`, `/trip`, `/trips`, `/room/:id`, `/leaderboard`, `/stats`, `/icons`, `/status`, `/room/:id/records`, `/room/:id/events`, `/player/:id`, `/rules`, `/manual`, `/script-info`, `/protocol`, `/version`; PHP-style aliases `/index.php`, GET `/room_manager.php`, `/list.php`, `/old_log.php`, `/bbs.php`, `/icon_view.php`, `/icon_upload.php`, `/rule.php`, `/script_info.php`, `/stats.php`, `/trip.php`, `/trip.php?go=icon`, `/version.php`, `/admin.php`, `/admin.php?go=rooms`, `/admin.php?go=config`, `/admin.php?go=bbs`, `/admin.php?go=del&id=:id`, `/game_log.php?room_no=:id`, `/game_view.php?room_no=:id`, `/game_play.php?room_no=:id`, `/game_play.php?go=del&id=:id&room_no=:id`, `/game_frame.php?room_no=:id`, `/game_up.php?room_no=:id`, GET `/game_vote.php?room_no=:id`, `/login.php?room_no=:id`, `/user_manager.php?room_no=:id` | Implemented |
| Room page client script not inline | `/assets/room-client.js`, `src/room-client.ts`, local UI smoke | Implemented |
| Reference top/menu visual style | Table layout, side menu, fieldsets, colors, reference top title/background asset URLs, and PHP-style home room-entry links in `src/render.ts` | Partial |
| Reference room player grid visual style | `renderRoom`, `.player-card`, `.player-icon`, role/death/vote styling; client emits reference role icons and colored role text for revealed roles plus grave fallback for dead players; PHP-style live room/login/resident aliases route into the same room renderer with spectator/player view defaults | Partial |
| Reference chat/log/death/vote sections | Room page has chat/game log/records/events, a live public last-words panel, and public/private channel/action events, including objection notifications and player leave events, persist to `room_events`; private transcript entries are hidden from `/events` and `/log` until the room status is ended | Partial |
| Reference icons and bitmap assets | R2 upload exists; `docs/reference-asset-inventory.md` classifies 130 reference assets; `/assets/reference/:path` serves vetted copied R2 assets; top chrome, home/admin/federated room-list status/options, old-log title/background/capacity/options/victory rows, icon catalog/upload title/background chrome, rules role rows, live/profile/transcript/room-record role markers, and game-record victory rows emit reference image URLs with text fallback | Partial |
| Browser E2E/manual visual verification | Local HTTP UI smoke plus `docs/visual-parity-checklist.md` capture plan; no installed browser detected | Partial |
| Screenshot/visual parity against ref | `docs/visual-parity-checklist.md` defines the capture matrix and evidence paths; no screenshot baseline has been generated | Missing |
| Complete PHP rule parity | `docs/rule-parity-manifest.md` maps PHP rule areas to TypeScript artifacts and focused tests; core roles/options implemented; focused tests cover lover-only normal wins, one-lover non-wins, big-wolf win counting, child-fox fox wins, vote visibility, non-realtime silence acceleration, timed sudden-death warning windows, and timed sudden-death alarm handling | Partial |
| Federated room list (`list.php`) | `/list` renders a reference-style federated list from local D1 rooms and optional remote peers configured by KV `federated_servers`, including reference status icons, PHP-style local `login.php?room_no=:id` room links, main-table peer service rows with `服務中`/`失聯中` plus configured peer names, and peer health markers; configured peer status is shown, including failed peers; `/api.php` emits a reference-style tab-separated active-room feed for legacy federated consumers, and configured peers can fall back from JSON `/api/rooms` to legacy `/api.php` TSV feeds | Partial |
| Discussion board (`bbs.php`) | `/bbs` and `/bbs.php` render a reference-style topic list with pinned/locked/digest status markers, legacy `bbs.php?go=post`/`bbs.php?go=dige` subnavigation, digest-topic list linked from the side menu, paginated topic lists, topic titles linked through `bbs.php?view=:id` to the latest reply page, topic detail views via `/bbs.php?view=:id`, legacy `/bbs.php?go=postre&id=:id`, legacy `/bbs.php?go=edit&id=:id`, and `/bbs/:id`, paginated replies, post form, reply form, locked-topic no-reply notice, and topic moderation panel backed by D1 `bbs_topics`/`bbs_replies`; topic/reply forms accept optional edit/delete passwords and store hashes in D1; topic and reply content can be edited by either BBS admin token or matching post password; topics and replies can be deleted by either BBS admin token or matching post password while maintaining reply counts; JSON topic creation returns the D1 topic id, and legacy `POST /bbs.php?go=post` accepts reference `bname`/`bpass`/`title`/`mess` fields before redirecting to `bbs.php?view=:id`; the rendered topic list also exposes a reference-field legacy post form for the same handler; JSON reply creation returns the target page, and legacy `POST /bbs.php?go=postre` accepts reference `id`/`bname`/`bpass`/`mess` fields before redirecting to the paginated `bbs.php?view=:id` topic page; the rendered topic detail also exposes a reference-field legacy reply form and PHP-style list links for the same handler; legacy `POST /bbs.php?go=edit&id=:id` accepts reference `editis`/`password` form operations for topic edit/delete, reply edit/delete, and admin-only topic lock/pin/digest toggles before redirecting through `bbs.php?view=:id`; the rendered moderation panel exposes the same legacy edit/delete/lock/pin/digest operation selector; `/admin/bbs` lists paginated topics with the same status markers and links to token-protected moderation controls that can pin, lock, mark digest, edit topic/reply content, delete topics with their replies, and delete individual replies while maintaining reply counts | Partial |
| Icon catalog/upload parity | `/icons` renders the reference default icon catalog with icon-view/upload title and background image chrome, PHP-style `icon_view.php`/`icon_upload.php` crosslinks, local default-icon picker controls, R2 avatar upload/remove controls, and direct legacy `upload.php`/`upload2.php` forms; room join can send a vetted default `iconPath`; avatar upload exists on room and icon pages; legacy `upload.php` and `upload2.php` POST aliases reuse the same validated R2 avatar handlers and accept reference-style form field names | Partial |
| Old logs (`old_log.php`) | `/logs` and `/old_log.php` render a reference-style ended-room index with legacy `old_log.php?all=1`, `old_log.php?search=:term` search filtering, latest game-record victory icons, and `old_log.php?log_mode=on&room_no=:id` normal/reverse/heaven links plus max-player/option icons; `/room/:roomId/records`, `/room/:roomId/log`, `/old_log.php?log_mode=on&room_no=:id`, and `/game_log.php?room_no=:id` render D1 game records with role-icon player result rows; room record/event/transcript headers link back through `game_view.php?room_no=:id`, and record/event headers link `game_log.php?room_no=:id&log_mode=on`; `/room/:roomId/log` and the PHP-style `old_log.php`/`game_log.php` aliases also render day/phase transcript sections, historical vote tables grouped by day/revote round with aggregate and per-ballot target counts, PHP-style `N 日目 ( M 回目)` vote headings, bordered zero-spacing vote table attributes, bold voter/target cells, reference-inspired vote-table coloring, location labels/colors for public/private/system/action rows, `heaven_talk`/`heaven_only`/`reverse_log` display modes, state-preserving `old_log.php`/`game_log.php?log_mode=on` header aliases, a reference-style old-log return link, and additive `viewer=public/player/dead/gm` masking modes with visible scope labels, player-view links/selectors, own private rows, addressed GM whispers, and saved-role-derived same-team wolf/fox/common/lovers channel rows; private entries are visible only after the room ends | Partial |
| Trip identity parity | `/trip` and `/trip.php` provide reference-style identity registration, claim, exclusion, and lookup controls with status markers, legacy subnavigation, plus legacy form actions for Trip registration and record exclusion; `/trips` and `/api/trips/lookup` provide public lookup with registered/excluded status markers, claimed players, and aggregate stats without exposing Trip hashes; legacy `trip.php?go=trip&id=:trip` renders a server-side public Trip detail table without exposing stored hashes and links to the matching `trip.php?go=room&id=:trip` participation table; legacy `trip.php?go=room&id=:trip` renders server-side participation records from claimed player game records without exposing stored hashes, exposes the reference `全部/8/16/22/30` capacity filter links, applies valid `play=8/16/22/30` filters against room capacity, and links room ids to `old_log.php?log_mode=on&room_no=:id` like the reference table; legacy `trip.php?go=icon` opens the shared reference-style icon catalog/upload flow; legacy `POST /trip.php?go=post` accepts reference `name`/`password` fields for Trip registration and legacy `POST /trip.php?go=out` accepts reference `name`/`password`/`aname` fields for Trip exclusion before redirecting to `/trip.php` | Partial |

## UI Parity Findings

### Implemented or close

- Top page uses a reference-like table shell, side menu, fieldsets, room list, announcement, and create-room form.
- Room creation covers max users, comments, real-time timing, wish role, Trip-required, GM, dummy boy, last words, open vote, common voice, dead role visibility, self-vote, vote-status, and major optional roles; the room join selector and assignment path now support enabled optional-role wishes with PHP-style randomized conflict ordering. `docs/reference-wish-role-extraction.md` records the implemented ordering behavior and the intentional rejection of the PHP loose-comparison quirk.
- Room page uses retro table panels for header, player list, actions/votes, public last words, chat, logs, records, and events.
- Room page now loads client logic through `/assets/room-client.js` instead of embedding the whole WebSocket client in the HTML.
- `/admin` now provides a reference-style management menu linking room administration, BBS topic management, runtime configuration, and status checks while leaving each admin write tool token-protected; rendered admin subtool links use PHP-style `admin.php?go=rooms`, `admin.php?go=config`, and `admin.php?go=bbs` aliases while the modern `/admin/...` URLs remain accepted. It also exposes a legacy `admin.php?go=in` form using the reference `adpass` field and redirects legacy logout `admin.php?go=out` back to the admin index. `/admin/rooms` and `admin.php?go=rooms` provide a KV-token-protected reference-style `廢村管理` list with active/ended/all filters, room comments, capacity, option context, `game_view.php?room_no=:id` room links, `game_log.php?room_no=:id&log_mode=on` log links, modern diagnostic event links, ended-room inspection, direct legacy `admin.php?go=del&id=:id` end links, and D1-backed room-ending action for active rooms; legacy `admin.php?go=del&id=:id` and `game_play.php?go=del&id=:id&room_no=:id` links reuse the same room-admin token and end-room mutation before redirecting back to room administration; `/admin/config` and `admin.php?go=config` provide token-protected KV announcement and maintenance-mode controls; `/admin/bbs` and `admin.php?go=bbs` provide BBS topic administration.

### Still missing or weak

- Reference uses bitmap title/background/role/status/option/victory images such as `img/top_title.jpg`, `img/top_bg.jpg`, `img/playing.gif`, `img/waiting.gif`, role images, option icons, and victory result images. Current top chrome, home/federated/old-log room-list status/capacity/option rows, rules role rows, old-log and player-profile result rows, revealed live-room role markers, dead fallback, and game-record victory rows now emit copied R2 asset URLs while keeping text fallback.
- Reference menu includes `聯合列表`, script info, old logs, icon view/upload, win-rate analysis, BBS, digest articles, Trip registration, and manual/help-style navigation. Current menu, script-info related-page links, manual/help navigation, federated list, admin entry, and home room rows have the core app pages using PHP-style aliases for the matching legacy page filenames, `admin.php` management entry, and `login.php?room_no=:id` active-room entry links, a configurable federated-list page, an old-log index/detail flow, script info, win-rate analysis, separate icon catalog/upload menu links backed by the combined icon page, Trip registration/lookup, BBS topic/reply and digest views, a dedicated manual page, and a management-menu entry for the token-protected room/config/BBS admin tools, but not every legacy management page.
- Reference room view has phase-specific body colors, manual/auto refresh links, login/resident registration links, and different layouts for spectator/player/heaven modes. Current room page now applies reference-style lobby/day/night/ended body colors as realtime state changes, includes manual/auto refresh controls for auxiliary panels, exposes PHP-style page reload links with 15/20/30-second meta refresh options, shows reference-style resident/Trip registration and icon-catalog links, and has direct `view=player/spectator/heaven` page modes with preserved reload links and mode-specific player-only row visibility, but still shares one realtime WebSocket layout rather than fully separate frame-era templates.
- Reference player list includes default icons, hover image swap, Trip links, role reveal text colors, already-voted background, and dead icon handling. Current player cards now emit selected default icons, reference role icons and colored text for revealed roles, profile links from nicknames, public Trip lookup links, already-voted backgrounds, a grave icon for dead players, and reference-style dead-icon hover swap back to the selected default icon, but still do not expose raw Trip hashes in live state.
- Reference talk log has many location-specific render paths: public day, night wolf, common, lovers, fox, self talk, heaven, GM broadcast/whisper, system action visibility, and post-game/dead visibility. Current WebSocket channels cover the major private channels plus night self-talk, and public/private transcript entries are persisted with room-status visibility filtering; `/room/:id/log` groups replay entries by day/phase, labels/styles major locations and role-action rows, includes PHP-shaped self-talk speaker labels and `GM → 目標` whisper labels, includes GM channel-control operations as system-visible transcript rows, supports old-log heaven/reverse display modes with state-preserving viewer links, and now has additive public/player/dead/GM viewer masks plus record/event-derived player-view selectors that include event targets. Player-view masks include the player’s own private rows, GM whispers addressed to that player, and saved-role-derived same-team wolf/fox/common/lovers channel rows, but still lack exact PHP layout and broader authenticated historical identity semantics.
- Reference vote output renders per-day vote tables, open-vote visibility, revote messages, and dead/spectator differences. Current room UI shows summary/action state, marks day voters and night action actors when vote-status is enabled without exposing hidden targets, adds a live spectator/dead vote-status panel derived from public `game_state`, and old logs now render historical vote tables by day/revote round with aggregate totals, per-ballot target-count columns, and reference-inspired vote-table row colors, but exact PHP vote table styling variants are still not fully compatible.

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
- Reference `game_vote.php` assigns wishes by removing available wished roles from the current role list in randomized user order, then assigning leftovers. Current assignment now does this for core roles and enabled optional roles, including duplicate-wish conflict priority; the PHP loose-comparison index-0 quirk is intentionally not reproduced.
- Reference `cult` image filenames are used for the `betr` / `背德` role in this build; `docs/reference-betrayer-cult-extraction.md` maps that evidence to the implemented `betrayer` role and no separate cult rule path has been found.
- Reference has objection/sound/revote SWF paths and cookie-driven sound notifications. Current port implements the objection command, count limit, persisted/broadcast notification, and optional browser beep for objection, phase/day changes, revotes, and sudden-death warnings instead of legacy SWF playback.
- Reference has silence/sudden-death checks in `game_play.php` flow. Current DO state now applies non-realtime silence acceleration when conversation resumes after the silence threshold; the DO alarm emits the reference-style final 2-minute warning, then sudden-deaths timed-out day voters and required night actors, resets action maps, and starts another same-phase deadline.
- Reference `GM_CHANNEL` can adjust several channel restrictions. Current GM controls cover kill, revive, role, flag, phase, winner declaration, whispers, common voice visibility, PHP-shaped transcript labels for self-talk / GM whispers, and the `chdis:ch_wolf:ch_common:ch_lovers:ch_fox` restriction matrix; the admin menu now links filtered room inspection, D1-backed waste-room actions, BBS topic moderation entry points, runtime config, and status checks, while broader server-management screens are still not fully mapped.
- Reference has resident exit/reset vote handling while waiting. Current lobby kick exists, players can voluntarily leave the lobby resident list with host reassignment, resident start votes follow the reference 8-player minimum and dummy-boy vote credit before auto-starting, and direct/vote-based kicks remove a target while resetting lobby votes and appending reference-style kick/reset log entries; remaining reset semantics may still differ from PHP.
- Reference has manual/auto refresh spectator view. Current app is realtime-first and now exposes PHP-style room page reload links with 15/20/30-second meta refresh options and addressable player/spectator/heaven room view modes with spectator/heaven-specific layout rows, but still does not fully split those views into separate frame-era templates.

## Next Concrete Work Items

1. Continue improving `/room/:roomId/log` toward PHP-compatible viewer-specific transcript masking; day/phase grouping, historical vote tables, private talk/action transcript persistence, self-talk, old-log heaven/reverse display modes, player-view selectors, and major per-location styling are now in place.
2. Continue converting the remaining partial/missing rows in `docs/rule-parity-manifest.md` into focused tests and implementation slices.
3. Run `docs/visual-parity-checklist.md` and attach screenshots once a browser is available in the environment.
4. Continue reducing remaining legacy menu/page gaps; the admin index, legacy admin login/logout compatibility, and room-admin end screen exist, but other PHP-era server management pages are still not fully mapped.

## Current Verification Gaps

- No Playwright/browser E2E is installed or runnable in the current environment; `chromium`, `chromium-browser`, `google-chrome`, and `chrome` were not found.
- Local rendered UI smoke verifies HTTP-rendered pages but does not execute browser JavaScript.
- `docs/visual-parity-checklist.md` now defines the manual/browser evidence pass, but no screenshot baseline exists against the reference PHP UI.
