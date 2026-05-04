import { renderHome, renderPlayerProfile, renderProtocol, renderRoom, renderRules, renderVersion } from "./render";
import { RoomDurableObject } from "./room";
import { DEFAULT_DAY_MINUTES, DEFAULT_NIGHT_MINUTES } from "./game";
import { registeredTripHash, tripHashForRoom } from "./identity";
import type { GamePlayer, GameRecordSummary, GameWinner, LeaderboardEntry, PlayerGameRecordSummary, PlayerStats, RoomEventSummary, RoomOptions, RoomSummary } from "./types";
import {
  isRecord,
  validateNickname,
  validateOptionalLastWordsText,
  validatePlayerId,
  validateRoomCapacity,
  validateRoomComment,
  validateRoomId,
  validateRoomName,
  validateTrip,
  validateTripExclusionReason
} from "./validation";

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

function isAllowedAvatarContentType(value: string): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(value);
}

async function listRooms(env: Env): Promise<RoomSummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, name, room_comment, max_user, dellook, dummy_name, dummy_last_words, status, created_at, option_role FROM rooms ORDER BY created_at DESC LIMIT 50"
  ).all<RoomRow>();

  return result.results.map(roomRowToSummary);
}

type RoomRow = {
  id: string;
  name: string;
  room_comment?: string | null;
  max_user?: number | null;
  dellook?: number | null;
  dummy_name?: string | null;
  dummy_last_words?: string | null;
  status: RoomSummary["status"];
  created_at: string;
  option_role?: string;
};

function roomRowToSummary(room: RoomRow): RoomSummary {
  return {
    id: room.id,
    name: room.name,
    comment: room.room_comment ?? "",
    maxPlayers: room.max_user ?? 22,
    status: room.status,
    createdAt: room.created_at,
    options: {
      ...parseRoomOptions(room.option_role ?? ""),
      deadRoleVisible: room.dellook === 1,
      dummyName: room.dummy_name ?? "替身君",
      dummyLastWords: room.dummy_last_words ?? ""
    }
  };
}

async function getRoomSummary(env: Env, roomIdParam: string): Promise<Response> {
  try {
    const roomId = validateRoomId(roomIdParam);
    const row = await env.DB.prepare(
      "SELECT id, name, room_comment, max_user, dellook, dummy_name, dummy_last_words, status, created_at, option_role FROM rooms WHERE id = ? LIMIT 1"
    )
      .bind(roomId)
      .first<RoomRow>();
    if (!row) {
      return json({ error: "Room not found" }, { status: 404 });
    }
    return json({ room: roomRowToSummary(row) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
  }
}

function parseRoomOptions(optionRole: string): RoomOptions {
  const tokens = optionRole.split(/\s+/).filter(Boolean);
  const roles = new Set(tokens);
  const realTimeToken = tokens.find((token) => token.startsWith("real_time:"));
  const [, dayMinutes, nightMinutes] = realTimeToken?.split(":") ?? [];
  const foxVariant = readFoxVariant({
    betrayer: roles.has("betr"),
    childFox: roles.has("fosi"),
    twoFoxes: roles.has("foxs")
  });
  return {
    poison: roles.has("poison"),
    bigWolf: roles.has("wfbig"),
    authority: roles.has("authority"),
    decider: roles.has("decide"),
    lovers: roles.has("lovers"),
    betrayer: foxVariant === "betrayer",
    childFox: foxVariant === "childFox",
    twoFoxes: foxVariant === "twoFoxes",
    cat: roles.has("cat"),
    lastWords: roles.has("will"),
    openVote: roles.has("open_vote"),
    commonTalkVisible: roles.has("comoutl"),
    deadRoleVisible: false,
    wishRole: roles.has("wish_role"),
    tripRequired: roles.has("istrip"),
    gmEnabled: roles.has("as_gm"),
    dummyBoy: roles.has("dummy_boy"),
    customDummy: roles.has("cust_dummy"),
    dummyName: "替身君",
    dummyLastWords: "",
    realTime: Boolean(realTimeToken),
    dayMinutes: readMinutes(dayMinutes, DEFAULT_DAY_MINUTES),
    nightMinutes: readMinutes(nightMinutes, DEFAULT_NIGHT_MINUTES),
    selfVote: roles.has("votedme"),
    voteStatus: roles.has("votedisplay")
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
    options.commonTalkVisible ? "comoutl" : "",
    options.wishRole ? "wish_role" : "",
    options.tripRequired ? "istrip" : "",
    options.gmEnabled ? "as_gm" : "",
    options.dummyBoy ? "dummy_boy" : "",
    options.customDummy ? "cust_dummy" : "",
    options.realTime ? `real_time:${formatMinutes(options.dayMinutes)}:${formatMinutes(options.nightMinutes)}` : "",
    options.selfVote ? "votedme" : "",
    options.voteStatus ? "votedisplay" : ""
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
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      tripRequired: false,
      gmEnabled: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: DEFAULT_DAY_MINUTES,
      nightMinutes: DEFAULT_NIGHT_MINUTES,
      selfVote: false,
      voteStatus: false
    };
  }
  const foxVariant = readFoxVariant(value);
  return {
    poison: value.poison === true,
    bigWolf: value.bigWolf === true,
    authority: value.authority === true,
    decider: value.decider === true,
    lovers: value.lovers === true,
    betrayer: foxVariant === "betrayer",
    childFox: foxVariant === "childFox",
    twoFoxes: foxVariant === "twoFoxes",
    cat: value.cat === true,
    lastWords: value.lastWords === true,
    openVote: value.openVote === true,
    commonTalkVisible: value.commonTalkVisible === true,
    deadRoleVisible: value.deadRoleVisible === true,
    wishRole: value.wishRole === true,
    tripRequired: value.tripRequired === true,
    gmEnabled: value.gmEnabled === true,
    dummyBoy: value.dummyBoy === true,
    customDummy: value.customDummy === true,
    dummyName: typeof value.dummyName === "string" ? validateNickname(value.dummyName) : "替身君",
    dummyLastWords: typeof value.dummyLastWords === "string" ? validateOptionalLastWordsText(value.dummyLastWords) : "",
    realTime: value.realTime === true,
    dayMinutes: readMinutes(value.dayMinutes, DEFAULT_DAY_MINUTES),
    nightMinutes: readMinutes(value.nightMinutes, DEFAULT_NIGHT_MINUTES),
    selfVote: value.selfVote === true,
    voteStatus: value.voteStatus === true
  };
}

function readFoxVariant(value: Record<string, unknown>): "betrayer" | "childFox" | "twoFoxes" | undefined {
  if (value.betrayer === true) {
    return "betrayer";
  }
  if (value.childFox === true) {
    return "childFox";
  }
  if (value.twoFoxes === true) {
    return "twoFoxes";
  }
  return undefined;
}

function readGmTrip(optionsValue: unknown, gmEnabled: boolean): string | undefined {
  if (!gmEnabled) {
    return undefined;
  }
  if (!isRecord(optionsValue) || typeof optionsValue.gmTrip !== "string") {
    throw new Error("GM Trip is required");
  }
  return validateTrip(optionsValue.gmTrip);
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

async function isMaintenanceMode(env: Env): Promise<boolean> {
  return (await env.CONFIG.get("maintenance_mode")) === "true";
}

async function getRuntimeConfig(env: Env): Promise<Response> {
  const [announcement, maintenanceMode] = await Promise.all([
    getHomeAnnouncement(env),
    isMaintenanceMode(env)
  ]);
  return json({
    config: {
      homeAnnouncement: announcement ?? null,
      maintenanceMode
    }
  });
}

async function getHealth(env: Env): Promise<Response> {
  try {
    const dbRow = await env.DB.prepare("SELECT 1 AS ok").bind().first<{ ok: number }>();
    await env.CONFIG.get("home_announcement");
    const checks = {
      worker: true,
      db: dbRow?.ok === 1,
      kv: true,
      durableObjects: Boolean(env.ROOM_DO),
      r2: Boolean(env.ASSETS)
    };
    const ok = Object.values(checks).every(Boolean);
    return json({ ok, checks }, { status: ok ? 200 : 503 });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Health check failed"
      },
      { status: 503 }
    );
  }
}

function getVersion(): Response {
  return json({
    version: {
      name: "werewolf-cf",
      appVersion: "0.1.0",
      runtime: "Cloudflare Workers",
      language: "TypeScript",
      bindings: ["ROOM_DO", "DB", "ASSETS", "CONFIG"],
      capabilities: ["rooms", "websockets", "websocket_protocol", "game_loop", "trip_identity", "gm_controls", "player_stats", "avatars", "runtime_config"]
    }
  });
}

function getProtocol(): Response {
  return json({
    websocket: {
      path: "/ws/room/:roomId",
      firstClientMessage: "join",
      clientMessages: [
        "join",
        "chat",
        "wolf_chat",
        "fox_chat",
        "common_chat",
        "lovers_chat",
        "dead_chat",
        "gm_chat",
        "gm_whisper",
        "gm_advance_phase",
        "gm_end_game",
        "gm_set_alive",
        "gm_set_role",
        "gm_set_flag",
        "start_game",
        "kick_player",
        "vote",
        "night_kill",
        "divine",
        "child_fox_divine",
        "guard",
        "cat_revive",
        "set_last_words"
      ],
      serverMessages: [
        "joined",
        "presence",
        "chat",
        "wolf_chat",
        "fox_chat",
        "common_chat",
        "lovers_chat",
        "dead_chat",
        "gm_chat",
        "gm_whisper",
        "revealed_roles",
        "divination_result",
        "child_fox_result",
        "medium_result",
        "last_words_ack",
        "action_ack",
        "game_state",
        "role",
        "error"
      ],
      privateChannels: ["wolf_chat", "fox_chat", "common_chat", "lovers_chat", "dead_chat", "gm_chat", "gm_whisper"],
      enforcedBy: "RoomDurableObject"
    }
  });
}

async function registerTrip(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.trip !== "string") {
    return json({ error: "Invalid Trip registration" }, { status: 400 });
  }

  try {
    const trip = validateTrip(body.trip);
    const tripHash = await registeredTripHash(trip);
    await env.DB.prepare("INSERT INTO registered_trips (trip_hash) VALUES (?) ON CONFLICT(trip_hash) DO NOTHING")
      .bind(tripHash)
      .run();
    return json({ registered: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to register Trip" }, { status: 400 });
  }
}

async function excludeTrip(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.trip !== "string") {
    return json({ error: "Invalid Trip exclusion" }, { status: 400 });
  }

  try {
    const trip = validateTrip(body.trip);
    const reason = validateTripExclusionReason(typeof body.reason === "string" ? body.reason : "");
    const tripHash = await registeredTripHash(trip);
    await env.DB.prepare("INSERT INTO excluded_trips (trip_hash, reason) VALUES (?, ?) ON CONFLICT(trip_hash) DO UPDATE SET reason = excluded.reason")
      .bind(tripHash, reason)
      .run();
    return json({ excluded: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to exclude Trip" }, { status: 400 });
  }
}

async function removeTripExclusion(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.trip !== "string") {
    return json({ error: "Invalid Trip exclusion removal" }, { status: 400 });
  }

  try {
    const trip = validateTrip(body.trip);
    const tripHash = await registeredTripHash(trip);
    await env.DB.prepare("DELETE FROM excluded_trips WHERE trip_hash = ?")
      .bind(tripHash)
      .run();
    return json({ excluded: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to remove Trip exclusion" }, { status: 400 });
  }
}

async function claimTrip(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.playerId !== "string" || typeof body.trip !== "string") {
    return json({ error: "Invalid Trip claim" }, { status: 400 });
  }

  try {
    const playerId = validatePlayerId(body.playerId);
    const nickname = typeof body.nickname === "string" && body.nickname.trim() ? validateNickname(body.nickname) : "Trip玩家";
    const trip = validateTrip(body.trip);
    const tripHash = await registeredTripHash(trip);
    const registered = await env.DB.prepare("SELECT trip_hash FROM registered_trips WHERE trip_hash = ? LIMIT 1")
      .bind(tripHash)
      .first<{ trip_hash: string }>();
    if (!registered) {
      return json({ error: "Trip is not registered" }, { status: 400 });
    }

    const excluded = await env.DB.prepare("SELECT trip_hash FROM excluded_trips WHERE trip_hash = ? LIMIT 1")
      .bind(tripHash)
      .first<{ trip_hash: string }>();
    if (excluded) {
      return json({ error: "Trip is excluded" }, { status: 400 });
    }

    await env.DB.prepare(
      "INSERT INTO players (id, nickname, registered_trip_hash, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, registered_trip_hash = excluded.registered_trip_hash, last_seen_at = CURRENT_TIMESTAMP"
    )
      .bind(playerId, nickname, tripHash)
      .run();
    return json({ claimed: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to claim Trip" }, { status: 400 });
  }
}

async function getPlayerStats(env: Env, playerIdParam: string): Promise<Response> {
  try {
    const playerId = validatePlayerId(playerIdParam);
    const identity = await env.DB.prepare("SELECT registered_trip_hash FROM players WHERE id = ? LIMIT 1")
      .bind(playerId)
      .first<{ registered_trip_hash: string | null }>();
    const row = identity?.registered_trip_hash
      ? await env.DB.prepare(
          "SELECT COALESCE(SUM(ps.games_played), 0) AS games_played, COALESCE(SUM(ps.wins), 0) AS wins, COALESCE(SUM(ps.losses), 0) AS losses FROM player_stats ps INNER JOIN players p ON p.id = ps.player_id WHERE p.registered_trip_hash = ?"
        )
          .bind(identity.registered_trip_hash)
          .first<{ games_played: number; wins: number; losses: number }>()
      : await env.DB.prepare("SELECT games_played, wins, losses FROM player_stats WHERE player_id = ?")
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
    "SELECT MIN(ps.player_id) AS player_id, SUM(ps.games_played) AS games_played, SUM(ps.wins) AS wins, SUM(ps.losses) AS losses FROM player_stats ps LEFT JOIN players p ON p.id = ps.player_id GROUP BY COALESCE(p.registered_trip_hash, ps.player_id) ORDER BY wins DESC, games_played DESC, player_id ASC LIMIT 20"
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

function readRecordWinner(value: unknown): GameWinner | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value.winner === "villagers" || value.winner === "werewolves" || value.winner === "foxes" || value.winner === "lovers"
    ? value.winner
    : undefined;
}

function readRecordDay(value: unknown): number | undefined {
  if (!isRecord(value) || typeof value.day !== "number" || !Number.isFinite(value.day)) {
    return undefined;
  }
  return value.day;
}

function readRecordPlayers(value: unknown): GamePlayer[] {
  if (!isRecord(value) || !Array.isArray(value.players)) {
    return [];
  }
  return value.players.filter((player): player is GamePlayer =>
    isRecord(player) &&
    typeof player.playerId === "string" &&
    typeof player.nickname === "string" &&
    typeof player.role === "string" &&
    typeof player.alive === "boolean"
  );
}

function parseJsonOrNull(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function playerIdsForHistory(env: Env, playerId: string): Promise<string[]> {
  const identity = await env.DB.prepare("SELECT registered_trip_hash FROM players WHERE id = ? LIMIT 1")
    .bind(playerId)
    .first<{ registered_trip_hash: string | null }>();
  if (!identity?.registered_trip_hash) {
    return [playerId];
  }

  const result = await env.DB.prepare("SELECT id FROM players WHERE registered_trip_hash = ? ORDER BY id LIMIT 50")
    .bind(identity.registered_trip_hash)
    .all<{ id: string }>();
  const ids = result.results.map((row) => row.id);
  return ids.includes(playerId) ? ids : [playerId, ...ids];
}

async function getPlayerRecords(env: Env, playerIdParam: string): Promise<Response> {
  try {
    const playerId = validatePlayerId(playerIdParam);
    const playerIds = await playerIdsForHistory(env, playerId);
    const predicates = playerIds.map(() => "result_json LIKE ?").join(" OR ");
    const patterns = playerIds.map((id) => `%"playerId":"${id}"%`);
    const result = await env.DB.prepare(
      `SELECT id, room_id, result_json, created_at FROM game_records WHERE ${predicates} ORDER BY created_at DESC LIMIT 20`
    )
      .bind(...patterns)
      .all<{ id: number; room_id: string; result_json: string; created_at: string }>();
    const records: PlayerGameRecordSummary[] = result.results.flatMap((record) => {
      const parsed = parseRecordResult(record.result_json);
      const players = readRecordPlayers(parsed);
      const player = players.find((candidate) => playerIds.includes(candidate.playerId));
      if (!player) {
        return [];
      }
      return [{
        id: record.id,
        roomId: record.room_id,
        winner: readRecordWinner(parsed),
        day: readRecordDay(parsed),
        playerId: player.playerId,
        nickname: player.nickname,
        role: player.role,
        alive: player.alive,
        createdAt: record.created_at
      }];
    });
    return json({ records });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid player records" }, { status: 400 });
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
  if (await isMaintenanceMode(env)) {
    return json({ error: "Server is under maintenance" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.name !== "string" || typeof body.playerId !== "string" || typeof body.nickname !== "string") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const roomId = generateRoomId();
    const name = validateRoomName(body.name);
    const comment = validateRoomComment(typeof body.comment === "string" ? body.comment : "");
    const maxPlayers = validateRoomCapacity(body.maxPlayers ?? 22);
    const playerId = validatePlayerId(body.playerId);
    const nickname = validateNickname(body.nickname);
    const options = readRoomOptions(body.options);
    const gmTrip = readGmTrip(body.options, options.gmEnabled === true);
    const gmTripHash = gmTrip ? await tripHashForRoom(roomId, gmTrip) : null;
    const optionRole = serializeRoomOptions(options);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO players (id, nickname, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = CURRENT_TIMESTAMP"
      ).bind(playerId, nickname),
      env.DB.prepare(
        "INSERT INTO rooms (id, name, room_comment, max_user, dellook, dummy_name, dummy_last_words, gm_trip_hash, status, option_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lobby', ?)"
      ).bind(
        roomId,
        name,
        comment,
        maxPlayers,
        options.deadRoleVisible ? 1 : 0,
        options.customDummy ? options.dummyName : "替身君",
        options.customDummy ? options.dummyLastWords : "",
        gmTripHash,
        optionRole
      ),
      env.DB.prepare("INSERT INTO room_events (room_id, player_id, event_type, payload_json) VALUES (?, ?, 'room_created', ?)").bind(
        roomId,
        playerId,
        JSON.stringify({ name, comment, maxPlayers, options })
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
    if (!isAllowedAvatarContentType(avatarValue.type)) {
      return json({ error: "Avatar must be a PNG, JPEG, GIF, or WebP image" }, { status: 400 });
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

async function removeAvatar(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.playerId !== "string") {
    return json({ error: "Invalid avatar removal" }, { status: 400 });
  }

  try {
    const playerId = validatePlayerId(body.playerId);
    await env.ASSETS.delete(avatarKey(playerId));
    return json({ removed: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to remove avatar" }, { status: 400 });
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
      const [rooms, announcement, maintenanceMode] = await Promise.all([listRooms(env), getHomeAnnouncement(env), isMaintenanceMode(env)]);
      return html(renderHome(rooms, announcement, maintenanceMode));
    }

    if (request.method === "GET" && url.pathname === "/api/rooms") {
      return json({ rooms: await listRooms(env) });
    }

    const roomSummaryMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (request.method === "GET" && roomSummaryMatch) {
      return getRoomSummary(env, roomSummaryMatch[1]);
    }

    if (request.method === "GET" && url.pathname === "/api/stats/leaderboard") {
      return getLeaderboard(env);
    }

    if (request.method === "GET" && url.pathname === "/api/config") {
      return getRuntimeConfig(env);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return getHealth(env);
    }

    if (request.method === "GET" && url.pathname === "/api/version") {
      return getVersion();
    }

    if (request.method === "GET" && url.pathname === "/api/protocol") {
      return getProtocol();
    }

    if (request.method === "GET" && url.pathname === "/rules") {
      return html(renderRules());
    }

    if (request.method === "GET" && url.pathname === "/protocol") {
      return html(renderProtocol());
    }

    if (request.method === "GET" && url.pathname === "/version") {
      return html(renderVersion());
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

    const playerRecordsMatch = url.pathname.match(/^\/api\/players\/([^/]+)\/records$/);
    if (request.method === "GET" && playerRecordsMatch) {
      return getPlayerRecords(env, playerRecordsMatch[1]);
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      return createRoom(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/trips") {
      return registerTrip(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/trips/claim") {
      return claimTrip(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/trips/exclusions") {
      return excludeTrip(request, env);
    }

    if (request.method === "DELETE" && url.pathname === "/api/trips/exclusions") {
      return removeTripExclusion(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/assets/avatar") {
      return uploadAvatar(request, env);
    }

    if (request.method === "DELETE" && url.pathname === "/api/assets/avatar") {
      return removeAvatar(request, env);
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

    const playerMatch = url.pathname.match(/^\/player\/([^/]+)$/);
    if (request.method === "GET" && playerMatch) {
      try {
        return html(renderPlayerProfile(validatePlayerId(playerMatch[1])));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid player" }, { status: 400 });
      }
    }

    const wsMatch = url.pathname.match(/^\/ws\/room\/([^/]+)$/);
    if (request.method === "GET" && wsMatch) {
      return routeRoomWebSocket(request, env, wsMatch[1]);
    }

    return new Response("Not found", { status: 404 });
  }
};
