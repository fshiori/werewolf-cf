# Infrastructure Room Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Cloudflare Workers vertical slice: D1-backed room creation/listing plus Durable Object WebSocket join, presence, and chat.

**Architecture:** The Worker handles HTTP routes, HTML responses, D1 room persistence, and WebSocket delegation. `RoomDurableObject` owns live room state and validates all socket messages before broadcasting. Validation, escaping, and message formatting live in pure TypeScript modules so the risky behavior is covered by fast Vitest tests.

**Tech Stack:** Cloudflare Workers, TypeScript, Durable Objects, WebSockets, D1, R2, KV, Wrangler, Vitest.

---

## File Structure

- Create `package.json`: npm scripts and dev dependencies.
- Create `tsconfig.json`: strict TypeScript config for Workers.
- Create `vitest.config.ts`: Vitest config.
- Create `worker-configuration.d.ts`: generated-style binding types used by app code.
- Create `wrangler.toml`: Worker name, compatibility date, DO/D1/R2/KV bindings, migrations.
- Create `migrations/0001_initial.sql`: D1 schema.
- Create `src/types.ts`: shared room, player, and WebSocket message types.
- Create `src/validation.ts`: room ID, player ID, nickname, room name, chat, JSON, and HTML escaping helpers.
- Create `src/messages.ts`: server message builders.
- Create `src/render.ts`: retro table HTML rendering for `/` and `/room/:roomId`.
- Create `src/room.ts`: `RoomDurableObject` implementation.
- Create `src/index.ts`: Worker router and exported Durable Object class.
- Create `tests/validation.test.ts`: validation and escaping tests.
- Create `tests/messages.test.ts`: message builder tests.
- Modify `README.md`: local development commands.

## Task 1: Project Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `worker-configuration.d.ts`
- Modify: `README.md`

- [ ] **Step 1: Create package scripts and dependencies**

Create `package.json`:

```json
{
  "name": "werewolf-cf",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260423.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4",
    "wrangler": "^4.14.4"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "worker-configuration.d.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Create Worker binding types**

Create `worker-configuration.d.ts`:

```ts
interface Env {
  ROOM_DO: DurableObjectNamespace<import("./src/room").RoomDurableObject>;
  DB: D1Database;
  ASSETS: R2Bucket;
  CONFIG: KVNamespace;
}
```

- [ ] **Step 5: Update README**

Replace `README.md` with:

```md
# werewolf-cf

Cloudflare Workers port of the Werewolf game.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```

Start local Worker:

```bash
npm run dev
```
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 7: Verify baseline tooling**

Run: `npm test`

Expected: Vitest starts and reports no test files or no tests yet.

Run: `npm run typecheck`

Expected: TypeScript reports missing source imports from `worker-configuration.d.ts`; this is acceptable until `src/room.ts` exists in Task 4.

- [ ] **Step 8: Commit tooling**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts worker-configuration.d.ts README.md
git commit -m "chore: add worker typescript tooling"
```

## Task 2: Wrangler And D1 Schema

**Files:**
- Create: `wrangler.toml`
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: Create Wrangler config**

Create `wrangler.toml`:

```toml
name = "werewolf-cf"
main = "src/index.ts"
compatibility_date = "2026-05-03"

[[durable_objects.bindings]]
name = "ROOM_DO"
class_name = "RoomDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDurableObject"]

[[d1_databases]]
binding = "DB"
database_name = "werewolf-cf"
database_id = "local-dev-placeholder"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "werewolf-cf-assets"

[[kv_namespaces]]
binding = "CONFIG"
id = "local-dev-placeholder"
```

- [ ] **Step 2: Create initial D1 migration**

Create `migrations/0001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS room_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  player_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_room_events_room_id ON room_events(room_id);
```

- [ ] **Step 3: Validate config**

Run: `npx wrangler --version`

Expected: Wrangler prints a version.

Run: `npm run typecheck`

Expected: TypeScript may still fail only because source files do not exist yet.

- [ ] **Step 4: Commit config and schema**

```bash
git add wrangler.toml migrations/0001_initial.sql
git commit -m "chore: add cloudflare bindings and d1 schema"
```

## Task 3: Validation And Message Modules

**Files:**
- Create: `src/types.ts`
- Create: `src/validation.ts`
- Create: `src/messages.ts`
- Create: `tests/validation.test.ts`
- Create: `tests/messages.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `tests/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  isRecord,
  parseClientMessage,
  validateChatText,
  validateNickname,
  validatePlayerId,
  validateRoomId,
  validateRoomName
} from "../src/validation";

describe("validation", () => {
  it("accepts generated room ids and rejects unsafe ids", () => {
    expect(validateRoomId("room_abc123XYZ")).toBe("room_abc123XYZ");
    expect(() => validateRoomId("../bad")).toThrow("Invalid room id");
  });

  it("accepts browser player ids and rejects empty ids", () => {
    expect(validatePlayerId("player_0123456789abcdef")).toBe("player_0123456789abcdef");
    expect(() => validatePlayerId("")).toThrow("Invalid player id");
  });

  it("normalizes nickname and room name", () => {
    expect(validateNickname(" Alice ")).toBe("Alice");
    expect(validateRoomName("  Test Room  ")).toBe("Test Room");
    expect(() => validateNickname("x".repeat(33))).toThrow("Nickname is too long");
    expect(() => validateRoomName("")).toThrow("Room name is required");
  });

  it("validates chat text", () => {
    expect(validateChatText(" hello ")).toBe("hello");
    expect(() => validateChatText("")).toThrow("Chat text is required");
    expect(() => validateChatText("x".repeat(501))).toThrow("Chat text is too long");
  });

  it("escapes html-sensitive characters", () => {
    expect(escapeHtml(`<b class="x">& hi</b>`)).toBe("&lt;b class=&quot;x&quot;&gt;&amp; hi&lt;/b&gt;");
  });

  it("parses only allowed client messages", () => {
    expect(parseClientMessage('{"type":"chat","text":"hi"}')).toEqual({ type: "chat", text: "hi" });
    expect(() => parseClientMessage("{bad")).toThrow("Invalid JSON");
    expect(() => parseClientMessage('{"type":"unknown"}')).toThrow("Unknown message type");
  });

  it("recognizes records", () => {
    expect(isRecord({ type: "chat" })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(["chat"])).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing message tests**

Create `tests/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildChatMessage, buildJoinedMessage, buildPresenceMessage } from "../src/messages";

describe("messages", () => {
  it("builds joined messages", () => {
    expect(buildJoinedMessage("room_abc", "player_1", [])).toEqual({
      type: "joined",
      roomId: "room_abc",
      playerId: "player_1",
      members: []
    });
  });

  it("builds presence messages", () => {
    expect(buildPresenceMessage([{ playerId: "player_1", nickname: "Alice" }])).toEqual({
      type: "presence",
      members: [{ playerId: "player_1", nickname: "Alice" }]
    });
  });

  it("builds escaped chat messages", () => {
    expect(buildChatMessage("player_1", "Alice", "<hello>")).toMatchObject({
      type: "chat",
      playerId: "player_1",
      nickname: "Alice",
      text: "&lt;hello&gt;"
    });
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `src/validation.ts`, `src/messages.ts`, and `src/types.ts` do not exist.

- [ ] **Step 4: Implement shared types**

Create `src/types.ts`:

```ts
export type RoomStatus = "lobby";

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: string;
}

export interface RoomMember {
  playerId: string;
  nickname: string;
}

export type JoinClientMessage = {
  type: "join";
  playerId: string;
  nickname: string;
};

export type ChatClientMessage = {
  type: "chat";
  text: string;
};

export type ClientMessage = JoinClientMessage | ChatClientMessage;

export type ServerMessage =
  | { type: "joined"; roomId: string; playerId: string; members: RoomMember[] }
  | { type: "presence"; members: RoomMember[] }
  | { type: "chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "error"; message: string };
```

- [ ] **Step 5: Implement validation helpers**

Create `src/validation.ts`:

```ts
import type { ClientMessage } from "./types";

const ROOM_ID_RE = /^room_[A-Za-z0-9_-]{3,64}$/;
const PLAYER_ID_RE = /^player_[A-Za-z0-9_-]{1,64}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRoomId(value: string): string {
  if (!ROOM_ID_RE.test(value)) {
    throw new Error("Invalid room id");
  }
  return value;
}

export function validatePlayerId(value: string): string {
  if (!PLAYER_ID_RE.test(value)) {
    throw new Error("Invalid player id");
  }
  return value;
}

export function validateNickname(value: string): string {
  const nickname = value.trim();
  if (nickname.length === 0) {
    throw new Error("Nickname is required");
  }
  if (nickname.length > 32) {
    throw new Error("Nickname is too long");
  }
  return nickname;
}

export function validateRoomName(value: string): string {
  const roomName = value.trim();
  if (roomName.length === 0) {
    throw new Error("Room name is required");
  }
  if (roomName.length > 48) {
    throw new Error("Room name is too long");
  }
  return roomName;
}

export function validateChatText(value: string): string {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error("Chat text is required");
  }
  if (text.length > 500) {
    throw new Error("Chat text is too long");
  }
  return text;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseClientMessage(raw: string): ClientMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("Invalid message");
  }

  if (parsed.type === "join") {
    if (typeof parsed.playerId !== "string" || typeof parsed.nickname !== "string") {
      throw new Error("Invalid join message");
    }
    return { type: "join", playerId: parsed.playerId, nickname: parsed.nickname };
  }

  if (parsed.type === "chat") {
    if (typeof parsed.text !== "string") {
      throw new Error("Invalid chat message");
    }
    return { type: "chat", text: parsed.text };
  }

  throw new Error("Unknown message type");
}
```

- [ ] **Step 6: Implement message builders**

Create `src/messages.ts`:

```ts
import type { RoomMember, ServerMessage } from "./types";
import { escapeHtml } from "./validation";

export function buildJoinedMessage(roomId: string, playerId: string, members: RoomMember[]): ServerMessage {
  return { type: "joined", roomId, playerId, members };
}

export function buildPresenceMessage(members: RoomMember[]): ServerMessage {
  return { type: "presence", members };
}

export function buildChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildErrorMessage(message: string): ServerMessage {
  return { type: "error", message };
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test`

Expected: PASS for validation and messages.

Run: `npm run typecheck`

Expected: May still fail only because `src/room.ts` does not exist.

- [ ] **Step 8: Commit validation modules**

```bash
git add src/types.ts src/validation.ts src/messages.ts tests/validation.test.ts tests/messages.test.ts
git commit -m "feat: add room message validation"
```

## Task 4: Worker Routes, Durable Object, And UI

**Files:**
- Create: `src/render.ts`
- Create: `src/room.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Implement retro HTML rendering**

Create `src/render.ts`:

```ts
import type { RoomSummary } from "./types";
import { escapeHtml } from "./validation";

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 12px; background: #eee8d8; color: #2b2118; font: 14px "Times New Roman", "Noto Serif TC", serif; }
    table { border-collapse: collapse; width: 100%; max-width: 920px; margin: 0 auto 12px; background: #fffaf0; }
    th, td { border: 1px solid #7d6b58; padding: 6px 8px; vertical-align: top; }
    th { background: #c9b89a; color: #24190f; }
    input, button { font: inherit; border: 1px solid #7d6b58; background: #fffdf6; padding: 4px 6px; }
    button { background: #d8c7a6; cursor: pointer; }
    a { color: #4f3622; }
    #chatLog { height: 280px; overflow: auto; background: #fffdf6; }
    .muted { color: #6c6258; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function renderHome(rooms: RoomSummary[]): string {
  const roomRows = rooms.length === 0
    ? `<tr><td colspan="4" class="muted">目前沒有房間。</td></tr>`
    : rooms.map((room) => `<tr>
      <td><a href="/room/${escapeHtml(room.id)}">${escapeHtml(room.name)}</a></td>
      <td>${escapeHtml(room.status)}</td>
      <td>${escapeHtml(room.createdAt)}</td>
      <td>${escapeHtml(room.id)}</td>
    </tr>`).join("");

  return page("Werewolf CF", `
    <table>
      <tr><th colspan="2">汝等是人是狼？</th></tr>
      <tr>
        <td style="width: 160px;">玩家暱稱</td>
        <td><input id="nickname" maxlength="32"></td>
      </tr>
      <tr>
        <td>房間名稱</td>
        <td><input id="roomName" maxlength="48"> <button id="createRoom">建立房間</button></td>
      </tr>
    </table>
    <table>
      <tr><th>房間</th><th>狀態</th><th>建立時間</th><th>ID</th></tr>
      ${roomRows}
    </table>
    <script>
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      const nick = localStorage.getItem("werewolf_cf_nickname") || "";
      document.querySelector("#nickname").value = nick;
      document.querySelector("#createRoom").addEventListener("click", async () => {
        const nickname = document.querySelector("#nickname").value;
        const name = document.querySelector("#roomName").value;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, playerId: localStorage.getItem(playerKey), nickname })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "建立房間失敗");
          return;
        }
        location.href = "/room/" + data.roomId;
      });
    </script>
  `);
}

export function renderRoom(roomId: string): string {
  return page(`Room ${roomId}`, `
    <table>
      <tr><th colspan="2">房間 ${escapeHtml(roomId)}</th></tr>
      <tr>
        <td style="width: 180px;">玩家暱稱</td>
        <td><input id="nickname" maxlength="32"> <button id="connect">進入房間</button> <a href="/">回房間列表</a></td>
      </tr>
    </table>
    <table>
      <tr><th style="width: 220px;">生存者</th><th>對話</th></tr>
      <tr>
        <td><div id="members" class="muted">尚未連線</div></td>
        <td>
          <div id="chatLog"></div>
          <input id="chatText" maxlength="500" style="width: 75%;">
          <button id="sendChat">送出</button>
        </td>
      </tr>
    </table>
    <script>
      const roomId = ${JSON.stringify(roomId)};
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      document.querySelector("#nickname").value = localStorage.getItem("werewolf_cf_nickname") || "";
      let ws;
      function append(line) {
        const div = document.createElement("div");
        div.innerHTML = line;
        document.querySelector("#chatLog").appendChild(div);
      }
      document.querySelector("#connect").addEventListener("click", () => {
        const nickname = document.querySelector("#nickname").value;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/room/" + roomId);
        ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "join", playerId: localStorage.getItem(playerKey), nickname })));
        ws.addEventListener("message", (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "presence") {
            document.querySelector("#members").textContent = msg.members.map((m) => m.nickname).join(", ");
          } else if (msg.type === "chat") {
            append("<b>" + msg.nickname + "</b>: " + msg.text);
          } else if (msg.type === "error") {
            append("<span class='muted'>" + msg.message + "</span>");
          }
        });
      });
      document.querySelector("#sendChat").addEventListener("click", () => {
        const input = document.querySelector("#chatText");
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "chat", text: input.value }));
          input.value = "";
        }
      });
    </script>
  `);
}
```

- [ ] **Step 2: Implement Room Durable Object**

Create `src/room.ts`:

```ts
import { buildChatMessage, buildErrorMessage, buildJoinedMessage, buildPresenceMessage } from "./messages";
import type { RoomMember } from "./types";
import {
  parseClientMessage,
  validateChatText,
  validateNickname,
  validatePlayerId,
  validateRoomId
} from "./validation";

type ConnectionState = {
  playerId: string;
  nickname: string;
};

export class RoomDurableObject {
  private readonly roomId: string;
  private readonly sockets = new Map<WebSocket, ConnectionState>();

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.roomId = this.state.id.name ?? "";
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    validateRoomId(this.roomId);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handleSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSocket(socket: WebSocket): void {
    socket.accept();
    socket.addEventListener("message", (event) => this.onMessage(socket, event));
    socket.addEventListener("close", () => this.onClose(socket));
    socket.addEventListener("error", () => this.onClose(socket));
  }

  private onMessage(socket: WebSocket, event: MessageEvent): void {
    try {
      if (typeof event.data !== "string") {
        throw new Error("Invalid message");
      }

      const message = parseClientMessage(event.data);
      if (message.type === "join") {
        if (this.sockets.has(socket)) {
          throw new Error("Socket already joined");
        }
        const playerId = validatePlayerId(message.playerId);
        const nickname = validateNickname(message.nickname);
        this.sockets.set(socket, { playerId, nickname });
        this.send(socket, buildJoinedMessage(this.roomId, playerId, this.members()));
        this.broadcast(buildPresenceMessage(this.members()));
        return;
      }

      const member = this.sockets.get(socket);
      if (!member) {
        throw new Error("Join required");
      }

      const text = validateChatText(message.text);
      this.broadcast(buildChatMessage(member.playerId, member.nickname, text));
    } catch (error) {
      this.send(socket, buildErrorMessage(error instanceof Error ? error.message : "Unknown error"));
    }
  }

  private onClose(socket: WebSocket): void {
    const hadSocket = this.sockets.delete(socket);
    if (hadSocket) {
      this.broadcast(buildPresenceMessage(this.members()));
    }
  }

  private members(): RoomMember[] {
    return Array.from(this.sockets.values()).map((member) => ({
      playerId: member.playerId,
      nickname: member.nickname
    }));
  }

  private send(socket: WebSocket, message: unknown): void {
    socket.send(JSON.stringify(message));
  }

  private broadcast(message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.sockets.keys()) {
      socket.send(encoded);
    }
  }
}
```

- [ ] **Step 3: Implement Worker router**

Create `src/index.ts`:

```ts
import { RoomDurableObject } from "./room";
import type { RoomSummary } from "./types";
import { renderHome, renderRoom } from "./render";
import { isRecord, validateNickname, validatePlayerId, validateRoomId, validateRoomName } from "./validation";

export { RoomDurableObject };

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers }
  });
}

function html(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function generateRoomId(): string {
  return `room_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

async function listRooms(env: Env): Promise<RoomSummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, name, status, created_at FROM rooms ORDER BY created_at DESC LIMIT 50"
  ).all<{ id: string; name: string; status: "lobby"; created_at: string }>();

  return result.results.map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.created_at
  }));
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.name !== "string" || typeof body.playerId !== "string" || typeof body.nickname !== "string") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const roomId = generateRoomId();
    const name = validateRoomName(body.name);
    const playerId = validatePlayerId(body.playerId);
    const nickname = validateNickname(body.nickname);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO players (id, nickname, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = CURRENT_TIMESTAMP"
      ).bind(playerId, nickname),
      env.DB.prepare("INSERT INTO rooms (id, name, status) VALUES (?, ?, 'lobby')").bind(roomId, name),
      env.DB.prepare("INSERT INTO room_events (room_id, player_id, event_type, payload_json) VALUES (?, ?, 'room_created', ?)").bind(
        roomId,
        playerId,
        JSON.stringify({ name })
      )
    ]);

    return json({ roomId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create room" }, { status: 400 });
  }
}

function routeRoomWebSocket(request: Request, env: Env, roomId: string): Response | Promise<Response> {
  try {
    const validRoomId = validateRoomId(roomId);
    const id = env.ROOM_DO.idFromName(validRoomId);
    return env.ROOM_DO.get(id).fetch(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return html(renderHome(await listRooms(env)));
    }

    if (request.method === "GET" && url.pathname === "/api/rooms") {
      return json({ rooms: await listRooms(env) });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      return createRoom(request, env);
    }

    const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);
    if (request.method === "GET" && roomMatch) {
      try {
        return html(renderRoom(validateRoomId(roomMatch[1])));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
    }

    const wsMatch = url.pathname.match(/^\/ws\/room\/([^/]+)$/);
    if (request.method === "GET" && wsMatch) {
      return routeRoomWebSocket(request, env, wsMatch[1]);
    }

    return new Response("Not found", { status: 404 });
  }
};
```

- [ ] **Step 4: Run typecheck and tests**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit Worker and DO slice**

```bash
git add src/render.ts src/room.ts src/index.ts
git commit -m "feat: add minimal room websocket engine"
```

## Task 5: Local Verification And Finish

**Files:**
- Modify if needed: `README.md`

- [ ] **Step 1: Apply local D1 migration**

Run: `npx wrangler d1 migrations apply werewolf-cf --local`

Expected: Migration `0001_initial.sql` applies locally.

- [ ] **Step 2: Start local Worker**

Run: `npm run dev`

Expected: Wrangler starts a local server and prints a localhost URL.

- [ ] **Step 3: Manual browser verification**

Open the local URL. Create a room with nickname `Alice` and room name `Test Room`.

Expected:

- The room is created.
- Browser navigates to `/room/room_<id>`.
- Clicking `進入房間` connects without an error.

Open the same room in a second tab with nickname `Bob`.

Expected:

- Member list shows both nicknames.
- Chat sent by Alice appears in Bob's tab.
- Chat sent by Bob appears in Alice's tab.

- [ ] **Step 4: Final automated verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit verification doc updates if needed**

If README changed after local verification:

```bash
git add README.md
git commit -m "docs: update local development notes"
```

If README did not change, skip this commit.

- [ ] **Step 6: Review branch status**

Run: `git status --short --branch`

Expected:

- Current branch is `feature/infrastructure-room-engine`.
- No tracked file changes remain.
- `AGENTS.md` may still appear as untracked because it existed before this work and is not part of the implementation commits.

## Self-Review

Spec coverage:

- Infrastructure bindings are covered by Task 2.
- D1 schema is covered by Task 2.
- Validation and message tests are covered by Task 3.
- Worker routes are covered by Task 4.
- Durable Object WebSocket join, presence, and chat are covered by Task 4.
- Retro table UI is covered by Task 4.
- Local verification is covered by Task 5.

Placeholder scan:

- The plan contains no TBD, TODO, FIXME, or unspecified implementation steps.

Type consistency:

- `RoomMember`, `RoomSummary`, `ClientMessage`, and `ServerMessage` are defined before use.
- `RoomDurableObject` is exported from `src/room.ts` and re-exported from `src/index.ts`.
- `Env` in `worker-configuration.d.ts` references `RoomDurableObject` from `src/room.ts`.

