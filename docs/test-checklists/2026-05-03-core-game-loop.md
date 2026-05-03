# Core Game Loop Test Checklist

## Automated Verification

1. Confirm Node.js is `>=22.0.0`.
2. Run `npm install`.
3. Run `npm test`; expect 4 test files and 18 tests to pass.
4. Run `npm run typecheck`; expect no TypeScript errors.
5. Run `git status --short --branch`; confirm the branch and that there are no unexpected changes.

## Local Worker Startup

1. Run `npm run dev -- --ip 127.0.0.1 --port 8787`.
2. Open `http://127.0.0.1:8787/`.
3. Confirm the home page renders in the retro table UI and includes nickname, room name, create room, and room list controls.

## Room Creation

1. Enter a nickname and room name on the home page.
2. Click `建立房間`.
3. Expect navigation to `/room/<room_id>`.
4. Return to the home page and confirm the new room appears with `lobby` status.

## WebSocket Join And Chat

1. Open the same room in 3 to 4 separate browser profiles or private windows.
2. Enter a different nickname in each window and click `進入房間`.
3. Expect the `生存者` list to show all joined players in every window.
4. Send a chat message from one player.
5. Expect every window to receive the message.
6. Send text such as `<script>alert(1)</script>`; expect escaped text to display and no HTML or JavaScript to execute.

## Game Start

1. Join with at least 3 players.
2. Click `開始遊戲`.
3. Expect every window to show phase `day 1`.
4. Confirm each player sees only their own role.
5. Confirm villagers do not see a werewolf list.
6. Confirm werewolves see their wolf partner list when applicable.
7. Confirm the room list status updates to `playing`.

## Day Voting

1. During `day`, have all living players click target players.
2. Expect the phase to move to `night` after all living players vote.
3. Expect the highest-vote player to be dead and rendered with strikethrough styling.
4. Force a tied vote; expect no player to die and the phase to move to `night`.
5. Confirm dead players cannot effectively vote.

## Night Kill

1. During `night`, have a villager try to click a player.
2. Expect no kill to happen, or expect an error message.
3. Have a werewolf click a living non-werewolf player.
4. Expect the phase to move to the next day after the required werewolf action count is met.
5. Expect the target player to be dead.
6. Have a werewolf attempt to target another werewolf; expect an error.

## Win Conditions

1. Create a game state where living werewolves are greater than or equal to living villagers.
2. Expect the game to end with winner `werewolves`.
3. Create a game state where all werewolves are dead.
4. Expect the game to end with winner `villagers`.
5. After the game ends, confirm the room list status updates to `ended`.
6. Confirm D1 `game_records` contains the final result.

## Alarm Phase Advancement

1. Start a game and do not vote during the day.
2. Wait for the day alarm.
3. Expect the day to resolve automatically and move to `night`.
4. Do not act during the night.
5. Wait for the night alarm.
6. Expect the game to move to the next day, or end if a win condition is met.

## Security Checks

1. Inspect public `game_state` WebSocket messages and confirm they do not include a `role` field.
2. Confirm only the individual player receives their own `role` message.
3. As a non-werewolf, manually send `{"type":"night_kill","targetPlayerId":"..."}` and expect the Durable Object to reject it.
4. Before joining, send `chat`, `vote`, or `night_kill`; expect `Join required`.
5. Send invalid `playerId`, empty nickname, and overlong chat text; expect errors and no Durable Object crash.
