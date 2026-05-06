import { renderAdminRooms, renderAdminRoomsLogin, renderBbs, renderBbsTopic, renderFederatedList, renderHome, renderIconCatalog, renderLeaderboard, renderPlayerProfile, renderProtocol, renderRoom, renderRoomEvents, renderRoomRecords, renderRoomTranscript, renderRules, renderScriptInfo, renderStatus, renderTripLookup, renderVersion, renderWinRateAnalysis } from "./render";
import { RoomDurableObject } from "./room";
import { ROOM_CLIENT_SCRIPT } from "./room-client";
import { DEFAULT_DAY_MINUTES, DEFAULT_NIGHT_MINUTES } from "./game";
import { registeredTripHash, tripHashForRoom } from "./identity";
import type { BbsReplySummary, BbsTopicSummary, FederatedRoomSummary, GamePlayer, GameRecordSummary, GameWinner, LeaderboardEntry, PlayerGameRecordSummary, PlayerStats, RoomEventSummary, RoomOptions, RoomSummary, WinRateEntry } from "./types";
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

function javascript(body: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/javascript; charset=utf-8"
    }
  });
}

function generateRoomId(): string {
  return `room_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function avatarKey(playerId: string): string {
  return `avatars/${playerId}`;
}

function referenceAssetKey(path: string): string {
  return `reference/${path}`;
}

function contentTypeForReferenceAsset(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".swf")) {
    return "application/x-shockwave-flash";
  }
  return "application/octet-stream";
}

function validateReferenceAssetPath(value: string): string {
  let path: string;
  try {
    path = decodeURIComponent(value);
  } catch {
    throw new Error("Invalid reference asset path");
  }
  if (
    !path ||
    path.includes("\\") ||
    path.includes("//") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..") ||
    !/^(img|user_icon|user_emot|swf)\/[A-Za-z0-9_.\-/]+$/.test(path) ||
    /Thumbs\.db$/i.test(path)
  ) {
    throw new Error("Invalid reference asset path");
  }
  if (!/\.(gif|jpe?g|png|swf)$/i.test(path)) {
    throw new Error("Invalid reference asset path");
  }
  return path;
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

async function requireRoomAdmin(request: Request, env: Env): Promise<Response | undefined> {
  const adminToken = await env.CONFIG.get("room_admin_token");
  if (!adminToken) {
    return json({ error: "Room admin is not configured" }, { status: 403 });
  }
  const url = new URL(request.url);
  const provided = request.headers.get("x-room-admin-token") ?? url.searchParams.get("token") ?? "";
  if (provided !== adminToken) {
    return json({ error: "Room admin token is invalid" }, { status: 403 });
  }
  return undefined;
}

type FederatedServerConfig = {
  name: string;
  url: string;
};

function readFederatedServers(value: string | null): FederatedServerConfig[] {
  if (!value) {
    return [];
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((entry): FederatedServerConfig[] => {
    if (!isRecord(entry) || typeof entry.url !== "string") {
      return [];
    }
    try {
      const url = new URL(entry.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return [];
      }
      return [{
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : url.host,
        url: url.origin
      }];
    } catch {
      return [];
    }
  });
}

function remoteRoomSummary(server: FederatedServerConfig, value: unknown): FederatedRoomSummary | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  const status = value.status === "playing" || value.status === "ended" ? value.status : "lobby";
  return {
    id: value.id,
    name: value.name,
    comment: typeof value.comment === "string" ? value.comment : "",
    maxPlayers: typeof value.maxPlayers === "number" ? value.maxPlayers : 22,
    status,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    options: parseRoomOptions(""),
    serverName: server.name,
    serverUrl: server.url,
    roomUrl: `${server.url}/room/${encodeURIComponent(value.id)}`,
    local: false
  };
}

async function listFederatedRooms(env: Env): Promise<FederatedRoomSummary[]> {
  const localRooms = (await listRooms(env)).map((room): FederatedRoomSummary => ({
    ...room,
    serverName: "本伺服器",
    serverUrl: "/",
    roomUrl: `/room/${room.id}`,
    local: true
  }));
  let servers: FederatedServerConfig[];
  try {
    servers = readFederatedServers(await env.CONFIG.get("federated_servers"));
  } catch {
    servers = [];
  }
  const remoteRooms = await Promise.all(servers.map(async (server): Promise<FederatedRoomSummary[]> => {
    try {
      const response = await fetch(`${server.url}/api/rooms`, { headers: { accept: "application/json" } });
      if (!response.ok) {
        return [];
      }
      const body: unknown = await response.json();
      const rooms = isRecord(body) && Array.isArray(body.rooms) ? body.rooms : [];
      return rooms.flatMap((room) => {
        const summary = remoteRoomSummary(server, room);
        return summary ? [summary] : [];
      });
    } catch {
      return [];
    }
  }));
  return [...localRooms, ...remoteRooms.flat()];
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

async function getRoomStatusValue(env: Env, roomId: string): Promise<string | undefined> {
  const result = await env.DB.prepare("SELECT status FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first<{ status: string }>();
  return result?.status;
}

async function getHomeAnnouncement(env: Env): Promise<string | undefined> {
  const announcement = await env.CONFIG.get("home_announcement");
  return announcement?.trim() || undefined;
}

async function isMaintenanceMode(env: Env): Promise<boolean> {
  return (await env.CONFIG.get("maintenance_mode")) === "true";
}

async function getRuntimeConfig(env: Env): Promise<Response> {
  const config = await readRuntimeConfig(env);
  return json({
    config: {
      homeAnnouncement: config.homeAnnouncement,
      maintenanceMode: config.maintenanceMode
    }
  });
}

async function readRuntimeConfig(env: Env): Promise<{ homeAnnouncement: string | null; maintenanceMode: boolean }> {
  const [announcement, maintenanceMode] = await Promise.all([
    getHomeAnnouncement(env),
    isMaintenanceMode(env)
  ]);
  return {
    homeAnnouncement: announcement ?? null,
    maintenanceMode
  };
}

async function readHealth(env: Env): Promise<{ ok: boolean; checks: Record<string, boolean> }> {
  const dbRow = await env.DB.prepare("SELECT 1 AS ok").bind().first<{ ok: number }>();
  await env.CONFIG.get("home_announcement");
  const checks = {
    worker: true,
    db: dbRow?.ok === 1,
    kv: true,
    durableObjects: Boolean(env.ROOM_DO),
    r2: Boolean(env.ASSETS)
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks
  };
}

async function getHealth(env: Env): Promise<Response> {
  try {
    const health = await readHealth(env);
    return json(health, { status: health.ok ? 200 : 503 });
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
        "self_talk",
        "gm_chat",
        "gm_whisper",
        "gm_advance_phase",
        "gm_end_game",
        "gm_set_alive",
        "gm_set_role",
        "gm_set_flag",
        "start_game",
        "start_vote",
        "kick_player",
        "kick_vote",
        "leave_room",
        "vote",
        "night_kill",
        "divine",
        "child_fox_divine",
        "guard",
        "cat_revive",
        "set_last_words",
        "objection"
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
        "self_talk",
        "gm_chat",
        "gm_whisper",
        "lobby_start_vote",
        "lobby_kick_vote",
        "revealed_roles",
        "divination_result",
        "child_fox_result",
        "medium_result",
        "last_words_ack",
        "objection",
        "action_ack",
        "game_state",
        "role",
        "error"
      ],
      privateChannels: ["wolf_chat", "fox_chat", "common_chat", "lovers_chat", "dead_chat", "self_talk", "gm_chat", "gm_whisper"],
      channelVariants: {
        common_chat: {
          publicVoicePlayerId: "common_voice",
          publicVoiceNickname: "共有者的聲音",
          description: "When commonTalkVisible is enabled, living non-common players and dead common partners receive an anonymous common_chat voice."
        }
      },
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

async function getTripLookup(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tripValue = url.searchParams.get("trip");
    if (!tripValue) {
      return json({ error: "Trip is required" }, { status: 400 });
    }
    const trip = validateTrip(tripValue);
    const tripHash = await registeredTripHash(trip);
    const [registered, excluded, players, stats] = await Promise.all([
      env.DB.prepare("SELECT trip_hash FROM registered_trips WHERE trip_hash = ? LIMIT 1")
        .bind(tripHash)
        .first<{ trip_hash: string }>(),
      env.DB.prepare("SELECT trip_hash FROM excluded_trips WHERE trip_hash = ? LIMIT 1")
        .bind(tripHash)
        .first<{ trip_hash: string }>(),
      env.DB.prepare("SELECT id FROM players WHERE registered_trip_hash = ? ORDER BY id LIMIT 50")
        .bind(tripHash)
        .all<{ id: string }>(),
      env.DB.prepare(
        "SELECT COALESCE(SUM(ps.games_played), 0) AS games_played, COALESCE(SUM(ps.wins), 0) AS wins, COALESCE(SUM(ps.losses), 0) AS losses FROM player_stats ps INNER JOIN players p ON p.id = ps.player_id WHERE p.registered_trip_hash = ?"
      )
        .bind(tripHash)
        .first<{ games_played: number; wins: number; losses: number }>()
    ]);
    return json({
      trip: {
        registered: Boolean(registered),
        excluded: Boolean(excluded),
        players: players.results.map((player) => player.id),
        stats: {
          gamesPlayed: stats?.games_played ?? 0,
          wins: stats?.wins ?? 0,
          losses: stats?.losses ?? 0
        }
      }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid Trip" }, { status: 400 });
  }
}

function validateBbsTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("BBS title is required");
  }
  const title = value.trim();
  if (!title) {
    throw new Error("BBS title is required");
  }
  if (title.length > 50) {
    throw new Error("BBS title is too long");
  }
  return title;
}

function validateBbsMessage(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("BBS message is required");
  }
  const message = value.trim();
  if (!message) {
    throw new Error("BBS message is required");
  }
  if (message.length > 2000) {
    throw new Error("BBS message is too long");
  }
  return message;
}

function validateBbsTopicId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("Invalid BBS topic");
  }
  const topicId = Number(value);
  if (!Number.isSafeInteger(topicId) || topicId <= 0) {
    throw new Error("Invalid BBS topic");
  }
  return topicId;
}

function readBooleanFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function requireBbsAdmin(request: Request, env: Env): Promise<Response | undefined> {
  const adminToken = await env.CONFIG.get("bbs_admin_token");
  if (!adminToken) {
    return json({ error: "BBS moderation is not configured" }, { status: 403 });
  }
  const provided = request.headers.get("x-bbs-admin-token") ?? "";
  if (provided !== adminToken) {
    return json({ error: "BBS moderation token is invalid" }, { status: 403 });
  }
  return undefined;
}

function bbsTopicFromRow(topic: {
  id: number;
  name: string;
  title: string;
  message: string;
  trip_hash: string | null;
  reply_count: number;
  pinned: number;
  locked: number;
  digest: number;
  created_at: string;
  updated_at: string;
}): BbsTopicSummary {
  return {
    id: topic.id,
    name: topic.name,
    title: topic.title,
    message: topic.message,
    trip: Boolean(topic.trip_hash),
    replyCount: topic.reply_count,
    pinned: topic.pinned === 1,
    locked: topic.locked === 1,
    digest: topic.digest === 1,
    createdAt: topic.created_at,
    updatedAt: topic.updated_at
  };
}

async function listBbsTopics(env: Env, digestOnly = false): Promise<BbsTopicSummary[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, title, message, trip_hash, reply_count, pinned, locked, digest, created_at, updated_at FROM bbs_topics${digestOnly ? " WHERE digest = 1" : ""} ORDER BY pinned DESC, updated_at DESC LIMIT 50`
  ).all<{
    id: number;
    name: string;
    title: string;
    message: string;
    trip_hash: string | null;
    reply_count: number;
    pinned: number;
    locked: number;
    digest: number;
    created_at: string;
    updated_at: string;
  }>();
  return result.results.map(bbsTopicFromRow);
}

async function getBbsTopicById(env: Env, topicId: number): Promise<BbsTopicSummary | undefined> {
  const topic = await env.DB.prepare(
    "SELECT id, name, title, message, trip_hash, reply_count, pinned, locked, digest, created_at, updated_at FROM bbs_topics WHERE id = ? LIMIT 1"
  )
    .bind(topicId)
    .first<{
      id: number;
      name: string;
      title: string;
      message: string;
      trip_hash: string | null;
      reply_count: number;
      pinned: number;
      locked: number;
      digest: number;
      created_at: string;
      updated_at: string;
    }>();
  return topic ? bbsTopicFromRow(topic) : undefined;
}

async function listBbsReplies(env: Env, topicId: number): Promise<BbsReplySummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, topic_id, name, message, trip_hash, created_at FROM bbs_replies WHERE topic_id = ? ORDER BY created_at ASC, id ASC LIMIT 200"
  )
    .bind(topicId)
    .all<{ id: number; topic_id: number; name: string; message: string; trip_hash: string | null; created_at: string }>();
  return result.results.map((reply) => ({
    id: reply.id,
    topicId: reply.topic_id,
    name: reply.name,
    message: reply.message,
    trip: Boolean(reply.trip_hash),
    createdAt: reply.created_at
  }));
}

async function getBbsTopics(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  return json({ topics: await listBbsTopics(env, url.searchParams.get("digest") === "1") });
}

async function endRoomByAdmin(request: Request, env: Env, roomIdParam: string): Promise<Response> {
  const authError = await requireRoomAdmin(request, env);
  if (authError) {
    return authError;
  }
  try {
    const roomId = validateRoomId(roomIdParam);
    const exists = await env.DB.prepare("SELECT id FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first<{ id: string }>();
    if (!exists) {
      return json({ error: "Room not found" }, { status: 404 });
    }
    await env.DB.prepare("UPDATE rooms SET status = 'ended' WHERE id = ?").bind(roomId).run();
    await env.DB.prepare("INSERT INTO room_events (room_id, event_type, payload_json) VALUES (?, 'admin_room_ended', ?)").bind(
      roomId,
      JSON.stringify({ status: "ended" })
    ).run();
    return json({ roomId, status: "ended" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to end room" }, { status: 400 });
  }
}

async function getBbsTopic(env: Env, topicIdParam: string): Promise<Response> {
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    return json({ topic, replies: await listBbsReplies(env, topicId) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid BBS topic" }, { status: 400 });
  }
}

async function createBbsTopic(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS topic" }, { status: 400 });
  }
  try {
    const name = typeof body.name === "string" && body.name.trim() ? validateNickname(body.name) : "匿名";
    const title = validateBbsTitle(body.title);
    const message = validateBbsMessage(body.message);
    const trip = typeof body.trip === "string" && body.trip.trim() ? validateTrip(body.trip) : undefined;
    const tripHash = trip ? await registeredTripHash(trip) : null;
    await env.DB.prepare("INSERT INTO bbs_topics (name, title, message, trip_hash) VALUES (?, ?, ?, ?)")
      .bind(name, title, message, tripHash)
      .run();
    return json({ posted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create BBS topic" }, { status: 400 });
  }
}

async function createBbsReply(request: Request, env: Env, topicIdParam: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS reply" }, { status: 400 });
  }
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    if (topic.locked) {
      return json({ error: "BBS topic is locked" }, { status: 403 });
    }
    const name = typeof body.name === "string" && body.name.trim() ? validateNickname(body.name) : "匿名";
    const message = validateBbsMessage(body.message);
    const trip = typeof body.trip === "string" && body.trip.trim() ? validateTrip(body.trip) : undefined;
    const tripHash = trip ? await registeredTripHash(trip) : null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO bbs_replies (topic_id, name, message, trip_hash) VALUES (?, ?, ?, ?)").bind(topicId, name, message, tripHash),
      env.DB.prepare("UPDATE bbs_topics SET reply_count = reply_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(topicId)
    ]);
    return json({ posted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create BBS reply" }, { status: 400 });
  }
}

async function updateBbsTopicFlags(request: Request, env: Env, topicIdParam: string): Promise<Response> {
  const unauthorized = await requireBbsAdmin(request, env);
  if (unauthorized) {
    return unauthorized;
  }
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS moderation request" }, { status: 400 });
  }
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    const pinned = "pinned" in body ? readBooleanFlag(body.pinned) : topic.pinned;
    const locked = "locked" in body ? readBooleanFlag(body.locked) : topic.locked;
    const digest = "digest" in body ? readBooleanFlag(body.digest) : topic.digest;
    await env.DB.prepare("UPDATE bbs_topics SET pinned = ?, locked = ?, digest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(pinned ? 1 : 0, locked ? 1 : 0, digest ? 1 : 0, topicId)
      .run();
    return json({
      topic: {
        ...topic,
        pinned,
        locked,
        digest
      }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to update BBS topic" }, { status: 400 });
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

async function listLeaderboard(env: Env): Promise<LeaderboardEntry[]> {
  const result = await env.DB.prepare(
    "SELECT MIN(ps.player_id) AS player_id, SUM(ps.games_played) AS games_played, SUM(ps.wins) AS wins, SUM(ps.losses) AS losses FROM player_stats ps LEFT JOIN players p ON p.id = ps.player_id GROUP BY COALESCE(p.registered_trip_hash, ps.player_id) ORDER BY wins DESC, games_played DESC, player_id ASC LIMIT 20"
  ).all<{ player_id: string; games_played: number; wins: number; losses: number }>();
  return result.results.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses
  }));
}

async function getLeaderboard(env: Env): Promise<Response> {
  const leaderboard = await listLeaderboard(env);
  return json({ leaderboard });
}

function winnerDisplayLabel(winner: GameWinner): string {
  if (winner === "villagers") {
    return "人勝";
  }
  if (winner === "werewolves") {
    return "狼勝";
  }
  if (winner === "foxes") {
    return "狐勝";
  }
  return "戀勝";
}

async function listWinRateAnalysis(env: Env): Promise<WinRateEntry[]> {
  const result = await env.DB.prepare("SELECT result_json FROM game_records ORDER BY created_at DESC LIMIT 500")
    .all<{ result_json: string }>();
  const winners = result.results.map((record) => readRecordWinner(parseRecordResult(record.result_json))).filter((winner): winner is GameWinner => Boolean(winner));
  const total = winners.length;
  const order: GameWinner[] = ["villagers", "werewolves", "foxes", "lovers"];
  return order.map((winner) => {
    const wins = winners.filter((value) => value === winner).length;
    return {
      winner,
      label: winnerDisplayLabel(winner),
      wins,
      total,
      rate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0
    };
  });
}

async function getWinRateAnalysis(env: Env): Promise<Response> {
  return json({ winRates: await listWinRateAnalysis(env) });
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

async function listRoomRecords(env: Env, roomId: string): Promise<GameRecordSummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, room_id, result_json, created_at FROM game_records WHERE room_id = ? ORDER BY created_at DESC LIMIT 20"
  )
    .bind(roomId)
    .all<{ id: number; room_id: string; result_json: string; created_at: string }>();
  return result.results.map((record) => ({
    id: record.id,
    roomId: record.room_id,
    result: parseRecordResult(record.result_json),
    createdAt: record.created_at
  }));
}

async function getRoomRecords(env: Env, roomIdParam: string): Promise<Response> {
  try {
    const roomId = validateRoomId(roomIdParam);
    if (!(await roomExists(env, roomId))) {
      return json({ error: "Room not found" }, { status: 404 });
    }

    return json({ records: await listRoomRecords(env, roomId) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
  }
}

function isPrivateRoomEvent(event: RoomEventSummary): boolean {
  return isRecord(event.payload) && event.payload.visibility === "private";
}

async function listRoomEvents(env: Env, roomId: string): Promise<RoomEventSummary[]> {
  const [status, result] = await Promise.all([
    getRoomStatusValue(env, roomId),
    env.DB.prepare(
      "SELECT id, room_id, player_id, event_type, payload_json, created_at FROM room_events WHERE room_id = ? ORDER BY created_at DESC LIMIT 50"
    )
      .bind(roomId)
      .all<{ id: number; room_id: string; player_id: string | null; event_type: string; payload_json: string; created_at: string }>()
  ]);
  const includePrivate = status === "ended";
  return result.results
    .map((event) => ({
      id: event.id,
      roomId: event.room_id,
      playerId: event.player_id ?? undefined,
      eventType: event.event_type,
      payload: parseJsonOrNull(event.payload_json),
      createdAt: event.created_at
    }))
    .filter((event) => includePrivate || !isPrivateRoomEvent(event));
}

async function getRoomEvents(env: Env, roomIdParam: string): Promise<Response> {
  try {
    const roomId = validateRoomId(roomIdParam);
    if (!(await roomExists(env, roomId))) {
      return json({ error: "Room not found" }, { status: 404 });
    }

    return json({ events: await listRoomEvents(env, roomId) });
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

async function getReferenceAsset(env: Env, pathParam: string): Promise<Response> {
  try {
    const path = validateReferenceAssetPath(pathParam);
    const object = await env.ASSETS.get(referenceAssetKey(path));
    if (!object) {
      return new Response("Reference asset not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", contentTypeForReferenceAsset(path));
    }
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=86400");
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid reference asset" }, { status: 400 });
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

    if (request.method === "GET" && url.pathname === "/api/stats/win-rate") {
      return getWinRateAnalysis(env);
    }

    if (request.method === "GET" && url.pathname === "/leaderboard") {
      return html(renderLeaderboard(await listLeaderboard(env)));
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      return html(renderWinRateAnalysis(await listWinRateAnalysis(env)));
    }

    if (request.method === "GET" && url.pathname === "/list") {
      return html(renderFederatedList(await listFederatedRooms(env)));
    }

    if (request.method === "GET" && url.pathname === "/trips") {
      return html(renderTripLookup());
    }

    if (request.method === "GET" && url.pathname === "/bbs") {
      const view = url.searchParams.get("view");
      const digestOnly = url.searchParams.get("digest") === "1" || url.searchParams.get("go") === "dige";
      if (view) {
        try {
          const topicId = validateBbsTopicId(view);
          const topic = await getBbsTopicById(env, topicId);
          if (!topic) {
            return new Response("BBS topic not found", { status: 404 });
          }
          return html(renderBbsTopic(topic, await listBbsReplies(env, topicId)));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid BBS topic" }, { status: 400 });
        }
      }
      return html(renderBbs(await listBbsTopics(env, digestOnly), { digestOnly }));
    }

    if (request.method === "GET" && url.pathname === "/icons") {
      return html(renderIconCatalog());
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

    if (request.method === "GET" && url.pathname === "/api/bbs/topics") {
      return getBbsTopics(request, env);
    }

    const adminRoomApiMatch = url.pathname.match(/^\/api\/admin\/rooms\/([^/]+)$/);
    if (request.method === "PATCH" && adminRoomApiMatch) {
      return endRoomByAdmin(request, env, adminRoomApiMatch[1]);
    }

    const bbsTopicApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)$/);
    if (request.method === "GET" && bbsTopicApiMatch) {
      return getBbsTopic(env, bbsTopicApiMatch[1]);
    }

    if (request.method === "GET" && url.pathname === "/rules") {
      return html(renderRules());
    }

    if (request.method === "GET" && url.pathname === "/script-info") {
      return html(renderScriptInfo());
    }

    if (request.method === "GET" && url.pathname === "/protocol") {
      return html(renderProtocol());
    }

    if (request.method === "GET" && url.pathname === "/version") {
      return html(renderVersion());
    }

    if (request.method === "GET" && url.pathname === "/status") {
      try {
        const [health, config] = await Promise.all([readHealth(env), readRuntimeConfig(env)]);
        return html(renderStatus({ ...health, ...config }));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Status check failed" }, { status: 503 });
      }
    }

    if (request.method === "GET" && url.pathname === "/admin/rooms") {
      const authError = await requireRoomAdmin(request, env);
      if (authError) {
        return html(renderAdminRoomsLogin());
      }
      return html(renderAdminRooms((await listRooms(env)).filter((room) => room.status !== "ended")));
    }

    if (request.method === "GET" && url.pathname === "/assets/room-client.js") {
      return javascript(ROOM_CLIENT_SCRIPT);
    }

    const roomRecordsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/records$/);
    if (request.method === "GET" && roomRecordsMatch) {
      return getRoomRecords(env, roomRecordsMatch[1]);
    }

    const roomEventsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
    if (request.method === "GET" && roomEventsMatch) {
      return getRoomEvents(env, roomEventsMatch[1]);
    }

    const roomRecordsPageMatch = url.pathname.match(/^\/room\/([^/]+)\/records$/);
    if (request.method === "GET" && roomRecordsPageMatch) {
      try {
        const roomId = validateRoomId(roomRecordsPageMatch[1]);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return html(renderRoomRecords(roomId, await listRoomRecords(env, roomId)));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
    }

    const roomEventsPageMatch = url.pathname.match(/^\/room\/([^/]+)\/events$/);
    if (request.method === "GET" && roomEventsPageMatch) {
      try {
        const roomId = validateRoomId(roomEventsPageMatch[1]);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return html(renderRoomEvents(roomId, await listRoomEvents(env, roomId)));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
    }

    const roomTranscriptPageMatch = url.pathname.match(/^\/room\/([^/]+)\/log$/);
    if (request.method === "GET" && roomTranscriptPageMatch) {
      try {
        const roomId = validateRoomId(roomTranscriptPageMatch[1]);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        const [records, events] = await Promise.all([listRoomRecords(env, roomId), listRoomEvents(env, roomId)]);
        return html(renderRoomTranscript(roomId, records, events, {
          heavenTalk: url.searchParams.get("heaven_talk") === "on",
          heavenOnly: url.searchParams.get("heaven_only") === "on",
          reverseLog: url.searchParams.get("reverse_log") === "on"
        }));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
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

    if (request.method === "POST" && url.pathname === "/api/bbs/topics") {
      return createBbsTopic(request, env);
    }

    const bbsReplyApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/replies$/);
    if (request.method === "POST" && bbsReplyApiMatch) {
      return createBbsReply(request, env, bbsReplyApiMatch[1]);
    }

    const bbsModerationApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/moderation$/);
    if (request.method === "PATCH" && bbsModerationApiMatch) {
      return updateBbsTopicFlags(request, env, bbsModerationApiMatch[1]);
    }

    if (request.method === "GET" && url.pathname === "/api/trips/lookup") {
      return getTripLookup(request, env);
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

    const referenceAssetMatch = url.pathname.match(/^\/assets\/reference\/(.+)$/);
    if (request.method === "GET" && referenceAssetMatch) {
      return getReferenceAsset(env, referenceAssetMatch[1]);
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
