import { DEFAULT_ANNOUNCEMENT, renderAdminConfig, renderAdminConfigLogin, renderAdminIndex, renderAdminRooms, renderAdminRoomsLogin, renderBbs, renderBbsAdmin, renderBbsTopic, renderFederatedList, renderHome, renderIconCatalog, renderLeaderboard, renderManual, renderOldLogs, renderPlayerProfile, renderProtocol, renderRoom, renderRoomEvents, renderRoomRecords, renderRoomTranscript, renderRules, renderScriptInfo, renderStatus, renderTripComments, renderTripDetail, renderTripRating, renderTripRegistration, renderTripLookup, renderTripRoomRecords, renderVersion, renderWinRateAnalysis } from "./render";
import type { LegacyRoomPath } from "./render";
import { RoomDurableObject } from "./room";
import { ROOM_CLIENT_SCRIPT } from "./room-client";
import { DEFAULT_DAY_MINUTES, DEFAULT_NIGHT_MINUTES } from "./game";
import { bbsPasswordHash, registeredTripHash, tripHashForRoom } from "./identity";
import type { BbsReplySummary, BbsTopicSummary, ChannelRestrictions, FederatedRoomSummary, FederatedServerStatus, GamePlayer, GameRecordSummary, GameWinner, LeaderboardEntry, PlayerGameRecordSummary, PlayerStats, RoomEventSummary, RoomOptions, RoomSummary, TripPublicSummary, TripRoomRecordSummary, TripScoreSummary, WinRateEntry } from "./types";
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
  validateTripExclusionReason,
  escapeHtml
} from "./validation";

export { RoomDurableObject };

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(body, { ...init, headers });
}

function javascript(body: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/javascript; charset=utf-8"
    }
  });
}

function text(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

function safeLegacyBackPage(value: string | null, origin: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value, origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href;
  } catch {
    return undefined;
  }
}

function legacyIconResult(title: string, message: string, backHref = "/icon_upload.php", extra = "", status = 200): Response {
  return html(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta http-equiv="refresh" content="5; url=${escapeHtml(backHref)}">
</head>
<body bgcolor="aliceblue">
  <br><br>
  ${message}
  ${extra}
  <br>5秒後跳回<a href="${escapeHtml(backHref)}">頭像頁面</a>
</body>
</html>`, { status });
}

function legacyIconRemovalResult(): Response {
  return html(`<html><head><title>アイコン削除完了</title><meta http-equiv=refresh content="1;URL=icon_upload.php">
</head><body>削除完了：登錄ページに飛びます畫面切換中<a href="icon_upload.php">按我繼續</a></body></html>`);
}

function legacyTripResult(title: string, message: string, backHref = "/trip.php", status = 200): Response {
  return html(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta http-equiv="refresh" content="5; url=${escapeHtml(backHref)}">
</head>
<body bgcolor="white">
  <br><br>
  <fieldset>
    <legend><strong>${escapeHtml(title)}</strong></legend>
    <div style="line-height:135%;margin:20px 20px 30px;">
      <strong>${message}</strong>
    </div>
  </fieldset>
  <br>5秒後跳回<a href="${escapeHtml(backHref)}">Trip頁面</a>
</body>
</html>`, { status });
}

function legacyApiField(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

function legacyFederatedApiLine(room: RoomSummary, origin: string): string {
  const status = room.status === "playing" ? "playing" : "waiting";
  const baseUrl = origin.endsWith("/") ? origin : `${origin}/`;
  return [
    `werewolf-cf ${room.id}`,
    room.name,
    room.comment,
    status,
    String(room.maxPlayers),
    baseUrl
  ].map(legacyApiField).join("\t");
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

function adminRoomStatusFilter(value: string | null): "active" | "ended" | "all" {
  return value === "ended" || value === "all" ? value : "active";
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("Cookie") ?? request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return undefined;
}

async function requireRoomAdmin(request: Request, env: Env): Promise<Response | undefined> {
  const adminToken = await env.CONFIG.get("room_admin_token");
  if (!adminToken) {
    return json({ error: "Room admin is not configured" }, { status: 403 });
  }
  const url = new URL(request.url);
  const provided = request.headers.get("x-room-admin-token") ?? url.searchParams.get("token") ?? readCookie(request, "adpass") ?? "";
  if (provided !== adminToken) {
    return json({ error: "Room admin token is invalid" }, { status: 403 });
  }
  return undefined;
}

async function requireConfigAdmin(request: Request, env: Env): Promise<Response | undefined> {
  const adminToken = await env.CONFIG.get("config_admin_token");
  if (!adminToken) {
    return json({ error: "Config admin is not configured" }, { status: 403 });
  }
  const url = new URL(request.url);
  const provided = request.headers.get("x-config-admin-token") ?? url.searchParams.get("token") ?? "";
  if (provided !== adminToken) {
    return json({ error: "Config admin token is invalid" }, { status: 403 });
  }
  return undefined;
}

type FederatedServerConfig = {
  name: string;
  url: string;
};

function federatedServerBaseUrl(url: URL): string {
  const pathname = url.pathname.replace(/\/+$/, "");
  return pathname ? `${url.origin}${pathname}` : url.origin;
}

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
        url: federatedServerBaseUrl(url)
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

function legacyFederatedRoomSummary(server: FederatedServerConfig, line: string): FederatedRoomSummary | undefined {
  const columns = line.split("\t");
  if (columns.length < 6 || !columns[0] || !columns[1]) {
    return undefined;
  }
  const [, roomId = ""] = columns[0].split(" ");
  if (!roomId) {
    return undefined;
  }
  const status = columns[3] === "playing" ? "playing" : "lobby";
  const maxPlayers = Number.parseInt(columns[4] ?? "", 10);
  const baseUrl = columns[5]?.trim() || server.url;
  return {
    id: roomId,
    name: columns[1],
    comment: columns[2] ?? "",
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : 22,
    status,
    createdAt: "",
    options: parseRoomOptions(""),
    serverName: server.name,
    serverUrl: server.url,
    roomUrl: `${baseUrl}${baseUrl.endsWith("/") ? "" : "/"}login.php?room_no=${encodeURIComponent(roomId)}`,
    local: false
  };
}

async function fetchLegacyFederatedRooms(server: FederatedServerConfig): Promise<FederatedRoomSummary[]> {
  const response = await fetch(`${server.url}/api.php`, { headers: { accept: "text/plain" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = await response.text();
  return body.split(/\r?\n/).flatMap((line) => {
    const summary = legacyFederatedRoomSummary(server, line);
    return summary ? [summary] : [];
  });
}

async function listFederatedRooms(env: Env): Promise<{ rooms: FederatedRoomSummary[]; peers: FederatedServerStatus[] }> {
  const localRooms = (await listRooms(env)).map((room): FederatedRoomSummary => ({
    ...room,
    serverName: "本伺服器",
    serverUrl: "/",
    roomUrl: `/login.php?room_no=${encodeURIComponent(room.id)}`,
    local: true
  }));
  let servers: FederatedServerConfig[];
  try {
    servers = readFederatedServers(await env.CONFIG.get("federated_servers"));
  } catch {
    servers = [];
  }
  const remoteResults = await Promise.all(servers.map(async (server): Promise<{ rooms: FederatedRoomSummary[]; peer: FederatedServerStatus }> => {
    try {
      const response = await fetch(`${server.url}/api/rooms`, { headers: { accept: "application/json" } });
      if (response.ok) {
        const body: unknown = await response.json();
        const rooms = isRecord(body) && Array.isArray(body.rooms) ? body.rooms : [];
        const summaries = rooms.flatMap((room) => {
          const summary = remoteRoomSummary(server, room);
          return summary ? [summary] : [];
        });
        return {
          rooms: summaries,
          peer: { name: server.name, url: server.url, ok: true, roomCount: summaries.length }
        };
      }
      const summaries = await fetchLegacyFederatedRooms(server);
      return {
        rooms: summaries,
        peer: { name: server.name, url: server.url, ok: true, roomCount: summaries.length }
      };
    } catch {
      return {
        rooms: [],
        peer: { name: server.name, url: server.url, ok: false, roomCount: 0, error: "連線失敗" }
      };
    }
  }));
  return {
    rooms: [...localRooms, ...remoteResults.flatMap((result) => result.rooms)],
    peers: remoteResults.map((result) => result.peer)
  };
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
    channelRestrictions: parseChannelRestrictions(tokens),
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
  const channelRestrictions = options.channelRestrictions;
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
    options.voteStatus ? "votedisplay" : "",
    channelRestrictions ? serializeChannelRestrictions(channelRestrictions) : ""
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
    channelRestrictions: readChannelRestrictions(value.channelRestrictions),
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

function parseChannelRestrictions(tokens: string[]): ChannelRestrictions | undefined {
  const token = tokens.find((value) => value.startsWith("chdis:"));
  if (!token) {
    return undefined;
  }
  return {
    wolf: token.includes("ch_wolf"),
    common: token.includes("ch_common"),
    lovers: token.includes("ch_lovers"),
    fox: token.includes("ch_fox")
  };
}

function serializeChannelRestrictions(restrictions: ChannelRestrictions): string {
  return `chdis:${[
    restrictions.wolf ? "ch_wolf" : "",
    restrictions.common ? "ch_common" : "",
    restrictions.lovers ? "ch_lovers" : "",
    restrictions.fox ? "ch_fox" : ""
  ].join(":")}`;
}

function readChannelRestrictions(value: unknown): ChannelRestrictions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.wolf !== "boolean" ||
    typeof value.common !== "boolean" ||
    typeof value.lovers !== "boolean" ||
    typeof value.fox !== "boolean"
  ) {
    return undefined;
  }
  return {
    wolf: value.wolf,
    common: value.common,
    lovers: value.lovers,
    fox: value.fox
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

async function getAnnouncementText(env: Env): Promise<Response> {
  return text(`${(await getHomeAnnouncement(env)) ?? DEFAULT_ANNOUNCEMENT}\n`);
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

async function updateRuntimeConfig(request: Request, env: Env): Promise<Response> {
  const authError = await requireConfigAdmin(request, env);
  if (authError) {
    return authError;
  }
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid config payload" }, { status: 400 });
  }
  const homeAnnouncement = typeof body.homeAnnouncement === "string" ? body.homeAnnouncement.trim().slice(0, 500) : "";
  const maintenanceMode = body.maintenanceMode === true;
  await Promise.all([
    env.CONFIG.put("home_announcement", homeAnnouncement),
    env.CONFIG.put("maintenance_mode", maintenanceMode ? "true" : "false")
  ]);
  return json({ config: { homeAnnouncement: homeAnnouncement || null, maintenanceMode } });
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
        "gm_set_channel_restrictions",
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
        "objection",
        "room_end_vote"
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
      channelRestrictionOption: "chdis:ch_wolf:ch_common:ch_lovers:ch_fox",
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
    await insertRegisteredTrip(env, body.trip);
    return json({ registered: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to register Trip" }, { status: 400 });
  }
}

async function insertRegisteredTrip(env: Env, value: unknown): Promise<string> {
  if (typeof value !== "string") {
    throw new Error("Invalid Trip");
  }
  const trip = validateTrip(value);
  const tripHash = await registeredTripHash(trip);
  await env.DB.prepare("INSERT INTO registered_trips (trip_hash) VALUES (?) ON CONFLICT(trip_hash) DO NOTHING")
    .bind(tripHash)
    .run();
  return tripHash;
}

async function excludeTrip(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.trip !== "string") {
    return json({ error: "Invalid Trip exclusion" }, { status: 400 });
  }

  try {
    await insertTripExclusion(env, body.trip, body.reason);
    return json({ excluded: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to exclude Trip" }, { status: 400 });
  }
}

async function insertTripExclusion(env: Env, tripValue: unknown, reasonValue: unknown): Promise<string> {
  if (typeof tripValue !== "string") {
    throw new Error("Invalid Trip");
  }
  const trip = validateTrip(tripValue);
  const reason = validateTripExclusionReason(typeof reasonValue === "string" ? reasonValue : "");
  const tripHash = await registeredTripHash(trip);
  await env.DB.prepare("INSERT INTO excluded_trips (trip_hash, reason) VALUES (?, ?) ON CONFLICT(trip_hash) DO UPDATE SET reason = excluded.reason")
    .bind(tripHash, reason)
    .run();
  return tripHash;
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

function readFormString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFormValue(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

function legacyBbsTopicLocation(topicId: number | string, page?: number): string {
  const base = `/bbs.php?view=${encodeURIComponent(String(topicId))}`;
  return page && page > 1 ? `${base}&page=${encodeURIComponent(String(page))}` : base;
}

async function loginLegacyAdmin(request: Request): Promise<Response> {
  const form = await request.formData();
  const token = readFormString(form, "apass") ?? readFormString(form, "adpass") ?? "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/admin.php?token=${encodeURIComponent(token)}`,
      "Set-Cookie": `adpass=${encodeURIComponent(token)}; Path=/; SameSite=Lax`
    }
  });
}

async function readLegacyTripForm(request: Request): Promise<Record<string, unknown>> {
  const form = await request.formData();
  return {
    trip: readFormString(form, "name") ?? readFormString(form, "trip"),
    password: readFormString(form, "password"),
    reason: readFormString(form, "aname") ?? readFormString(form, "reason")
  };
}

async function registerLegacyTrip(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readLegacyTripForm(request);
    await insertRegisteredTrip(env, body.trip);
    return new Response(null, {
      status: 303,
      headers: { Location: "/trip.php" }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to register Trip" }, { status: 400 });
  }
}

async function excludeLegacyTrip(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readLegacyTripForm(request);
    await insertTripExclusion(env, body.trip, body.reason);
    return new Response(null, {
      status: 303,
      headers: { Location: "/trip.php" }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to exclude Trip" }, { status: 400 });
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

async function readTripPublicSummary(env: Env, tripValue: string): Promise<TripPublicSummary> {
  const trip = validateTrip(tripValue);
  const tripHash = await registeredTripHash(trip);
  const [registered, excluded, players, stats, scoreCounts] = await Promise.all([
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
      .first<{ games_played: number; wins: number; losses: number }>(),
    env.DB.prepare("SELECT score, COUNT(*) AS count FROM trip_scores WHERE target_trip = ? GROUP BY score")
      .bind(trip)
      .all<{ score: number; count: number }>()
  ]);
  const scoreRows = scoreCounts.results ?? [];
  return {
    registered: Boolean(registered),
    excluded: Boolean(excluded),
    players: players.results.map((player) => player.id),
    scores: {
      positive: scoreRows.filter((row) => row.score === 1).reduce((sum, row) => sum + row.count, 0),
      negative: scoreRows.filter((row) => row.score === 2).reduce((sum, row) => sum + row.count, 0)
    },
    stats: {
      gamesPlayed: stats?.games_played ?? 0,
      wins: stats?.wins ?? 0,
      losses: stats?.losses ?? 0
    }
  };
}

function tripScoreRow(row: { id: number; room_id: string; reviewer_trip: string; target_trip: string; message: string; score: number; created_at: string }): TripScoreSummary {
  return {
    id: row.id,
    roomId: row.room_id,
    reviewerTrip: row.reviewer_trip,
    targetTrip: row.target_trip,
    message: row.message,
    score: row.score === 1 ? 1 : 2,
    createdAt: row.created_at
  };
}

async function listTripScores(env: Env, tripValue: string, limit: number, offset: number): Promise<TripScoreSummary[]> {
  const trip = validateTrip(tripValue);
  const result = await env.DB.prepare("SELECT id, reviewer_trip, room_id, target_trip, message, score, created_at FROM trip_scores WHERE target_trip = ? ORDER BY id DESC LIMIT ? OFFSET ?")
    .bind(trip, limit, offset)
    .all<{ id: number; reviewer_trip: string; room_id: string; target_trip: string; message: string; score: number; created_at: string }>();
  return (result.results ?? []).map(tripScoreRow);
}

async function countTripScores(env: Env, tripValue: string): Promise<number> {
  const trip = validateTrip(tripValue);
  const result = await env.DB.prepare("SELECT COUNT(*) AS count FROM trip_scores WHERE target_trip = ?")
    .bind(trip)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

async function getTripLookup(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tripValue = url.searchParams.get("trip");
    if (!tripValue) {
      return json({ error: "Trip is required" }, { status: 400 });
    }
    return json({ trip: await readTripPublicSummary(env, tripValue) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid Trip" }, { status: 400 });
  }
}

async function getLegacyTripDetail(env: Env, tripValue: string): Promise<Response> {
  try {
    return html(renderTripDetail(validateTrip(tripValue), await readTripPublicSummary(env, tripValue)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid Trip" }, { status: 400 });
  }
}

function tripRoomCapacityFilter(value: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  return [8, 16, 22, 30].includes(parsed) ? parsed : undefined;
}

async function listTripRoomRecords(env: Env, tripValue: string, maxPlayers?: number): Promise<TripRoomRecordSummary[]> {
  const trip = validateTrip(tripValue);
  const tripHash = await registeredTripHash(trip);
  const players = await env.DB.prepare("SELECT id FROM players WHERE registered_trip_hash = ? ORDER BY id LIMIT 50")
    .bind(tripHash)
    .all<{ id: string }>();
  const playerIds = players.results.map((player) => player.id);
  if (!playerIds.length) {
    return [];
  }
  const predicates = playerIds.map(() => "result_json LIKE ?").join(" OR ");
  const patterns = playerIds.map((id) => `%"playerId":"${id}"%`);
  const capacityJoin = maxPlayers ? "JOIN rooms ON rooms.id = game_records.room_id" : "";
  const capacityPredicate = maxPlayers ? " AND rooms.max_user = ?" : "";
  const result = await env.DB.prepare(
    `SELECT game_records.id, game_records.room_id, game_records.result_json, game_records.created_at FROM game_records ${capacityJoin} WHERE (${predicates})${capacityPredicate} ORDER BY game_records.created_at DESC LIMIT 50`
  )
    .bind(...patterns, ...(maxPlayers ? [maxPlayers] : []))
    .all<{ id: number; room_id: string; result_json: string; created_at: string }>();
  return result.results.flatMap((record) => {
    const parsed = parseRecordResult(record.result_json);
    const playersInRecord = readRecordPlayers(parsed);
    const player = playersInRecord.find((candidate) => playerIds.includes(candidate.playerId));
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
}

async function getLegacyTripRoomRecords(env: Env, tripValue: string, playValue: string | null, pageValue: string | null): Promise<Response> {
  try {
    const page = readPositivePage(pageValue);
    const play = tripRoomCapacityFilter(playValue);
    const records = await listTripRoomRecords(env, tripValue, play);
    const visibleRecords = records.slice((page - 1) * TRIP_ROOM_PAGE_SIZE, page * TRIP_ROOM_PAGE_SIZE);
    return html(renderTripRoomRecords(validateTrip(tripValue), visibleRecords, {
      page,
      pageSize: TRIP_ROOM_PAGE_SIZE,
      totalRecords: records.length,
      play
    }));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid Trip records" }, { status: 400 });
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

function validateBbsPassword(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const password = value.trim();
  if (!password) {
    return undefined;
  }
  if (password.length > 128) {
    throw new Error("BBS password is too long");
  }
  return password;
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

function readPositivePage(value: string | null): number {
  if (!value) {
    return 1;
  }
  if (!/^\d+$/.test(value)) {
    return 1;
  }
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
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

const BBS_TOPIC_PAGE_SIZE = 15;
const BBS_REPLY_PAGE_SIZE = 10;
const OLD_LOG_PAGE_SIZE = 25;
const TRIP_ROOM_PAGE_SIZE = 15;
const TRIP_SCORE_PAGE_SIZE = 15;

async function countBbsTopics(env: Env, digestOnly = false): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM bbs_topics${digestOnly ? " WHERE digest = 1" : ""}`)
    .bind()
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function listBbsTopics(env: Env, digestOnly = false, limit = 50, offset = 0): Promise<BbsTopicSummary[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, title, message, trip_hash, reply_count, pinned, locked, digest, created_at, updated_at FROM bbs_topics${digestOnly ? " WHERE digest = 1" : ""} ORDER BY pinned DESC, updated_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all<{
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

async function getBbsTopicPasswordHash(env: Env, topicId: number): Promise<string | null | undefined> {
  const row = await env.DB.prepare("SELECT password_hash FROM bbs_topics WHERE id = ? LIMIT 1")
    .bind(topicId)
    .first<{ password_hash: string | null }>();
  return row ? row.password_hash : undefined;
}

async function countBbsReplies(env: Env, topicId: number): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM bbs_replies WHERE topic_id = ?")
    .bind(topicId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function listBbsReplies(env: Env, topicId: number, limit = 200, offset = 0): Promise<BbsReplySummary[]> {
  const result = await env.DB.prepare(
    "SELECT id, topic_id, name, message, trip_hash, created_at FROM bbs_replies WHERE topic_id = ? ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?"
  )
    .bind(topicId, limit, offset)
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

async function getBbsReplyById(env: Env, replyId: number): Promise<BbsReplySummary | undefined> {
  const reply = await env.DB.prepare(
    "SELECT id, topic_id, name, message, trip_hash, created_at FROM bbs_replies WHERE id = ? LIMIT 1"
  )
    .bind(replyId)
    .first<{ id: number; topic_id: number; name: string; message: string; trip_hash: string | null; created_at: string }>();
  return reply ? {
    id: reply.id,
    topicId: reply.topic_id,
    name: reply.name,
    message: reply.message,
    trip: Boolean(reply.trip_hash),
    createdAt: reply.created_at
  } : undefined;
}

async function bbsReplyExists(env: Env, topicId: number, replyId: number): Promise<boolean> {
  const reply = await env.DB.prepare("SELECT id FROM bbs_replies WHERE id = ? AND topic_id = ? LIMIT 1")
    .bind(replyId, topicId)
    .first<{ id: number }>();
  return Boolean(reply);
}

async function getBbsReplyPasswordHash(env: Env, topicId: number, replyId: number): Promise<string | null | undefined> {
  const row = await env.DB.prepare("SELECT password_hash FROM bbs_replies WHERE id = ? AND topic_id = ? LIMIT 1")
    .bind(replyId, topicId)
    .first<{ password_hash: string | null }>();
  return row ? row.password_hash : undefined;
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
    const roomId = await markRoomEndedByAdmin(env, roomIdParam);
    return json({ roomId, status: "ended" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to end room" }, { status: errorStatus(error, 400) });
  }
}

async function markRoomEndedByAdmin(env: Env, roomIdParam: string): Promise<string> {
  const roomId = validateRoomId(roomIdParam);
  const exists = await env.DB.prepare("SELECT id FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first<{ id: string }>();
  if (!exists) {
    const error = new Error("Room not found") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  await env.DB.prepare("UPDATE rooms SET status = 'ended' WHERE id = ?").bind(roomId).run();
  await env.DB.prepare("INSERT INTO room_events (room_id, event_type, payload_json) VALUES (?, 'admin_room_ended', ?)").bind(
    roomId,
    JSON.stringify({ status: "ended" })
  ).run();
  return roomId;
}

async function endRoomByLegacyAdminLink(request: Request, env: Env, roomIdParam: string, redirectPath: string): Promise<Response> {
  const authError = await requireRoomAdmin(request, env);
  if (authError) {
    return authError;
  }
  try {
    const roomId = await markRoomEndedByAdmin(env, roomIdParam);
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? readCookie(request, "adpass");
    const redirect = new URL(redirectPath, url.origin);
    if (token) {
      redirect.searchParams.set("token", token);
    }
    redirect.searchParams.set("ended", roomId);
    return new Response(null, { status: 303, headers: { Location: `${redirect.pathname}${redirect.search}` } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to end room" }, { status: errorStatus(error, 400) });
  }
}

async function renderAdminRoomsPage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const authError = await requireRoomAdmin(request, env);
  if (authError) {
    return html(renderAdminRoomsLogin());
  }
  const statusFilter = adminRoomStatusFilter(url.searchParams.get("status"));
  const rooms = (await listRooms(env)).filter((room) => (
    statusFilter === "all" ? true : statusFilter === "ended" ? room.status === "ended" : room.status !== "ended"
  ));
  return html(renderAdminRooms(rooms, statusFilter, url.searchParams.get("token") ?? readCookie(request, "adpass") ?? ""));
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

function errorStatus(error: unknown, fallback: number): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status >= 400 && status < 600) {
      return status;
    }
  }
  return fallback;
}

async function insertBbsTopic(env: Env, body: Record<string, unknown>): Promise<number | undefined> {
  const name = typeof body.name === "string" && body.name.trim() ? validateNickname(body.name) : "匿名";
  const title = validateBbsTitle(body.title);
  const message = validateBbsMessage(body.message);
  const trip = typeof body.trip === "string" && body.trip.trim() ? validateTrip(body.trip) : undefined;
  const tripHash = trip ? await registeredTripHash(trip) : null;
  const password = validateBbsPassword(body.password);
  const passwordHash = password ? await bbsPasswordHash(password) : null;
  const result = await env.DB.prepare("INSERT INTO bbs_topics (name, title, message, trip_hash, password_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(name, title, message, tripHash, passwordHash)
    .run();
  return typeof result.meta?.last_row_id === "number" && result.meta.last_row_id > 0 ? result.meta.last_row_id : undefined;
}

async function insertBbsReply(env: Env, topicIdParam: string, body: Record<string, unknown>): Promise<{ replyCount: number; page: number }> {
  const topicId = validateBbsTopicId(topicIdParam);
  const topic = await getBbsTopicById(env, topicId);
  if (!topic) {
    const error = new Error("BBS topic not found") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  if (topic.locked) {
    const error = new Error("BBS topic is locked") as Error & { status: number };
    error.status = 403;
    throw error;
  }
  const name = typeof body.name === "string" && body.name.trim() ? validateNickname(body.name) : "匿名";
  const message = validateBbsMessage(body.message);
  const trip = typeof body.trip === "string" && body.trip.trim() ? validateTrip(body.trip) : undefined;
  const tripHash = trip ? await registeredTripHash(trip) : null;
  const password = validateBbsPassword(body.password);
  const passwordHash = password ? await bbsPasswordHash(password) : null;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO bbs_replies (topic_id, name, message, trip_hash, password_hash) VALUES (?, ?, ?, ?, ?)").bind(topicId, name, message, tripHash, passwordHash),
    env.DB.prepare("UPDATE bbs_topics SET reply_count = reply_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(topicId)
  ]);
  const replyCount = topic.replyCount + 1;
  return { replyCount, page: Math.max(1, Math.ceil(replyCount / BBS_REPLY_PAGE_SIZE)) };
}

async function readLegacyBbsForm(request: Request): Promise<Record<string, unknown>> {
  const form = await request.formData();
  return {
    id: readFormString(form, "id"),
    editis: readFormString(form, "editis"),
    bbst: readFormString(form, "bbst"),
    name: readFormString(form, "bname") ?? readFormString(form, "name"),
    title: readFormString(form, "title"),
    message: readFormString(form, "mess") ?? readFormString(form, "message"),
    password: readFormString(form, "bpass") ?? readFormString(form, "password"),
    trip: readFormString(form, "trip")
  };
}

async function createBbsTopic(request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS topic" }, { status: 400 });
  }
  try {
    const topicId = await insertBbsTopic(env, body);
    return json(topicId ? { posted: true, topicId } : { posted: true });
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
    const result = await insertBbsReply(env, topicIdParam, body);
    return json({ posted: true, ...result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create BBS reply" }, { status: errorStatus(error, 400) });
  }
}

async function createLegacyBbsTopic(request: Request, env: Env): Promise<Response> {
  try {
    const topicId = await insertBbsTopic(env, await readLegacyBbsForm(request));
    return new Response(null, {
      status: 303,
      headers: { Location: topicId ? legacyBbsTopicLocation(topicId) : "/bbs.php" }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create BBS topic" }, { status: 400 });
  }
}

async function createLegacyBbsReply(request: Request, env: Env): Promise<Response> {
  try {
    const body = await readLegacyBbsForm(request);
    const topicId = validateBbsTopicId(typeof body.id === "string" ? body.id : "");
    const result = await insertBbsReply(env, String(topicId), body);
    return new Response(null, {
      status: 303,
      headers: { Location: legacyBbsTopicLocation(topicId, result.page) }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create BBS reply" }, { status: errorStatus(error, 400) });
  }
}

async function authorizeLegacyBbsTopic(env: Env, topicId: number, passwordValue: unknown, action: "edit" | "delete"): Promise<{ topic: BbsTopicSummary; adminAuthorized: boolean }> {
  const topic = await getBbsTopicById(env, topicId);
  if (!topic) {
    const error = new Error("BBS topic not found") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  const providedPassword = validateBbsPassword(passwordValue);
  const adminToken = await env.CONFIG.get("bbs_admin_token");
  const passwordHash = await getBbsTopicPasswordHash(env, topicId);
  const adminAuthorized = Boolean(adminToken && providedPassword === adminToken);
  const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
  if (!adminAuthorized && !passwordAuthorized) {
    const error = new Error(action === "edit" ? "BBS edit password is invalid" : "BBS topic delete password is invalid") as Error & { status: number };
    error.status = 403;
    throw error;
  }
  return { topic, adminAuthorized };
}

async function authorizeLegacyBbsReply(env: Env, replyId: number, passwordValue: unknown, action: "edit" | "delete"): Promise<BbsReplySummary> {
  const reply = await getBbsReplyById(env, replyId);
  if (!reply) {
    const error = new Error("BBS reply not found") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  const providedPassword = validateBbsPassword(passwordValue);
  const adminToken = await env.CONFIG.get("bbs_admin_token");
  const passwordHash = await getBbsReplyPasswordHash(env, reply.topicId, replyId);
  const adminAuthorized = Boolean(adminToken && providedPassword === adminToken);
  const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
  if (!adminAuthorized && !passwordAuthorized) {
    const error = new Error(action === "edit" ? "BBS reply edit password is invalid" : "BBS reply delete password is invalid") as Error & { status: number };
    error.status = 403;
    throw error;
  }
  return reply;
}

async function requireLegacyBbsAdmin(env: Env, passwordValue: unknown): Promise<void> {
  const adminToken = await env.CONFIG.get("bbs_admin_token");
  if (!adminToken) {
    const error = new Error("BBS moderation is not configured") as Error & { status: number };
    error.status = 403;
    throw error;
  }
  const providedPassword = validateBbsPassword(passwordValue);
  if (providedPassword !== adminToken) {
    const error = new Error("BBS moderation token is invalid") as Error & { status: number };
    error.status = 403;
    throw error;
  }
}

async function updateLegacyBbsTopicFlags(env: Env, topic: BbsTopicSummary, editis: string): Promise<void> {
  const pinned = editis === "totop" ? true : editis === "notop" ? false : topic.pinned;
  const locked = editis === "tolock" ? true : editis === "nolock" ? false : topic.locked;
  const digest = editis === "todige" ? true : editis === "nodige" ? false : topic.digest;
  await env.DB.prepare("UPDATE bbs_topics SET pinned = ?, locked = ?, digest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(pinned ? 1 : 0, locked ? 1 : 0, digest ? 1 : 0, topic.id)
    .run();
}

async function editLegacyBbsTopic(request: Request, env: Env, topicIdParam: string): Promise<Response> {
  try {
    const entryId = validateBbsTopicId(topicIdParam);
    const body = await readLegacyBbsForm(request);
    const editis = typeof body.editis === "string" ? body.editis : "";
    if (editis === "edit") {
      if (await getBbsTopicById(env, entryId)) {
        await authorizeLegacyBbsTopic(env, entryId, body.password, "edit");
      } else {
        await authorizeLegacyBbsReply(env, entryId, body.password, "edit");
      }
      return new Response(null, {
        status: 303,
        headers: { Location: `/bbs.php?go=edit&id=${entryId}` }
      });
    }
    if (editis === "editok") {
      const topic = await getBbsTopicById(env, entryId);
      const reply = await getBbsReplyById(env, entryId);
      if (topic) {
        try {
          await authorizeLegacyBbsTopic(env, entryId, body.password, "edit");
          const title = typeof body.title === "string" ? validateBbsTitle(body.title) : topic.title;
          const message = validateBbsMessage(body.message);
          await env.DB.prepare("UPDATE bbs_topics SET title = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(title, message, entryId)
            .run();
          return new Response(null, {
            status: 303,
            headers: { Location: legacyBbsTopicLocation(entryId) }
          });
        } catch (error) {
          if (!reply) {
            throw error;
          }
        }
      }
      if (!reply) {
        return json({ error: "BBS topic not found" }, { status: 404 });
      }
      await authorizeLegacyBbsReply(env, entryId, body.password, "edit");
      const message = validateBbsMessage(body.message);
      await env.DB.prepare("UPDATE bbs_replies SET message = ? WHERE id = ? AND topic_id = ?")
        .bind(message, entryId, reply.topicId)
        .run();
      return new Response(null, {
        status: 303,
        headers: { Location: legacyBbsTopicLocation(reply.topicId) }
      });
    }
    if (editis === "del") {
      const topic = await getBbsTopicById(env, entryId);
      const reply = await getBbsReplyById(env, entryId);
      if (topic) {
        try {
          await authorizeLegacyBbsTopic(env, entryId, body.password, "delete");
          await env.DB.batch([
            env.DB.prepare("DELETE FROM bbs_replies WHERE topic_id = ?").bind(entryId),
            env.DB.prepare("DELETE FROM bbs_topics WHERE id = ?").bind(entryId)
          ]);
          return new Response(null, {
            status: 303,
            headers: { Location: "/bbs.php" }
          });
        } catch (error) {
          if (!reply) {
            throw error;
          }
        }
      }
      if (!reply) {
        return json({ error: "BBS topic not found" }, { status: 404 });
      }
      await authorizeLegacyBbsReply(env, entryId, body.password, "delete");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM bbs_replies WHERE id = ? AND topic_id = ?").bind(entryId, reply.topicId),
        env.DB.prepare("UPDATE bbs_topics SET reply_count = MAX(reply_count - 1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reply.topicId)
      ]);
      return new Response(null, {
        status: 303,
        headers: { Location: legacyBbsTopicLocation(reply.topicId) }
      });
    }
    if (["tolock", "nolock", "totop", "notop", "todige", "nodige"].includes(editis)) {
      await requireLegacyBbsAdmin(env, body.password);
      const topic = await getBbsTopicById(env, entryId);
      if (!topic) {
        return json({ error: "BBS topic not found" }, { status: 404 });
      }
      await updateLegacyBbsTopicFlags(env, topic, editis);
      return new Response(null, {
        status: 303,
        headers: { Location: legacyBbsTopicLocation(entryId) }
      });
    }
    return json({ error: "Invalid BBS edit operation" }, { status: 400 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to edit BBS topic" }, { status: errorStatus(error, 400) });
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

async function updateBbsTopicContent(request: Request, env: Env, topicIdParam: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS edit request" }, { status: 400 });
  }
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    const adminToken = await env.CONFIG.get("bbs_admin_token");
    const providedAdminToken = request.headers.get("x-bbs-admin-token") ?? "";
    const providedPassword = validateBbsPassword(body.password);
    const passwordHash = await getBbsTopicPasswordHash(env, topicId);
    const adminAuthorized = Boolean(adminToken && providedAdminToken === adminToken);
    const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
    if (!adminAuthorized && !passwordAuthorized) {
      return json({ error: "BBS edit password is invalid" }, { status: 403 });
    }
    const title = "title" in body ? validateBbsTitle(body.title) : topic.title;
    const message = "message" in body ? validateBbsMessage(body.message) : topic.message;
    await env.DB.prepare("UPDATE bbs_topics SET title = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(title, message, topicId)
      .run();
    return json({
      topic: {
        ...topic,
        title,
        message
      }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to edit BBS topic" }, { status: 400 });
  }
}

async function deleteBbsTopic(request: Request, env: Env, topicIdParam: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    const adminToken = await env.CONFIG.get("bbs_admin_token");
    const providedAdminToken = request.headers.get("x-bbs-admin-token") ?? "";
    const providedPassword = isRecord(body) ? validateBbsPassword(body.password) : undefined;
    const passwordHash = await getBbsTopicPasswordHash(env, topicId);
    const adminAuthorized = Boolean(adminToken && providedAdminToken === adminToken);
    const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
    if (!adminAuthorized && !passwordAuthorized) {
      return json({ error: "BBS topic delete password is invalid" }, { status: 403 });
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM bbs_replies WHERE topic_id = ?").bind(topicId),
      env.DB.prepare("DELETE FROM bbs_topics WHERE id = ?").bind(topicId)
    ]);
    return json({ deleted: true, topicId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to delete BBS topic" }, { status: 400 });
  }
}

async function deleteBbsReply(request: Request, env: Env, topicIdParam: string, replyIdParam: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const replyId = validateBbsTopicId(replyIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    if (!(await bbsReplyExists(env, topicId, replyId))) {
      return json({ error: "BBS reply not found" }, { status: 404 });
    }
    const adminToken = await env.CONFIG.get("bbs_admin_token");
    const providedAdminToken = request.headers.get("x-bbs-admin-token") ?? "";
    const providedPassword = isRecord(body) ? validateBbsPassword(body.password) : undefined;
    const passwordHash = await getBbsReplyPasswordHash(env, topicId, replyId);
    const adminAuthorized = Boolean(adminToken && providedAdminToken === adminToken);
    const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
    if (!adminAuthorized && !passwordAuthorized) {
      return json({ error: "BBS reply delete password is invalid" }, { status: 403 });
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM bbs_replies WHERE id = ? AND topic_id = ?").bind(replyId, topicId),
      env.DB.prepare("UPDATE bbs_topics SET reply_count = MAX(reply_count - 1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(topicId)
    ]);
    return json({ deleted: true, topicId, replyId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to delete BBS reply" }, { status: 400 });
  }
}

async function updateBbsReplyContent(request: Request, env: Env, topicIdParam: string, replyIdParam: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return json({ error: "Invalid BBS reply edit request" }, { status: 400 });
  }
  try {
    const topicId = validateBbsTopicId(topicIdParam);
    const replyId = validateBbsTopicId(replyIdParam);
    const topic = await getBbsTopicById(env, topicId);
    if (!topic) {
      return json({ error: "BBS topic not found" }, { status: 404 });
    }
    if (!(await bbsReplyExists(env, topicId, replyId))) {
      return json({ error: "BBS reply not found" }, { status: 404 });
    }
    const adminToken = await env.CONFIG.get("bbs_admin_token");
    const providedAdminToken = request.headers.get("x-bbs-admin-token") ?? "";
    const providedPassword = validateBbsPassword(body.password);
    const passwordHash = await getBbsReplyPasswordHash(env, topicId, replyId);
    const adminAuthorized = Boolean(adminToken && providedAdminToken === adminToken);
    const passwordAuthorized = Boolean(passwordHash && providedPassword && await bbsPasswordHash(providedPassword) === passwordHash);
    if (!adminAuthorized && !passwordAuthorized) {
      return json({ error: "BBS reply edit password is invalid" }, { status: 403 });
    }
    const message = validateBbsMessage(body.message);
    await env.DB.prepare("UPDATE bbs_replies SET message = ? WHERE id = ? AND topic_id = ?")
      .bind(message, replyId, topicId)
      .run();
    return json({ reply: { id: replyId, topicId, message } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to edit BBS reply" }, { status: 400 });
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
  if (winner === "lovers") {
    return "戀勝";
  }
  return "平手";
}

async function listWinRateAnalysis(env: Env): Promise<WinRateEntry[]> {
  const result = await env.DB.prepare("SELECT result_json FROM game_records ORDER BY created_at DESC LIMIT 500")
    .all<{ result_json: string }>();
  const winners = result.results.map((record) => readRecordWinner(parseRecordResult(record.result_json))).filter((winner): winner is GameWinner => Boolean(winner));
  const total = winners.length;
  const order: GameWinner[] = ["villagers", "werewolves", "foxes", "lovers", "draw"];
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

async function listLatestRoomWinners(env: Env, roomIds: string[]): Promise<Record<string, GameWinner>> {
  if (!roomIds.length) {
    return {};
  }
  const placeholders = roomIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `SELECT room_id, result_json, created_at FROM game_records WHERE room_id IN (${placeholders}) ORDER BY created_at DESC`
  )
    .bind(...roomIds)
    .all<{ room_id: string; result_json: string; created_at: string }>();
  const winners: Record<string, GameWinner> = {};
  for (const record of result.results) {
    if (winners[record.room_id]) {
      continue;
    }
    const winner = readRecordWinner(parseRecordResult(record.result_json));
    if (winner) {
      winners[record.room_id] = winner;
    }
  }
  return winners;
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
  return value.winner === "villagers" || value.winner === "werewolves" || value.winner === "foxes" || value.winner === "lovers" || value.winner === "draw"
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

function roomTranscriptKnownPlayerIds(records: GameRecordSummary[], events: RoomEventSummary[]): Set<string> {
  const playerIds = new Set<string>();
  for (const record of records) {
    for (const player of readRecordPlayers(record.result)) {
      playerIds.add(player.playerId);
    }
  }
  for (const event of events) {
    if (event.playerId) {
      playerIds.add(event.playerId);
    }
    if (!isRecord(event.payload)) {
      continue;
    }
    for (const key of ["playerId", "actorPlayerId", "targetPlayerId"]) {
      const value = event.payload[key];
      if (typeof value === "string" && value) {
        playerIds.add(value);
      }
    }
  }
  return playerIds;
}

async function getRoomTranscriptPage(request: Request, env: Env, roomIdParam: string): Promise<Response> {
  const url = new URL(request.url);
  const roomId = validateRoomId(roomIdParam);
  if (!(await roomExists(env, roomId))) {
    return new Response("Room not found", { status: 404 });
  }
  const [records, events] = await Promise.all([listRoomRecords(env, roomId), listRoomEvents(env, roomId, { fullHistory: true })]);
  const viewerModeParam = url.searchParams.get("viewer");
  const viewerPlayerIdParam = url.searchParams.get("viewer_player_id");
  const viewerMode = viewerModeParam === "public" || viewerModeParam === "player" || viewerModeParam === "dead" || viewerModeParam === "gm" ? viewerModeParam : "legacy";
  if (viewerMode === "player" && !viewerPlayerIdParam) {
    throw new Error("Player transcript viewer requires viewer_player_id");
  }
  const viewerPlayerId = viewerPlayerIdParam ? validatePlayerId(viewerPlayerIdParam) : undefined;
  if (viewerMode === "player" && viewerPlayerId && !roomTranscriptKnownPlayerIds(records, events).has(viewerPlayerId)) {
    throw new Error("Player transcript viewer is not part of this room history");
  }
  return html(renderRoomTranscript(roomId, records, events, {
    heavenTalk: url.searchParams.get("heaven_talk") === "on",
    heavenOnly: url.searchParams.get("heaven_only") === "on",
    reverseLog: url.searchParams.get("reverse_log") === "on",
    viewerMode,
    viewerPlayerId,
    oldLogReturnHref: oldLogReturnHref(url),
    playerViewFormAction: url.pathname === "/old_log.php" || url.pathname === "/game_log.php" ? url.pathname : undefined,
    playerViewHiddenInputs: url.pathname === "/old_log.php" || url.pathname === "/game_log.php"
      ? { ...(url.pathname === "/old_log.php" ? { log_mode: "on", room_no: roomId } : { room_no: roomId, log_mode: "on" }) }
      : undefined,
    legacyTranscriptPath: url.pathname === "/old_log.php" || url.pathname === "/game_log.php" ? url.pathname : undefined
  }));
}

function oldLogReturnHref(url: URL): string | undefined {
  const params = new URLSearchParams();
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = readPositivePage(url.searchParams.get("page"));
  if (search) {
    params.set("search", search);
  }
  if (url.searchParams.get("all") === "1") {
    params.set("all", "1");
  } else if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/old_log.php?${query}` : undefined;
}

function isPrivateRoomEvent(event: RoomEventSummary): boolean {
  return isRecord(event.payload) && event.payload.visibility === "private";
}

async function listRoomEvents(env: Env, roomId: string, options: { fullHistory?: boolean } = {}): Promise<RoomEventSummary[]> {
  const eventQuery = options.fullHistory
    ? "SELECT id, room_id, player_id, event_type, payload_json, created_at FROM room_events WHERE room_id = ? ORDER BY created_at DESC"
    : "SELECT id, room_id, player_id, event_type, payload_json, created_at FROM room_events WHERE room_id = ? ORDER BY created_at DESC LIMIT 50";
  const [status, result] = await Promise.all([
    getRoomStatusValue(env, roomId),
    env.DB.prepare(eventQuery)
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
    const roomId = await createRoomFromData(env, body);

    return json({ roomId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create room" }, { status: 400 });
  }
}

async function createLegacyRoom(request: Request, env: Env): Promise<Response> {
  if (await isMaintenanceMode(env)) {
    return json({ error: "Server is under maintenance" }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const command = readFormString(form, "command") ?? "";
    if (command !== "CREATE_ROOM") {
      throw new Error("Invalid room_manager.php command");
    }
    const foxVariant = readFormString(form, "option_role_foxs") ?? "";
    const poisonVariants = form.getAll("option_role_poison").filter((value): value is string => typeof value === "string");
    const poisonVariant = poisonVariants.includes("cat") ? "cat" : poisonVariants.includes("poison") ? "poison" : "";
    const forcePoisonWithFox = foxVariant !== "" && hasFormValue(form, "option_role_pobe");
    const playerId = readFormString(form, "playerId") ?? readFormString(form, "player_id") ?? `player_${crypto.randomUUID().replaceAll("-", "")}`;
    const nickname = readFormString(form, "nickname") ?? readFormString(form, "handle_name") ?? "建村者";
    const options = {
      poison: poisonVariant === "poison" || forcePoisonWithFox,
      bigWolf: hasFormValue(form, "option_wfbig_poison"),
      authority: hasFormValue(form, "option_role_authority"),
      decider: hasFormValue(form, "option_role_decide"),
      lovers: hasFormValue(form, "option_role_lovers"),
      betrayer: foxVariant === "betr",
      childFox: foxVariant === "fosi",
      twoFoxes: foxVariant === "foxs",
      cat: poisonVariant === "cat",
      lastWords: hasFormValue(form, "game_option_will"),
      openVote: hasFormValue(form, "game_option_open_vote"),
      commonTalkVisible: hasFormValue(form, "game_option_comm_out"),
      deadRoleVisible: poisonVariant === "cat" ? false : readFormString(form, "dellook") === "1",
      wishRole: hasFormValue(form, "game_option_wish_role"),
      tripRequired: hasFormValue(form, "game_option_trip"),
      gmEnabled: hasFormValue(form, "game_option_gm"),
      gmTrip: readFormString(form, "game_option_manager_trip") ?? "",
      dummyBoy: hasFormValue(form, "game_option_dummy_boy"),
      customDummy: hasFormValue(form, "game_option_cust_dummy"),
      dummyName: readFormString(form, "dummy_name") ?? "替身君",
      dummyLastWords: readFormString(form, "dummy_lw") ?? "",
      realTime: hasFormValue(form, "game_option_real_time"),
      dayMinutes: readFormString(form, "game_option_real_time_day") ?? DEFAULT_DAY_MINUTES,
      nightMinutes: readFormString(form, "game_option_real_time_night") ?? DEFAULT_NIGHT_MINUTES,
      selfVote: hasFormValue(form, "game_option_vote_me"),
      voteStatus: hasFormValue(form, "game_option_votedisplay")
    };
    const roomId = await createRoomFromData(env, {
      name: readFormString(form, "room_name") ?? "",
      comment: readFormString(form, "room_comment") ?? "",
      maxPlayers: readFormString(form, "max_user") ?? 22,
      playerId,
      nickname,
      options
    });

    return new Response(null, { status: 303, headers: { Location: `/login.php?room_no=${encodeURIComponent(roomId)}` } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to create room" }, { status: 400 });
  }
}

async function createRoomFromData(env: Env, body: Record<string, unknown>): Promise<string> {
  const roomId = generateRoomId();
  const name = validateRoomName(String(body.name));
  const comment = validateRoomComment(typeof body.comment === "string" ? body.comment : "");
  const maxPlayers = validateRoomCapacity(body.maxPlayers ?? 22);
  const playerId = validatePlayerId(String(body.playerId));
  const nickname = validateNickname(String(body.nickname));
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

  return roomId;
}

async function uploadAvatar(request: Request, env: Env, legacyResult = false): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const playerIdValue = form?.get("playerId") ?? form?.get("player_id");
  const avatarValue = form?.get("avatar") ?? form?.get("icon_file");
  if (typeof playerIdValue !== "string" || !isFileLike(avatarValue)) {
    if (legacyResult) {
      return legacyIconResult("圖像上傳結果", "錯誤或有遺漏", "/icon_upload.php", "", 400);
    }
    return json({ error: "Invalid avatar upload" }, { status: 400 });
  }

  try {
    const playerId = validatePlayerId(playerIdValue);
    if (!isAllowedAvatarContentType(avatarValue.type)) {
      if (legacyResult) {
        return legacyIconResult("圖像上傳結果", "不接受此類型", "/icon_upload.php", "", 400);
      }
      return json({ error: "Avatar must be a PNG, JPEG, GIF, or WebP image" }, { status: 400 });
    }
    if (avatarValue.size > 512 * 1024) {
      if (legacyResult) {
        return legacyIconResult("圖像上傳結果", "圖片超過限制", "/icon_upload.php", "", 400);
      }
      return json({ error: "Avatar is too large" }, { status: 400 });
    }

    const key = avatarKey(playerId);
    await env.ASSETS.put(key, avatarValue.stream(), {
      httpMetadata: { contentType: avatarValue.type }
    });
    if (legacyResult) {
      return legacyIconResult(
        "圖像上傳結果",
        "上傳完成<br>",
        "/icon_view.php",
        `<br><img src="/assets/avatar/${encodeURIComponent(playerId)}" alt=""><br>圖片上傳後會以 Cloudflare R2 保存為玩家頭像。<br>`
      );
    }
    return json({ key });
  } catch (error) {
    if (legacyResult) {
      return legacyIconResult("圖像上傳結果", escapeHtml(error instanceof Error ? error.message : "失敗"), "/icon_upload.php", "", 400);
    }
    return json({ error: error instanceof Error ? error.message : "Failed to upload avatar" }, { status: 400 });
  }
}

async function removeAvatar(request: Request, env: Env, legacyResult = false): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  let playerIdValue: unknown;
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData().catch(() => null);
    playerIdValue = form?.get("playerId") ?? form?.get("player_id");
  } else {
    const body: unknown = await request.json().catch(() => null);
    playerIdValue = isRecord(body) ? body.playerId : undefined;
  }
  if (typeof playerIdValue !== "string") {
    if (legacyResult) {
      return legacyIconResult("アイコン削除失敗", "削除失敗：玩家ID有誤", "/icon_upload.php", "", 400);
    }
    return json({ error: "Invalid avatar removal" }, { status: 400 });
  }

  try {
    const playerId = validatePlayerId(playerIdValue);
    await env.ASSETS.delete(avatarKey(playerId));
    if (legacyResult) {
      return legacyIconRemovalResult();
    }
    return json({ removed: true });
  } catch (error) {
    if (legacyResult) {
      return legacyIconResult("アイコン削除失敗", escapeHtml(error instanceof Error ? error.message : "削除失敗"), "/icon_upload.php", "", 400);
    }
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

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.php" || url.pathname === "/room_manager.php")) {
      const [rooms, announcement, maintenanceMode] = await Promise.all([listRooms(env), getHomeAnnouncement(env), isMaintenanceMode(env)]);
      return html(renderHome(rooms, announcement, maintenanceMode));
    }

    if (request.method === "GET" && url.pathname === "/announcement.txt") {
      return getAnnouncementText(env);
    }

    if (request.method === "GET" && url.pathname === "/api/rooms") {
      return json({ rooms: await listRooms(env) });
    }

    if (request.method === "GET" && url.pathname === "/api.php") {
      const activeRooms = (await listRooms(env)).filter((room) => room.status !== "ended");
      return text(activeRooms.map((room) => legacyFederatedApiLine(room, url.origin)).join("\n") + (activeRooms.length ? "\n" : ""));
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

    if (request.method === "GET" && (url.pathname === "/stats" || url.pathname === "/stats.php")) {
      return html(renderWinRateAnalysis(await listWinRateAnalysis(env)));
    }

    if (request.method === "GET" && (url.pathname === "/list" || url.pathname === "/list.php")) {
      const federatedList = await listFederatedRooms(env);
      return html(renderFederatedList(federatedList.rooms, federatedList.peers, {
        backPageHref: safeLegacyBackPage(url.searchParams.get("back_page"), url.origin)
      }));
    }

    if (request.method === "GET" && (url.pathname === "/logs" || url.pathname === "/old_log.php")) {
      if (url.pathname === "/old_log.php" && url.searchParams.get("log_mode") === "on") {
        try {
          const roomId = url.searchParams.get("room_no");
          if (!roomId) {
            throw new Error("old_log.php requires room_no");
          }
          return await getRoomTranscriptPage(request, env, roomId);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
        }
      }
      const search = url.searchParams.get("search")?.trim() ?? "";
      const page = readPositivePage(url.searchParams.get("page"));
      const showAll = url.searchParams.get("all") === "1";
      const endedRooms = (await listRooms(env)).filter((room) => room.status === "ended");
      const filteredRooms = search
        ? endedRooms.filter((room) => room.id.includes(search) || room.name.includes(search))
        : endedRooms;
      const visibleRooms = showAll ? filteredRooms : filteredRooms.slice((page - 1) * OLD_LOG_PAGE_SIZE, page * OLD_LOG_PAGE_SIZE);
      return html(renderOldLogs(visibleRooms, {
        search,
        winners: await listLatestRoomWinners(env, visibleRooms.map((room) => room.id)),
        page,
        pageSize: OLD_LOG_PAGE_SIZE,
        totalRooms: filteredRooms.length,
        showAll
      }));
    }

    if (request.method === "GET" && (url.pathname === "/trip" || url.pathname === "/trip.php")) {
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "trip" && url.searchParams.get("id")) {
        return getLegacyTripDetail(env, url.searchParams.get("id") ?? "");
      }
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "room" && url.searchParams.get("id")) {
        return getLegacyTripRoomRecords(env, url.searchParams.get("id") ?? "", url.searchParams.get("play"), url.searchParams.get("page"));
      }
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "smess" && url.searchParams.get("id")) {
        try {
          const trip = validateTrip(url.searchParams.get("id") ?? "");
          const page = readPositivePage(url.searchParams.get("page"));
          return html(renderTripComments(trip, await listTripScores(env, trip, TRIP_SCORE_PAGE_SIZE, (page - 1) * TRIP_SCORE_PAGE_SIZE), {
            page,
            pageSize: TRIP_SCORE_PAGE_SIZE,
            totalScores: await countTripScores(env, trip)
          }));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid Trip" }, { status: 400 });
        }
      }
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "sce" && url.searchParams.get("room") && url.searchParams.get("trip")) {
        try {
          return html(renderTripRating(validateRoomId(url.searchParams.get("room") ?? ""), validateTrip(url.searchParams.get("trip") ?? "")));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid Trip rating request" }, { status: 400 });
        }
      }
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "search") {
        const searchName = url.searchParams.get("sname") ?? "";
        if (searchName) {
          try {
            const trip = validateTrip(searchName);
            return new Response(null, {
              status: 303,
              headers: { Location: `/trip.php?go=trip&id=${encodeURIComponent(trip)}` }
            });
          } catch {
            return html(renderTripLookup());
          }
        }
        return html(renderTripLookup());
      }
      if (url.pathname === "/trip.php" && url.searchParams.get("go") === "icon") {
        return html(renderIconCatalog());
      }
      return html(renderTripRegistration());
    }

    if (request.method === "GET" && url.pathname === "/trips") {
      return html(renderTripLookup());
    }

    if (request.method === "GET" && (url.pathname === "/bbs" || url.pathname === "/bbs.php")) {
      const legacyBbsGo = url.searchParams.get("go");
      const view = url.searchParams.get("view") ?? (legacyBbsGo === "postre" || legacyBbsGo === "edit" ? url.searchParams.get("id") : null);
      const digestOnly = url.searchParams.get("digest") === "1" || url.searchParams.get("go") === "dige";
      const page = readPositivePage(url.searchParams.get("page"));
      if (view) {
        try {
          const topicId = validateBbsTopicId(view);
          const topic = await getBbsTopicById(env, topicId);
          if (!topic) {
            return new Response("BBS topic not found", { status: 404 });
          }
          return html(renderBbsTopic(topic, await listBbsReplies(env, topicId, BBS_REPLY_PAGE_SIZE, (page - 1) * BBS_REPLY_PAGE_SIZE), {
            page,
            pageSize: BBS_REPLY_PAGE_SIZE,
            totalReplies: await countBbsReplies(env, topicId)
          }));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid BBS topic" }, { status: 400 });
        }
      }
      return html(renderBbs(await listBbsTopics(env, digestOnly, BBS_TOPIC_PAGE_SIZE, (page - 1) * BBS_TOPIC_PAGE_SIZE), {
        digestOnly,
        page,
        pageSize: BBS_TOPIC_PAGE_SIZE,
        totalTopics: await countBbsTopics(env, digestOnly)
      }));
    }

    const bbsTopicPageMatch = url.pathname.match(/^\/bbs\/(\d+)$/);
    if (request.method === "GET" && bbsTopicPageMatch) {
      const topicId = validateBbsTopicId(bbsTopicPageMatch[1]);
      const page = readPositivePage(url.searchParams.get("page"));
      const topic = await getBbsTopicById(env, topicId);
      if (!topic) {
        return new Response("BBS topic not found", { status: 404 });
      }
      return html(renderBbsTopic(topic, await listBbsReplies(env, topicId, BBS_REPLY_PAGE_SIZE, (page - 1) * BBS_REPLY_PAGE_SIZE), {
        page,
        pageSize: BBS_REPLY_PAGE_SIZE,
        totalReplies: await countBbsReplies(env, topicId)
      }));
    }

    if (request.method === "GET" && (url.pathname === "/icons" || url.pathname === "/icon_view.php" || url.pathname === "/icon_upload.php" || url.pathname === "/upload.php" || url.pathname === "/upload2.php")) {
      const activeMenu = url.pathname === "/icon_upload.php" || url.pathname === "/upload.php" || url.pathname === "/upload2.php" ? "/icon_upload.php" : "/icon_view.php";
      return html(renderIconCatalog(activeMenu));
    }

    if (request.method === "GET" && url.pathname === "/api/config") {
      return getRuntimeConfig(env);
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/config") {
      return updateRuntimeConfig(request, env);
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

    if (request.method === "GET" && (url.pathname === "/rules" || url.pathname === "/rule.php" || url.pathname === "/lang/jpn/rule.php")) {
      return html(renderRules());
    }

    if (request.method === "GET" && url.pathname === "/manual") {
      return html(renderManual());
    }

    if (request.method === "GET" && (url.pathname === "/script-info" || url.pathname === "/script_info.php" || url.pathname === "/lang/jpn/script_info.php")) {
      return html(renderScriptInfo());
    }

    if (request.method === "GET" && url.pathname === "/protocol") {
      return html(renderProtocol());
    }

    if (request.method === "GET" && (url.pathname === "/version" || url.pathname === "/version.php" || url.pathname === "/lang/cht/version.htm")) {
      return html(renderVersion());
    }

    if (request.method === "GET" && (
      url.pathname === "/status" ||
      url.pathname === "/admin/status" ||
      (url.pathname === "/admin.php" && url.searchParams.get("go") === "status")
    )) {
      try {
        const [health, config] = await Promise.all([readHealth(env), readRuntimeConfig(env)]);
        return html(renderStatus({ ...health, ...config }));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Status check failed" }, { status: 503 });
      }
    }

    if (request.method === "GET" && url.pathname === "/admin.php" && url.searchParams.get("go") === "del") {
      return endRoomByLegacyAdminLink(request, env, url.searchParams.get("id") ?? "", "/admin.php");
    }

    if (request.method === "POST" && url.pathname === "/admin.php" && url.searchParams.get("go") === "in") {
      return loginLegacyAdmin(request);
    }

    if (request.method === "GET" && url.pathname === "/admin.php" && url.searchParams.get("go") === "out") {
      return new Response(null, { status: 303, headers: { Location: "/index.php", "Set-Cookie": "adpass=; Path=/; Max-Age=0; SameSite=Lax" } });
    }

    if (request.method === "GET" && url.pathname === "/admin.php" && !url.searchParams.has("go") && (url.searchParams.has("token") || readCookie(request, "adpass"))) {
      return renderAdminRoomsPage(request, env);
    }

    if (request.method === "GET" && (url.pathname === "/admin" || (url.pathname === "/admin.php" && !url.searchParams.has("go")))) {
      return html(renderAdminIndex());
    }

    if (request.method === "GET" && (url.pathname === "/admin/bbs" || (url.pathname === "/admin.php" && url.searchParams.get("go") === "bbs"))) {
      const page = readPositivePage(url.searchParams.get("page"));
      return html(renderBbsAdmin(await listBbsTopics(env, false, BBS_TOPIC_PAGE_SIZE, (page - 1) * BBS_TOPIC_PAGE_SIZE), {
        page,
        pageSize: BBS_TOPIC_PAGE_SIZE,
        totalTopics: await countBbsTopics(env)
      }));
    }

    if (request.method === "GET" && (url.pathname === "/admin/rooms" || (url.pathname === "/admin.php" && url.searchParams.get("go") === "rooms"))) {
      return renderAdminRoomsPage(request, env);
    }

    if (request.method === "GET" && (url.pathname === "/admin/config" || (url.pathname === "/admin.php" && url.searchParams.get("go") === "config"))) {
      const authError = await requireConfigAdmin(request, env);
      if (authError) {
        return html(renderAdminConfigLogin());
      }
      return html(renderAdminConfig(await readRuntimeConfig(env), url.searchParams.get("token") ?? ""));
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
        return html(renderRoomRecords(roomId, await listRoomRecords(env, roomId), { oldLogReturnHref: oldLogReturnHref(url) }));
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
        return html(renderRoomEvents(roomId, await listRoomEvents(env, roomId, { fullHistory: true }), { oldLogReturnHref: oldLogReturnHref(url) }));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
    }

    const roomTranscriptPageMatch = url.pathname.match(/^\/room\/([^/]+)\/log$/);
    const isLegacyGameLogPage = url.pathname === "/game_log.php";
    const legacyGameLogRoomId = isLegacyGameLogPage ? url.searchParams.get("room_no") : null;
    if (request.method === "GET" && (roomTranscriptPageMatch || isLegacyGameLogPage)) {
      try {
        if (!roomTranscriptPageMatch && !legacyGameLogRoomId) {
          throw new Error("game_log.php requires room_no");
        }
        return await getRoomTranscriptPage(request, env, roomTranscriptPageMatch ? roomTranscriptPageMatch[1] : legacyGameLogRoomId ?? "");
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

    if (request.method === "POST" && url.pathname === "/room_manager.php") {
      return createLegacyRoom(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/trips") {
      return registerTrip(request, env);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "post") {
      return registerLegacyTrip(request, env);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "out") {
      return excludeLegacyTrip(request, env);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "edit") {
      return legacyTripResult("修改Trip", "此 Cloudflare 版本不保存舊 PHP 管理密碼；請使用認領身份流程綁定目前玩家。", "/trip.php?go=edit", 501);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "edit2") {
      return legacyTripResult("修改紀錄", "此 Cloudflare 版本不保存過去紀錄村民註冊密碼；請使用認領身份流程綁定目前玩家。", "/trip.php?go=edit2", 501);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "accadd") {
      return legacyTripResult("認領帳號", "此 Cloudflare 版本不保存過去紀錄村民註冊密碼；請使用認領身份流程綁定目前玩家。", "/trip.php?go=accadd", 501);
    }

    if (request.method === "POST" && url.pathname === "/trip.php" && url.searchParams.get("go") === "sce") {
      const roomId = url.searchParams.get("room") ?? "";
      const tripId = url.searchParams.get("trip") ?? "";
      const backHref = roomId && tripId ? `/trip.php?go=sce&room=${encodeURIComponent(roomId)}&trip=${encodeURIComponent(tripId)}` : "/trip.php";
      return legacyTripResult("評分", "此 Cloudflare 版本尚未提供 PHP session 驗證的 Trip 評分寫入；評分表單僅作為相容顯示。", backHref, 501);
    }

    if (request.method === "POST" && url.pathname === "/api/bbs/topics") {
      return createBbsTopic(request, env);
    }

    if (request.method === "POST" && url.pathname === "/bbs.php" && url.searchParams.get("go") === "post") {
      return createLegacyBbsTopic(request, env);
    }

    if (request.method === "POST" && url.pathname === "/bbs.php" && url.searchParams.get("go") === "postre") {
      return createLegacyBbsReply(request, env);
    }

    if (request.method === "POST" && url.pathname === "/bbs.php" && url.searchParams.get("go") === "edit") {
      return editLegacyBbsTopic(request, env, url.searchParams.get("id") ?? "");
    }

    const bbsReplyApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/replies$/);
    if (request.method === "POST" && bbsReplyApiMatch) {
      return createBbsReply(request, env, bbsReplyApiMatch[1]);
    }

    const bbsReplyModerationApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/replies\/(\d+)\/moderation$/);
    if (request.method === "PATCH" && bbsReplyModerationApiMatch) {
      return updateBbsReplyContent(request, env, bbsReplyModerationApiMatch[1], bbsReplyModerationApiMatch[2]);
    }

    if (request.method === "DELETE" && bbsReplyModerationApiMatch) {
      return deleteBbsReply(request, env, bbsReplyModerationApiMatch[1], bbsReplyModerationApiMatch[2]);
    }

    const bbsTopicContentApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/content$/);
    if (request.method === "PATCH" && bbsTopicContentApiMatch) {
      return updateBbsTopicContent(request, env, bbsTopicContentApiMatch[1]);
    }

    const bbsModerationApiMatch = url.pathname.match(/^\/api\/bbs\/topics\/(\d+)\/moderation$/);
    if (request.method === "PATCH" && bbsModerationApiMatch) {
      return updateBbsTopicFlags(request, env, bbsModerationApiMatch[1]);
    }

    if (request.method === "DELETE" && bbsModerationApiMatch) {
      return deleteBbsTopic(request, env, bbsModerationApiMatch[1]);
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

    if (request.method === "POST" && url.pathname === "/upload.php") {
      return uploadAvatar(request, env, true);
    }

    if (request.method === "DELETE" && url.pathname === "/api/assets/avatar") {
      return removeAvatar(request, env);
    }

    if (request.method === "POST" && url.pathname === "/upload2.php") {
      return removeAvatar(request, env, true);
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
    const isLegacyLiveRoomPage =
      url.pathname === "/game_view.php" ||
      url.pathname === "/game_play.php" ||
      url.pathname === "/game_frame.php" ||
      url.pathname === "/game_up.php" ||
      url.pathname === "/game_vote.php" ||
      url.pathname === "/login.php" ||
      url.pathname === "/user_manager.php";
    const legacyLiveRoomId = isLegacyLiveRoomPage ? url.searchParams.get("room_no") : null;
    if (request.method === "GET" && url.pathname === "/game_play.php" && url.searchParams.get("go") === "del") {
      return endRoomByLegacyAdminLink(request, env, url.searchParams.get("id") ?? legacyLiveRoomId ?? "", "/admin/rooms");
    }
    if (request.method === "GET" && url.pathname === "/game_play.php" && url.searchParams.get("go") === "out") {
      try {
        if (!legacyLiveRoomId) {
          throw new Error("game_play.php out requires room_no");
        }
        const roomId = validateRoomId(legacyLiveRoomId);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return new Response(null, { status: 303, headers: { Location: `/game_view.php?room_no=${encodeURIComponent(roomId)}` } });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid room" }, { status: 400 });
      }
    }
    if (request.method === "POST" && url.pathname === "/game_vote.php") {
      try {
        const form = await request.formData().catch(() => null);
        const command = url.searchParams.get("command") ?? (form ? readFormString(form, "command") : undefined) ?? "vote";
        if (command !== "vote") {
          throw new Error("Invalid game_vote.php command");
        }
        const roomIdParam = legacyLiveRoomId ?? (form ? readFormString(form, "room_no") : undefined);
        if (!roomIdParam) {
          throw new Error("game_vote.php vote requires room_no");
        }
        const roomId = validateRoomId(roomIdParam);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return new Response(null, { status: 303, headers: { Location: `/game_vote.php?room_no=${encodeURIComponent(roomId)}#game_top` } });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid vote" }, { status: 400 });
      }
    }
    if (request.method === "POST" && url.pathname === "/user_manager.php") {
      try {
        const form = await request.formData().catch(() => null);
        const command = url.searchParams.get("command") ?? (form ? readFormString(form, "command") : undefined) ?? "regist";
        if (command !== "regist") {
          throw new Error("Invalid user_manager.php command");
        }
        const roomIdParam = legacyLiveRoomId ?? (form ? readFormString(form, "room_no") : undefined);
        if (!roomIdParam) {
          throw new Error("user_manager.php regist requires room_no");
        }
        const roomId = validateRoomId(roomIdParam);
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        return new Response(null, { status: 303, headers: { Location: `/login.php?room_no=${encodeURIComponent(roomId)}` } });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid user registration" }, { status: 400 });
      }
    }
    if (request.method === "GET" && (roomMatch || isLegacyLiveRoomPage)) {
      try {
        if (!roomMatch && !legacyLiveRoomId) {
          throw new Error(`${url.pathname.slice(1)} requires room_no`);
        }
        const roomId = validateRoomId(roomMatch ? roomMatch[1] : legacyLiveRoomId ?? "");
        if (!(await roomExists(env, roomId))) {
          return new Response("Room not found", { status: 404 });
        }
        const autoReloadParam = url.searchParams.get("auto_reload");
        const viewModeParam = url.searchParams.get("view");
        const viewMode = viewModeParam === "spectator" || viewModeParam === "heaven" ? viewModeParam : url.pathname === "/game_view.php" ? "spectator" : "player";
        const pageMode = url.pathname === "/game_frame.php" ? "frame" : url.pathname === "/game_up.php" ? "up" : url.pathname === "/game_vote.php" ? "vote" : "full";
        return html(renderRoom(roomId, {
          autoReloadSeconds: autoReloadParam ? Number(autoReloadParam) : 0,
          viewMode,
          pageMode,
          legacyPath: isLegacyLiveRoomPage ? url.pathname as LegacyRoomPath : undefined
        }));
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
