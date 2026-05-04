import { renderHome, renderRoom } from "./render";
import { RoomDurableObject } from "./room";
import { DEFAULT_DAY_MINUTES, DEFAULT_NIGHT_MINUTES } from "./game";
import type { GameRecordSummary, LeaderboardEntry, PlayerStats, RoomEventSummary, RoomOptions, RoomSummary } from "./types";
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

function avatarKey(playerId: string): string {
  return `avatars/${playerId}`;
}

function isFileLike(value: unknown): value is File {
  return typeof value === "object" && value !== null && "stream" in value && "size" in value && "type" in value;
}

async function listRooms(env: Env): Promise<RoomSummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, name, status, created_at, option_role FROM rooms ORDER BY created_at DESC LIMIT 50"
  ).all<{ id: string; name: string; status: RoomSummary["status"]; created_at: string; option_role?: string }>();

  return result.results.map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.created_at,
    options: parseRoomOptions(room.option_role ?? "")
  }));
}

function parseRoomOptions(optionRole: string): RoomOptions {
  const tokens = optionRole.split(/\s+/).filter(Boolean);
  const roles = new Set(tokens);
  const realTimeToken = tokens.find((token) => token.startsWith("real_time:"));
  const [, dayMinutes, nightMinutes] = realTimeToken?.split(":") ?? [];
  return {
    poison: roles.has("poison"),
    bigWolf: roles.has("wfbig"),
    authority: roles.has("authority"),
    decider: roles.has("decide"),
    lovers: roles.has("lovers"),
    betrayer: roles.has("betr"),
    childFox: roles.has("fosi"),
    twoFoxes: roles.has("foxs"),
    cat: roles.has("cat"),
    lastWords: roles.has("will"),
    openVote: roles.has("open_vote"),
    realTime: Boolean(realTimeToken),
    dayMinutes: readMinutes(dayMinutes, DEFAULT_DAY_MINUTES),
    nightMinutes: readMinutes(nightMinutes, DEFAULT_NIGHT_MINUTES)
  };
}

function serializeRoomOptions(options: RoomOptions): string {
  return [
    options.poison ? "poison" : "",
    options.bigWolf ? "wfbig" : "",
    options.authority ? "authority" : "",
    options.decider ? "decide" : "",
    options.lovers ? "lovers" : "",
    options.betrayer ? "betr" : "",
    options.childFox ? "fosi" : "",
    options.twoFoxes ? "foxs" : "",
    options.cat ? "cat" : "",
    options.lastWords ? "will" : "",
    options.openVote ? "open_vote" : "",
    options.realTime ? `real_time:${formatMinutes(options.dayMinutes)}:${formatMinutes(options.nightMinutes)}` : ""
  ].filter(Boolean).join(" ");
}

function readRoomOptions(value: unknown): RoomOptions {
  if (!isRecord(value)) {
    return {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      realTime: false,
      dayMinutes: DEFAULT_DAY_MINUTES,
      nightMinutes: DEFAULT_NIGHT_MINUTES
    };
  }
  return {
    poison: value.poison === true,
    bigWolf: value.bigWolf === true,
    authority: value.authority === true,
    decider: value.decider === true,
    lovers: value.lovers === true,
    betrayer: value.betrayer === true,
    childFox: value.childFox === true,
    twoFoxes: value.twoFoxes === true,
    cat: value.cat === true,
    lastWords: value.lastWords === true,
    openVote: value.openVote === true,
    realTime: value.realTime === true,
    dayMinutes: readMinutes(value.dayMinutes, DEFAULT_DAY_MINUTES),
    nightMinutes: readMinutes(value.nightMinutes, DEFAULT_NIGHT_MINUTES)
  };
}

function readMinutes(value: unknown, fallback: number): number {
  const minutes = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= 99 ? minutes : fallback;
}

function formatMinutes(value: number): string {
  return String(readMinutes(value, DEFAULT_DAY_MINUTES));
}

async function roomExists(env: Env, roomId: string): Promise<boolean> {
  const result = await env.DB.prepare("SELECT id FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first<{ id: string }>();
  return result !== null;
}

async function getHomeAnnouncement(env: Env): Promise<string | undefined> {
  const announcement = await env.CONFIG.get("home_announcement");
  return announcement?.trim() || undefined;
}

async function getPlayerStats(env: Env, playerIdParam: string): Promise<Response> {
  try {
    const playerId = validatePlayerId(playerIdParam);
    const row = await env.DB.prepare("SELECT games_played, wins, losses FROM player_stats WHERE player_id = ?")
      .bind(playerId)
      .first<{ games_played: number; wins: number; losses: number }>();
    const stats: PlayerStats = {
      playerId,
      gamesPlayed: row?.games_played ?? 0,
      wins: row?.wins ?? 0,
      losses: row?.losses ?? 0
    };
    return json({ stats });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid player" }, { status: 400 });
  }
}

async function getLeaderboard(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    "SELECT player_id, games_played, wins, losses FROM player_stats ORDER BY wins DESC, games_played DESC, player_id ASC LIMIT 20"
  ).all<{ player_id: string; games_played: number; wins: number; losses: number }>();
  const leaderboard: LeaderboardEntry[] = result.results.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses
  }));
  return json({ leaderboard });
}

function parseRecordResult(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonOrNull(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getRoomRecords(env: Env, roomIdParam: string): Promise<Response> {
  try {
    const roomId = validateRoomId(roomIdParam);
    if (!(await roomExists(env, roomId))) {
      return json({ error: "Room not found" }, { status: 404 });
    }

    const result = await env.DB.prepare(
      "SELECT id, room_id, result_json, created_at FROM game_records WHERE room_id = ? ORDER BY created_at DESC LIMIT 20"
    )
      .bind(roomId)
      .all<{ id: number; room_id: string; result_json: string; created_at: string }>();
    const records: GameRecordSummary[] = result.results.map((record) => ({
      id: record.id,
      roomId: record.room_id,
      result: parseRecordResult(record.result_json),
      createdAt: record.created_at
    }));
    return json({ records });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
  }
}

async function getRoomEvents(env: Env, roomIdParam: string): Promise<Response> {
  try {
    const roomId = validateRoomId(roomIdParam);
    if (!(await roomExists(env, roomId))) {
      return json({ error: "Room not found" }, { status: 404 });
    }

    const result = await env.DB.prepare(
      "SELECT id, room_id, player_id, event_type, payload_json, created_at FROM room_events WHERE room_id = ? ORDER BY created_at DESC LIMIT 50"
    )
      .bind(roomId)
      .all<{ id: number; room_id: string; player_id: string | null; event_type: string; payload_json: string; created_at: string }>();
    const events: RoomEventSummary[] = result.results.map((event) => ({
      id: event.id,
      roomId: event.room_id,
      playerId: event.player_id ?? undefined,
      eventType: event.event_type,
      payload: parseJsonOrNull(event.payload_json),
      createdAt: event.created_at
    }));
    return json({ events });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
  }
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
    const options = readRoomOptions(body.options);
    const optionRole = serializeRoomOptions(options);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO players (id, nickname, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = CURRENT_TIMESTAMP"
      ).bind(playerId, nickname),
      env.DB.prepare("INSERT INTO rooms (id, name, status, option_role) VALUES (?, ?, 'lobby', ?)").bind(roomId, name, optionRole),
      env.DB.prepare("INSERT INTO room_events (room_id, player_id, event_type, payload_json) VALUES (?, ?, 'room_created', ?)").bind(
        roomId,
        playerId,
        JSON.stringify({ name, options })
      )
    ]);

    return json({ roomId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create room" }, { status: 400 });
  }
}

async function uploadAvatar(request: Request, env: Env): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const playerIdValue = form?.get("playerId");
  const avatarValue = form?.get("avatar");
  if (typeof playerIdValue !== "string" || !isFileLike(avatarValue)) {
    return json({ error: "Invalid avatar upload" }, { status: 400 });
  }

  try {
    const playerId = validatePlayerId(playerIdValue);
    if (!avatarValue.type.startsWith("image/")) {
      return json({ error: "Avatar must be an image" }, { status: 400 });
    }
    if (avatarValue.size > 512 * 1024) {
      return json({ error: "Avatar is too large" }, { status: 400 });
    }

    const key = avatarKey(playerId);
    await env.ASSETS.put(key, avatarValue.stream(), {
      httpMetadata: { contentType: avatarValue.type }
    });
    return json({ key });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to upload avatar" }, { status: 400 });
  }
}

async function getAvatar(env: Env, playerIdParam: string): Promise<Response> {
  try {
    const playerId = validatePlayerId(playerIdParam);
    const object = await env.ASSETS.get(avatarKey(playerId));
    if (!object) {
      return new Response("Avatar not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=3600");
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid avatar" }, { status: 400 });
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

    if (request.method === "GET" && url.pathname === "/api/stats/leaderboard") {
      return getLeaderboard(env);
    }

    const roomRecordsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/records$/);
    if (request.method === "GET" && roomRecordsMatch) {
      return getRoomRecords(env, roomRecordsMatch[1]);
    }

    const roomEventsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
    if (request.method === "GET" && roomEventsMatch) {
      return getRoomEvents(env, roomEventsMatch[1]);
    }

    const statsMatch = url.pathname.match(/^\/api\/players\/([^/]+)\/stats$/);
    if (request.method === "GET" && statsMatch) {
      return getPlayerStats(env, statsMatch[1]);
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      return createRoom(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/assets/avatar") {
      return uploadAvatar(request, env);
    }

    const avatarMatch = url.pathname.match(/^\/assets\/avatar\/([^/]+)$/);
    if (request.method === "GET" && avatarMatch) {
      return getAvatar(env, avatarMatch[1]);
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
