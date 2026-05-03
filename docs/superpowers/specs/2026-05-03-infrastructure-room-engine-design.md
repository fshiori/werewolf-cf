# Infrastructure Room Engine Design

Date: 2026-05-03
Branch: `feature/infrastructure-room-engine`

## Goal

Build the first vertical slice of the Werewolf Cloudflare port: infrastructure plus a minimal room connection flow. This slice must prove that Cloudflare Workers, Durable Objects, WebSockets, D1, R2, and KV are wired correctly before implementing the full game loop.

## Scope

This phase includes:

- A Cloudflare Workers TypeScript project.
- Minimal native HTML, CSS, and browser JavaScript served by the Worker.
- Durable Object based room authority.
- WebSocket join, presence, and chat flow.
- D1 schema and low-frequency room/player/event writes.
- Wrangler bindings for Durable Object, D1, R2, and KV.
- Basic validation and tests for the core room/message behavior.

This phase excludes:

- Formal accounts, passwords, Trip, or login.
- Role assignment, day/night phases, voting, execution, or victory detection.
- Private role channels such as werewolf-only chat.
- Avatar upload or asset management beyond R2 binding configuration.
- Deep UI parity with the PHP reference beyond a minimal retro table style.

## Architecture

`src/index.ts` is the Worker entry point. It owns HTTP routing, HTML/CSS/JS responses, low-frequency D1 writes for room creation and room listing, and delegation of room WebSocket requests to the room Durable Object.

Each room is represented by one `RoomDurableObject`. The Durable Object is the source of truth for live room state, including active WebSocket connections, current members, and recent chat messages. All WebSocket messages go through the Durable Object before any broadcast.

Wrangler bindings:

- `ROOM_DO`: Durable Object namespace for room instances.
- `DB`: D1 database for player, room, game record, and audit/event persistence.
- `ASSETS`: R2 bucket binding reserved for avatars or game assets in later phases.
- `CONFIG`: KV namespace binding reserved for runtime configuration in later phases.

## Data Model

Anonymous players are used for the first slice. The browser creates a `playerId` on first visit and stores it in `localStorage`. The user supplies a nickname when creating or joining a room. This identity is not a formal account.

D1 migrations create:

- `players`: anonymous player ID, nickname, creation time, and last seen time.
- `rooms`: room ID, room name, status, creation time, and update time.
- `game_records`: reserved for final game results in later phases.
- `room_events`: lightweight audit events such as room creation, joins, and chat metadata.

The Durable Object keeps live connection state in memory. D1 is used only for low-frequency writes. Chat delivery, presence updates, and future gameplay state should stay in the Durable Object during active play and be persisted at phase or game boundaries where appropriate.

## Routes

- `GET /`: Render the minimal room list and room creation page.
- `GET /api/rooms`: Return rooms currently known in D1.
- `POST /api/rooms`: Create a room, write it to D1, and return the room ID.
- `GET /room/:roomId`: Render the room page.
- `GET /ws/room/:roomId`: Upgrade to WebSocket and delegate to the room Durable Object.

## User Flow

1. A user opens `/`.
2. The browser ensures a `playerId` exists in `localStorage`.
3. The user enters a nickname and room name.
4. `POST /api/rooms` creates the room and redirects or navigates to `/room/:roomId`.
5. The room page opens a WebSocket to `/ws/room/:roomId`.
6. The browser sends a `join` message with `playerId` and `nickname`.
7. The Durable Object validates the message, binds that socket to the identity, and broadcasts presence.
8. Chat messages are validated, escaped, and broadcast to sockets in the same room.

Other users can join the same room from the room list.

## WebSocket Messages

Client to server:

- `join`: `{ "type": "join", "playerId": "...", "nickname": "..." }`
- `chat`: `{ "type": "chat", "text": "..." }`

Server to client:

- `joined`: confirms the current socket identity and room state.
- `presence`: broadcasts the current member list.
- `chat`: broadcasts a validated chat message.
- `error`: reports validation or protocol errors.

Unknown message types are rejected. A socket can bind to only one identity.

## Security And Validation

The Durable Object does not trust browser input. It validates:

- Room IDs against a fixed format.
- Initial `join` payload shape.
- Player ID shape.
- Nickname length and non-empty value.
- Chat text length and non-empty value.
- Message type allowlist.
- One identity per WebSocket.
- Room-local broadcasts only.

Chat text is escaped before it is sent to clients. Because this phase has no roles or secret channels, authorization is limited to room isolation and socket identity binding. Future role/private-channel rules will extend the same Durable Object authorization layer.

## UI

The first UI is intentionally small but should point toward the PHP reference style:

- HTML table based layout.
- Simple borders, compact spacing, and muted retro colors.
- Room list, room creation form, member list, and chat log.
- Native browser JavaScript without React or Vite.

This phase does not aim for full visual parity. Later UI work will analyze `ref/diam1.3.61.kz_Build0912` more deeply.

## Testing

Use Vitest for core logic. If direct Durable Object testing is too costly for this first phase, extract validation and message formatting into pure TypeScript modules and test them directly.

Minimum test coverage:

- Room ID validation.
- Player ID and nickname validation.
- Chat validation and escaping.
- Message parsing allowlist.
- Join and chat event formatting.

Manual verification:

- Start the local Worker with Wrangler.
- Open two browser tabs or clients.
- Create a room.
- Join from both clients.
- Confirm presence and chat broadcasts are room-local.

## Completion Criteria

This phase is complete when:

- The repository contains an installable TypeScript Workers project.
- `wrangler.toml` has D1, Durable Object, R2, and KV bindings.
- D1 migrations create the minimum schema.
- The required HTTP and WebSocket routes exist.
- Room Durable Object join, presence, and chat flows work locally.
- The minimal retro table UI can create and join rooms.
- Basic tests pass.
- Changes are committed on `feature/infrastructure-room-engine`.
- After review, the branch can be merged back to `main` with `--no-ff`.

