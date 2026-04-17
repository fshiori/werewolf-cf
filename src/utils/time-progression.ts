/**
 * 時間流逝系統
 */

import type { GamePhase } from '../types';

export interface TimeConfig {
  dayLimit: number;      // 白天限制（預設 48）
  nightLimit: number;    // 夜晚限制（預設 24）
  silenceThreshold: number; // 沈默模式閾值（秒）
  silenceMultiplier: number; // 沈默倍數（預設 4）
  /** 即時制：白天實際時間限制（秒），0 = 不啟用 */
  realTimeDayLimitSec: number;
  /** 即時制：夜晚實際時間限制（秒），0 = 不啟用 */
  realTimeNightLimitSec: number;
}

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  dayLimit: 48,
  nightLimit: 24,
  silenceThreshold: 60,
  silenceMultiplier: 4,
  realTimeDayLimitSec: 0,
  realTimeNightLimitSec: 0,
};

export interface TimeState {
  date: number;
  dayNight: GamePhase;
  timeSpent: number;
  lastMessageTime: number;
  isSilence: boolean;
  /** 即時制：當前階段開始的 epoch ms */
  phaseStartTimeMs: number;
}

/**
 * 計算虛擬時間
 */
export function calculateVirtualTime(
  spentUnits: number,
  phase: GamePhase,
  config: TimeConfig
): { hours: number; minutes: number } {
  const limit = phase === 'day' ? config.dayLimit : config.nightLimit;
  const totalMinutes = phase === 'day' ? 720 : 360; // 12h 或 6h
  const minutesPerUnit = totalMinutes / limit;
  const elapsedMinutes = spentUnits * minutesPerUnit;

  return {
    hours: Math.floor(elapsedMinutes / 60),
    minutes: Math.floor(elapsedMinutes % 60)
  };
}

/**
 * 進行時間
 * 返回是否需要轉換階段
 */
export function advanceTime(
  state: TimeState,
  units: number,
  config: TimeConfig
): boolean {
  const limit = state.dayNight === 'day' ? config.dayLimit : config.nightLimit;
  state.timeSpent += units;

  return state.timeSpent >= limit;
}

/**
 * 檢查沈默模式
 */
export function checkSilence(
  state: TimeState,
  currentTime: number,
  config: TimeConfig
): boolean {
  const timeSinceLastMessage = (currentTime - state.lastMessageTime) / 1000;
  
  if (timeSinceLastMessage > config.silenceThreshold) {
    state.isSilence = true;
    return true;
  }
  
  return false;
}

/**
 * 沈默模式時間推進
 * 返回推進的單位數
 */
export function advanceSilenceTime(
  state: TimeState,
  elapsedTime: number,
  config: TimeConfig
): number {
  if (!state.isSilence) {
    return 0;
  }

  // 沈默時時間流逝加快
  // 每秒推進的時間單位
  const unitsPerSecond = config.silenceMultiplier / 60; // 4 倍速
  const units = Math.floor(elapsedTime / 1000 * unitsPerSecond);

  return units;
}

/**
 * 轉換階段
 */
export function transitionPhase(state: TimeState): GamePhase {
  state.timeSpent = 0;
  state.isSilence = false;

  if (state.dayNight === 'day') {
    state.dayNight = 'night';
  } else {
    state.dayNight = 'day';
    state.date++;
  }

  return state.dayNight;
}

/**
 * 計算剩餘虛擬時間
 */
export function getRemainingVirtualTime(
  state: TimeState,
  config: TimeConfig
): { hours: number; minutes: number } {
  const limit = state.dayNight === 'day' ? config.dayLimit : config.nightLimit;
  const remainingUnits = limit - state.timeSpent;
  
  return calculateVirtualTime(remainingUnits, state.dayNight, config);
}

/**
 * 格式化虛擬時間顯示
 */
export function formatVirtualTime(time: { hours: number; minutes: number }): string {
  return `${time.hours}小時${time.minutes}分`;
}

// ── 即時制 (realTime token) ──

/**
 * 檢查即時制是否啟用（至少一個階段有實際時間限制）
 */
export function isRealTimeEnabled(config: TimeConfig): boolean {
  return config.realTimeDayLimitSec > 0 || config.realTimeNightLimitSec > 0;
}

/**
 * 取得當前階段的即時制限制（秒）
 */
export function getRealTimeLimitSec(state: TimeState, config: TimeConfig): number {
  return state.dayNight === 'day'
    ? config.realTimeDayLimitSec
    : config.realTimeNightLimitSec;
}

/**
 * 檢查即時制是否已到期
 * @returns true 表示該轉換階段了
 */
export function isRealTimeExpired(state: TimeState, config: TimeConfig): boolean {
  const limitSec = getRealTimeLimitSec(state, config);
  if (limitSec <= 0) return false;
  const elapsed = (Date.now() - state.phaseStartTimeMs) / 1000;
  return elapsed >= limitSec;
}

/**
 * 取得即時制剩餘時間（秒），負數表示已超時
 */
export function getRealTimeRemainingSec(state: TimeState, config: TimeConfig): number {
  const limitSec = getRealTimeLimitSec(state, config);
  if (limitSec <= 0) return Infinity;
  const elapsed = (Date.now() - state.phaseStartTimeMs) / 1000;
  return limitSec - elapsed;
}

/**
 * 開始新的即時制階段（設定 phaseStartTimeMs）
 */
export function startRealTimePhase(state: TimeState): void {
  state.phaseStartTimeMs = Date.now();
}

/**
 * 日間超時後，是否到達突然死處理窗口
 * legacy 參考值：120 秒 grace period
 */
export function shouldTriggerSuddenDeath(
  phase: GamePhase,
  dayTimeoutAtMs: number | undefined,
  nowMs: number,
  graceSec = 120,
): boolean {
  if (phase !== 'day' || !dayTimeoutAtMs) {
    return false;
  }
  return (nowMs - dayTimeoutAtMs) >= graceSec * 1000;
}
