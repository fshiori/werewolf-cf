# Rule Parity Manifest

Date: 2026-05-06

Reference target: `ref/diam1.3.61.kz_Build0912`

Purpose: map the PHP rule surface to the current Cloudflare TypeScript implementation and tests. This is a tracking artifact; it records rule coverage and known gaps without copying or modifying reference files.

## Status Key

- Implemented: covered by implementation and focused automated tests.
- Partial: implemented for the main path, but PHP has additional branches, presentation variants, or edge cases still unmapped.
- Missing: no equivalent implementation yet.

## Prompt-To-Artifact Checklist

| Reference area | PHP source | TypeScript artifact | Test evidence | Status | Notes / remaining work |
| --- | --- | --- | --- | --- | --- |
| Role deck thresholds | `game_functions.php`, `room_manager.php` | `src/game.ts` `REFERENCE_ROLE_DECKS`, `startGame` | `tests/game.test.ts` role deck tests for 3/5/6/7/8/13/15 players plus large-player count snapshots for 16/20/23/25/28/30 players | Implemented | Core threshold and large deck counts are pinned; add more snapshots only if a future PHP extraction finds variant decks. |
| Optional roles: poison, big wolf, authority, decider, lovers, betrayer, child fox, two foxes, cat | `room_manager.php`, `game_functions.php` | `src/game.ts` `applyRoomOptions` | `tests/game.test.ts` option tests for poison, big wolf, authority/decider, lovers, betrayer, child fox, two foxes, cat | Implemented | `docs/reference-betrayer-cult-extraction.md` records that the reference `cult` image names are used for the `betr` / `背德` role, not a separate playable cult role. |
| Wish role | `user_manager.php`, `game_vote.php` | `src/game.ts` wish-role handling in `startGame`; `src/validation.ts` optional-role wish validation; `src/render.ts` room wish-role selector | `tests/game.test.ts` core and enabled optional-role wish tests; `tests/validation.test.ts` wished-role validation; `tests/render.test.ts` wish selector options | Partial | Core and enabled optional-role preferences exist; PHP-era exact random ordering and priority behavior still needs deeper extraction. |
| Dummy boy first night | `game_play.php`, `game_functions.php` | `src/game.ts` dummy player and first-night target rule | `tests/game.test.ts` dummy-boy first-night test; `tests/room.test.ts` dummy status sync test | Implemented | Includes custom dummy name and last words. |
| Day vote, revote, authority, decider, self-vote | `game_play.php`, `game_functions.php` | `src/game.ts` `castDayVote`, `resolveDay`, vote target helpers; `src/room-client.ts` live observer/dead vote panel | `tests/game.test.ts` authority, decider, self-vote, day-to-night, revote tests; `tests/room.test.ts` vote validation tests; `tests/render.test.ts` observer/dead vote panel artifact checks | Implemented | Exact PHP vote table layout variants remain a visual parity gap. |
| Open vote and vote status visibility | `game_functions.php` vote output | `src/messages.ts`, `src/room-client.ts`, `src/render.ts` | `tests/messages.test.ts` vote mappings/status tests; `tests/render.test.ts` voted player styling and observer/dead vote panel tests | Partial | Public message privacy and live observer/dead status are covered; exact PHP vote table variants remain partial. |
| Night kill | `game_play.php`, `game_functions.php` | `src/game.ts` `castNightKill`, `resolveNight` | `tests/game.test.ts` wolf-only, fox attack, poison kill, big wolf, dummy tests; `tests/room.test.ts` night kill validation/persistence tests | Implemented | Includes target aggregation and dummy first-night restriction. |
| Seer and big wolf divination | `game_play.php`, `game_functions.php` | `src/game.ts` `castDivination`, `divinationResultForRole` | `tests/game.test.ts` seer, big wolf odds, fox death/last words tests; `tests/room.test.ts` seer websocket completion tests | Implemented | Random odds are pinned with deterministic random values. |
| Child fox divination | `game_play.php`, `game_functions.php` | `src/game.ts` `castChildFoxDivination`, `childFoxDivinationResult` | `tests/game.test.ts` child fox action and child-fox fox-win tests; `tests/room.test.ts` child fox websocket completion tests | Implemented | Failure odds are deterministic in focused tests. |
| Guard | `game_play.php`, `game_functions.php` | `src/game.ts` `castGuard`, guarded night resolution | `tests/game.test.ts` guard role and protected kill tests; `tests/room.test.ts` guard authorization/persistence tests | Implemented | Consecutive target restrictions are not modeled unless a future PHP extraction shows them in this build. |
| Cat revive and cat survival | `game_play.php`, `game_functions.php` | `src/game.ts` `castCatRevive`, `pickCatRevival`, cat attack survival | `tests/game.test.ts` cat option, cat revive/survival/poison tests; `tests/room.test.ts` cat action authorization/persistence tests | Implemented | Random odds are pinned with deterministic random values. |
| Poison and linked deaths | `game_functions.php` victory/death helpers | `src/game.ts` `resolveDay`, `resolveNight`, `applyLinkedDeaths` | `tests/game.test.ts` poison execution, poison night kill, cat-as-poison, lover/betrayer linked-death tests | Implemented | Exact random target selection is deterministic in tests. |
| Win conditions: villagers, wolves, foxes, lovers | `game_functions.php` victory helpers | `src/game.ts` `determineWinner`, `withWinOrNextDay` | `tests/game.test.ts` wolf win, fox win, child-fox fox win, lovers both-survive win, one-lover non-win, big-wolf counting tests | Implemented | Additional rare PHP edge cases can be added as discovered. |
| Last words | `game_play.php`, `game_functions.php` | `src/game.ts` `setLastWords`, death logs; `src/room.ts` websocket handler | `tests/game.test.ts` last words after execution/night/fox death; `tests/room.test.ts` websocket last-words tests | Implemented | UI presentation is current-port style, not exact PHP layout. |
| Objection | `game_play.php`, SWF notification paths | `src/game.ts` `raiseObjection`; `src/room-client.ts` browser beep | `tests/game.test.ts` objection limits; `tests/room.test.ts` objection persistence; `tests/render.test.ts` sound controls | Partial | Command and browser beep exist; SWF/cookie sound parity is intentionally not exact. |
| Private channels: wolf, fox, common, lovers, dead, self-talk | `game_play.php`, `game_functions.php` talk locations | `src/game.ts` channel guards; `src/room.ts` filtered broadcasts and transcript persistence | `tests/game.test.ts` channel permission tests; `tests/room.test.ts` private broadcast, common voice, dead chat, self-talk tests | Implemented | Viewer-specific old-log masking remains partial. |
| GM controls and whispers | `game_play.php`, `game_vote.php` `GMVote`, admin/GM paths | `src/room.ts`, `src/game.ts` force controls and common-voice channel toggle; `src/room-client.ts` GM controls | `tests/game.test.ts` force-end/role/life/flag/channel tests; `tests/room.test.ts` GM websocket, whisper, and channel-toggle tests | Partial | Core controls and the common voice channel toggle exist; full legacy `GM_CHANNEL` wolf/common/lovers/fox restriction matrix and admin screens remain partial. |
| Timed phases, silence, sudden death | `game_play.php` flow checks | `src/game.ts` alarms, silence acceleration, warning/death handling; `src/messages.ts` warning timestamp; `src/room-client.ts` phase/revote/warning beep | `tests/game.test.ts` timer defaults, silence acceleration, realtime no-acceleration, sudden-death warnings; `tests/room.test.ts` DO alarm tests; `tests/messages.test.ts` warning timestamp; `tests/render.test.ts` state sound hooks | Implemented | Legacy SWF/cookie playback remains intentionally not exact. |
| Lobby start, leave, kick votes | `user_manager.php`, `game_vote.php`, `room_manager.php` resident handling | `src/game.ts` lobby vote/leave/kick helpers, reference 8-player resident-start minimum; `src/room.ts` websocket commands | `tests/game.test.ts` lobby host/start/kick/leave and start-vote minimum tests; `tests/room.test.ts` websocket lobby start/kick/leave tests | Partial | Current implementation covers resident start/kick/leave and the reference start-vote minimum; remaining PHP reset-vote nuances still need deeper mapping. |
| D1 records and player stats | `game_functions.php` old log/stat paths | `src/room.ts` `syncRoomStatus`, `src/index.ts` record/stat routes | `tests/room.test.ts` final record/stat sync; `tests/index.test.ts` records/profile/leaderboard tests | Implemented | Database writes are batched at game end as required by the Cloudflare port constraints. |
| Betrayer/cult asset naming | `setting.php`, `index.php`, `game_functions.php`, `game_vote.php`, `lang/jpn/rule.php` | `src/types.ts` `betrayer`; `src/game.ts` `applyRoomOptions`, linked deaths; `src/render.ts`, `src/room-client.ts` role icon/label | `tests/game.test.ts` betrayer option and linked-death tests; `tests/render.test.ts` betrayer label/icon tests; `docs/reference-betrayer-cult-extraction.md` | Implemented | Reference `role_cult.gif`/`role_cult_partner.gif` are assigned to `$role_betr_image`; no separate cult rule path was found in this build. |
| Viewer-specific transcript masking | `game_functions.php` talk output branches | `src/index.ts` private-event filtering and transcript viewer query validation; `src/render.ts` transcript grouping/styling plus `viewer=public/player/dead/gm` masks | `tests/index.test.ts` private event hidden until ended and transcript viewer query tests; `tests/render.test.ts` transcript location styling and viewer-mode filtering | Partial | Additive viewer modes now cover public, own-player private, dead/heaven, and GM transcript perspectives; exact PHP layout/identity authentication remains partial. |
| Visual/browser parity | `game_view.php`, `game_play.php`, `index.php` | `src/render.ts`, `src/room-client.ts`, `docs/visual-parity-checklist.md` | `scripts/smoke-local-ui.mjs`, `tests/local-ui-smoke.test.mjs` | Partial | Manual/browser capture matrix exists; no browser or screenshot baseline is available in this environment. |

## Verification Gates

Current parity work should continue to pass:

- `npm test`
- `npm run typecheck`
- `npm run check:wrangler`
- `npm run check:whitespace`
- `npm run check:d1-schema`

## Next Rule Work

1. Add focused tests for any newly discovered victory edge cases from `game_functions.php`.
2. Decide whether viewer-specific old-log masking should be implemented as separate endpoints/modes or as parameters on `/room/:roomId/log`.
3. Run `docs/visual-parity-checklist.md` and add screenshot-based UI parity once a browser is available.
