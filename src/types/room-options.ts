/**
 * RoomOptions 型別定義與解析器
 *
 * 提供房間選項的型別安全解析，API 與 DO 共用一致的資料結構。
 */

// 房間選項介面
export interface RoomOptions {
  /** 發言時間限制（秒） */
  timeLimit: number;
  /** 沈默加速模式 */
  silenceMode: boolean;
  /** 允許觀戰 */
  allowSpectators: boolean;
  /** 最大觀戰人數 */
  maxSpectators: number;
  /** 啞巴男角色 */
  dummyBoy: boolean;
  /** 願望角色 */
  wishRole: boolean;
  /** 公開投票 */
  openVote: boolean;
  /** 刪文觀看權限 (0/1) */
  dellook: number;
  /** 遺言功能 */
  will: boolean;
  /** 自投功能 */
  voteMe: boolean;
  /** 需要 tripcode */
  tripRequired: boolean;
  /** 啟用 GM（遊戲管理員） */
  gmEnabled: boolean;
  // ── P0-3: legacy token stubs ──
  /** 即時制（白天/夜晚獨立計時器） */
  realTime: boolean;
  /** 即時制白天限制（秒） */
  realTimeDayLimitSec: number;
  /** 即時制夜晚限制（秒） */
  realTimeNightLimitSec: number;
  /** 連續出局處刑 */
  comoutl: boolean;
  /** 投票結果展示模式 (0=全隱, 1=全顯, 2=匿名) */
  voteDisplay: number;
  /** 自訂啞巴男 */
  custDummy: boolean;
  /** 旅人制度（使用 tripcode 追蹤） */
  istrip: boolean;
}

// 預設房間選項
export const DEFAULT_ROOM_OPTIONS: Readonly<RoomOptions> = {
  timeLimit: 60,
  silenceMode: false,
  allowSpectators: true,
  maxSpectators: 10,
  dummyBoy: false,
  wishRole: false,
  openVote: false,
  dellook: 0,
  will: true,
  voteMe: false,
  tripRequired: false,
  gmEnabled: false,
  // legacy token stubs
  realTime: false,
  realTimeDayLimitSec: 0,
  realTimeNightLimitSec: 0,
  comoutl: false,
  voteDisplay: 0,
  custDummy: false,
  istrip: false,
};

/**
 * 解析未知輸入為 RoomOptions，缺少或非法的欄位會 fallback 到預設值。
 */
export function parseRoomOptions(input: unknown): RoomOptions {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_ROOM_OPTIONS };
  }

  const raw = input as Record<string, unknown>;

  const timeLimit = parsePositiveNumber(raw.timeLimit) ?? DEFAULT_ROOM_OPTIONS.timeLimit;
  const legacyRealTimeSpec = parseLegacyRealTimeSpec(raw.realTime);
  const realTimeBoolean = parseBoolean(raw.realTime);
  const realTime = realTimeBoolean ?? (legacyRealTimeSpec ? true : DEFAULT_ROOM_OPTIONS.realTime);
  const explicitDayLimitSec = parsePositiveNumber(raw.realTimeDayLimitSec);
  const explicitNightLimitSec = parsePositiveNumber(raw.realTimeNightLimitSec);

  const realTimeDayLimitSec = realTime
    ? (explicitDayLimitSec ?? legacyRealTimeSpec?.daySec ?? timeLimit)
    : 0;
  const realTimeNightLimitSec = realTime
    ? (explicitNightLimitSec ?? legacyRealTimeSpec?.nightSec ?? Math.floor(timeLimit * 0.5))
    : 0;

  return {
    timeLimit,
    silenceMode: parseBoolean(raw.silenceMode) ?? DEFAULT_ROOM_OPTIONS.silenceMode,
    allowSpectators: parseBoolean(raw.allowSpectators) ?? DEFAULT_ROOM_OPTIONS.allowSpectators,
    maxSpectators: parseNonNegativeNumber(raw.maxSpectators) ?? DEFAULT_ROOM_OPTIONS.maxSpectators,
    dummyBoy: parseBoolean(raw.dummyBoy) ?? DEFAULT_ROOM_OPTIONS.dummyBoy,
    wishRole: parseBoolean(raw.wishRole) ?? DEFAULT_ROOM_OPTIONS.wishRole,
    openVote: parseBoolean(raw.openVote) ?? DEFAULT_ROOM_OPTIONS.openVote,
    dellook: parseDellook(raw.dellook) ?? DEFAULT_ROOM_OPTIONS.dellook,
    will: parseBoolean(raw.will) ?? DEFAULT_ROOM_OPTIONS.will,
    voteMe: parseBoolean(raw.voteMe) ?? DEFAULT_ROOM_OPTIONS.voteMe,
    tripRequired: parseBoolean(raw.tripRequired) ?? DEFAULT_ROOM_OPTIONS.tripRequired,
    gmEnabled: parseGmEnabled(raw.gmEnabled) ?? DEFAULT_ROOM_OPTIONS.gmEnabled,
    // legacy token stubs
    realTime,
    realTimeDayLimitSec,
    realTimeNightLimitSec,
    comoutl: parseBoolean(raw.comoutl) ?? DEFAULT_ROOM_OPTIONS.comoutl,
    voteDisplay: parseVoteDisplay(raw.voteDisplay) ?? DEFAULT_ROOM_OPTIONS.voteDisplay,
    custDummy: parseBoolean(raw.custDummy) ?? DEFAULT_ROOM_OPTIONS.custDummy,
    istrip: parseBoolean(raw.istrip) ?? DEFAULT_ROOM_OPTIONS.istrip,
  };
}

// ---- 內部輔助函數 ----

/** 解析為正整數（> 0），無效回傳 null */
function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

/** 解析為非負整數（>= 0），無效回傳 null */
function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

/** 解析為 boolean，嚴格只接受 true/false */
function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

/** 解析 dellook：接受 boolean 或 0/1，統一轉為 0/1 */
function parseDellook(value: unknown): number | null {
  if (value === 0 || value === 1) {
    return value;
  }
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

/** 解析 gmEnabled：接受 boolean 或 0/1，統一轉為 boolean */
function parseGmEnabled(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

/** 解析 voteDisplay：接受 0/1/2 或 boolean */
function parseVoteDisplay(value: unknown): number | null {
  if (value === 0 || value === 1 || value === 2) {
    return value;
  }
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

/**
 * 解析 legacy real_time 規格：
 * - "real_time:D:N"（分鐘）
 * - "D:N"（分鐘）
 */
function parseLegacyRealTimeSpec(value: unknown): { daySec: number; nightSec: number } | null {
  if (typeof value !== 'string') return null;

  const text = value.trim();
  const body = text.startsWith('real_time:') ? text.slice('real_time:'.length) : text;
  const parts = body.split(':');
  if (parts.length !== 2) return null;

  const dayMin = Number(parts[0]);
  const nightMin = Number(parts[1]);
  if (!Number.isFinite(dayMin) || !Number.isFinite(nightMin) || dayMin <= 0 || nightMin <= 0) {
    return null;
  }

  return {
    daySec: Math.floor(dayMin * 60),
    nightSec: Math.floor(nightMin * 60),
  };
}
