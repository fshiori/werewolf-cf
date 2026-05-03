# Retro UI Port Test Checklist

## Scope

This checklist verifies the retro table UI pass in `src/render.ts`.

Focus on browser rendering, layout stability, and confirming the existing room/game WebSocket flow still works after the UI rewrite.

## Environment

1. Confirm Node.js is `>=22.0.0`.
2. Run `npm install`.
3. Run `npm test`; expect all tests to pass.
4. Run `npm run typecheck`; expect no TypeScript errors.
5. Start the Worker with:

```sh
npm run dev -- --ip 127.0.0.1 --port 8787
```

6. Open `http://127.0.0.1:8787/`.

## Home Page Layout

1. Confirm the page title area shows `汝等是人是狼？`.
2. Confirm the left-side menu is visible and includes:
   - `首頁`
   - `房間 JSON`
   - `規則`
   - `版本`
3. Confirm the main content uses fieldset sections:
   - `伺服器公告`
   - `遊戲列表`
   - `建立村子`
4. Confirm the page visually resembles the reference PHP style:
   - white page background
   - blue links
   - green menu/header cells
   - table/fieldset-based layout
   - compact serif text
5. With no rooms, confirm the game list displays `目前沒有村子。`.

## Room Creation UI

1. Enter a nickname in `玩家暱稱`.
2. Enter a room name in `村子名稱`.
3. Click `建立房間`.
4. Expect navigation to `/room/<room_id>`.
5. Return to `/`.
6. Confirm the new room appears in `遊戲列表`.
7. Confirm the room row displays:
   - status badge
   - room ID in square brackets
   - room name ending with `村`
   - created time
   - `即時` option marker

## Room Page Layout

1. Open a room page.
2. Confirm the page is centered around an 800px table layout.
3. Confirm the header shows:
   - `[room_id] 汝等是人是狼？`
   - current phase
   - winner field
   - home link
   - nickname input
   - `進入房間`
   - `開始遊戲`
4. Confirm these sections render in order:
   - `玩家列表`
   - `能力發動 / 投票`
   - `發言`
   - `系統訊息`
5. Confirm there is no overlapping text or broken table nesting on desktop width.
6. Resize to a narrow/mobile viewport and confirm the page remains readable with normal scrolling.

## Join And Presence UI

1. Open the same room in 3 to 4 different browser profiles or private windows.
2. Enter distinct nicknames.
3. Click `進入房間` in each window.
4. Confirm `生存者` text updates in every window.
5. Confirm the `玩家列表` section renders player cards.
6. Confirm player cards show:
   - a square initial/icon cell
   - the player nickname
   - `(生存中)` for alive players
7. Confirm player cards wrap every 5 players without layout breakage.

## Chat UI

1. Send a normal chat message.
2. Confirm every window displays it in `發言`.
3. Send `<script>alert(1)</script>`.
4. Confirm it displays as escaped text and does not execute.
5. Confirm the chat log keeps the dashed-row retro styling.
6. Confirm the chat input and `送出` button remain usable after several messages.

## Game Flow Regression

1. Join with at least 3 players.
2. Click `開始遊戲`.
3. Confirm phase changes to `day 1`.
4. Confirm `開始遊戲` becomes disabled after the game starts.
5. Confirm each player sees their own role in `身分`.
6. Confirm public UI does not reveal other players' roles.
7. During day, vote by clicking player action buttons.
8. Confirm the game advances to `night` after all living players vote.
9. Confirm the executed player card changes to dead styling and shows `(死亡)`.
10. During night, confirm only werewolves can perform a valid night kill.
11. Confirm the game can advance to the next day or end with a winner.

## Visual State Checks

1. Confirm dead players use dark dead styling in the player list.
2. Confirm action buttons for dead players are disabled.
3. Confirm the winner field changes when the game ends.
4. Confirm system log messages appear in `系統訊息`.
5. Confirm long nicknames do not overlap adjacent player cards.
6. Confirm long chat text stays within the chat/log area without breaking the page.

## API And Persistence Smoke Checks

1. Request `GET /api/rooms`.
2. Confirm the created room appears with the expected status.
3. Start a game and confirm the room status changes to `playing`.
4. Finish a game and confirm the room status changes to `ended`.
5. Query local D1 `game_records` and confirm the final game result is persisted.

## Security Checks

1. Inspect WebSocket `game_state` messages and confirm player objects do not contain `role`.
2. Confirm only private `role` messages contain role data.
3. Manually send `night_kill` as a villager and expect rejection.
4. Manually send malformed JSON and expect an error message, not a crash.
5. Confirm no files under `ref/` were modified.

## Expected Result

The retro UI should visually follow the reference PHP layout style while preserving all previously tested room creation, WebSocket, game loop, authorization, and persistence behavior.
