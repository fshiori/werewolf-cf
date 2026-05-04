import { renderHome, renderRoom } from "./render";
import { RoomDurableObject } from "./room";
import type { RoomSummary } from "./types";
import { isRecord, validateNickname, validatePlayerId, validateRoomId, validateRoomName } from "./validation";

export { RoomDurableObject };

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
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
  ).all<{ id: string; name: string; status: RoomSummary["status"]; created_at: string }>();

  return result.results.map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.created_at
  }));
}

async function roomExists(env: Env, roomId: string): Promise<boolean> {
  const result = await env.DB.prepare("SELECT id FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first<{ id: string }>();
  return result !== null;
}

async function getHomeAnnouncement(env: Env): Promise<string | undefined> {
  const announcement = await env.CONFIG.get("home_announcement");
  return announcement?.trim() || undefined;
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

async function routeRoomWebSocket(request: Request, env: Env, roomId: string): Promise<Response> {
  try {
    const validRoomId = validateRoomId(roomId);
    if (!(await roomExists(env, validRoomId))) {
      return json({ error: "Room not found" }, { status: 404 });
    }
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
      return html(renderHome(await listRooms(env), await getHomeAnnouncement(env)));
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
        const roomId = validateRoomId(roomMatch[1]);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return html(renderRoom(roomId));
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
