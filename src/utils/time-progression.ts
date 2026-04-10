/**
 * 時間流逝系統
 */

import type { GamePhase } from '../types';

export interface TimeConfig {
  dayLimit: number;      // 白天限制（預設 48）
  nightLimit: number;    // 夜晚限制（預設 24）
  silenceThreshold: number; // 沈默模式閾值（秒）
  silenceMultiplier: number; // 沈默倍數（預設 4）
}

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  dayLimit: 48,
  nightLimit: 24,
  silenceThreshold: 60,
  silenceMultiplier: 4
};

export interface TimeState {
  date: number;
  dayNight: GamePhase;
  timeSpent: number;
  lastMessageTime: number;
  isSilence: boolean;
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
