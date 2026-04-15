/**
 * 夜晚行動系統
 */

import type { Player, Role } from '../types';

/**
 * 夜晚行動類型
 */
export enum NightActionType {
  WolfKill = 'wolf_kill',
  SeerDivine = 'seer_divine',
  FoxDivine = 'fox_divine',
  BetrConvert = 'betr_convert',
  GuardShoot = 'guard_shoot',
  Skip = 'skip',
}

/**
 * 夜晚行動資料
 */
export interface NightAction {
  type: NightActionType;
  actor: string; // uname
  target?: string; // uname
  result?: any;
}

/**
 * 夜晚狀態
 */
export interface NightState {
  roomNo: number;
  date: number;
  actions: NightAction[];
  victims: string[]; // 被殺的玩家
  divineResults: Map<string, string>; // 占卜結果
  converted: string[]; // 被轉化的玩家
}

/**
 * 建立夜晚狀態
 */
export function createNightState(roomNo: number, date: number): NightState {
  return {
    roomNo,
    date,
    actions: [],
    victims: [],
    divineResults: new Map(),
    converted: []
  };
}

/**
 * 加入夜晚行動
 */
export function addNightAction(
  state: NightState,
  type: NightActionType,
  actor: string,
  target?: string,
  result?: any
): void {
  state.actions.push({ type, actor, target, result });
}

/**
 * 狼人殺人
 */
export function wolfKill(
  state: NightState,
  players: Map<string, Player>,
  targets: string[]
): void {
  for (const target of targets) {
    const player = players.get(target);
    if (!player || player.live !== 'live') {
      continue;
    }

    // 檢查是否被守護（如果有守護角色）
    // TODO: 實作守護邏輯

    state.victims.push(target);
    addNightAction(state, NightActionType.WolfKill, 'wolf', target);
  }
}

/**
 * 預言家占卜
 */
export function seerDivine(
  state: NightState,
  players: Map<string, Player>,
  seer: string,
  target: string
): 'wolf' | 'human' | null {
  const seerPlayer = players.get(seer);
  const targetPlayer = players.get(target);

  if (!seerPlayer || !targetPlayer) {
    return null;
  }

  // 檢查是否為預言家
  if (seerPlayer.role !== 'mage') {
    return null;
  }

  // 占卜結果
  const result = targetPlayer.role.includes('wolf') || targetPlayer.role === 'mad'
    ? 'wolf'
    : 'human';

  state.divineResults.set(seer, result);
  addNightAction(state, NightActionType.SeerDivine, seer, target, result);

  return result;
}

/**
 * 妖狐占卜（被占卜會毒死）
 */
export function foxDivine(
  state: NightState,
  players: Map<string, Player>,
  seer: string,
  target: string
): boolean {
  const targetPlayer = players.get(target);
  if (!targetPlayer) {
    return false;
  }

  // 如果目標是妖狐，預言家會毒死
  if (targetPlayer.role === 'fox') {
    state.victims.push(seer); // 預言家毒死
    addNightAction(state, NightActionType.SeerDivine, seer, target, 'poisoned');
    return true;
  }

  return false;
}

/**
 * 背德者轉化
 */
export function betrayerConvert(
  state: NightState,
  players: Map<string, Player>,
  betrayer: string,
  target: string
): boolean {
  const betrayerPlayer = players.get(betrayer);
  const targetPlayer = players.get(target);

  if (!betrayerPlayer || !targetPlayer) {
    return false;
  }

  // 檢查是否為背德者
  if (betrayerPlayer.role !== 'betr') {
    return false;
  }

  // 只能轉化村民
  if (targetPlayer.role !== 'human') {
    return false;
  }

  // 轉化為背德者夥伴
  targetPlayer.role = 'betr_partner';
  state.converted.push(target);
  addNightAction(state, NightActionType.BetrConvert, betrayer, target);

  return true;
}

/**
 * 獵人發動能力
 */
export function guardShoot(
  state: NightState,
  players: Map<string, Player>,
  guard: string,
  target: string
): boolean {
  const guardPlayer = players.get(guard);
  const targetPlayer = players.get(target);

  if (!guardPlayer || !targetPlayer) {
    return false;
  }

  // 檢查是否為獵人且已死亡
  if (guardPlayer.role !== 'guard' || guardPlayer.live === 'live') {
    return false;
  }

  // 射殺目標
  if (targetPlayer.live === 'live') {
    targetPlayer.live = 'dead';
    state.victims.push(target);
    addNightAction(state, NightActionType.GuardShoot, guard, target);
    return true;
  }

  return false;
}

/**
 * 處理夜晚結果
 * 返回死亡玩家列表
 */
export function processNightResult(
  state: NightState,
  players: Map<string, Player>
): Player[] {
  const dead: Player[] = [];

  // 處理所有受害者
  for (const victim of state.victims) {
    const player = players.get(victim);
    if (player && player.live === 'live') {
      player.live = 'dead';
      dead.push(player);
    }
  }

  return dead;
}

/**
 * 清空夜晚狀態
 */
export function clearNightState(state: NightState): void {
  state.actions = [];
  state.victims = [];
  state.divineResults.clear();
  state.converted = [];
}

/**
 * 檢查夜晚行動是否完成
 * 所有有夜晚能力的角色都已完成行動
 */
export function isNightActionsComplete(
  state: NightState,
  players: Map<string, Player>
): boolean {
  const aliveWolves = Array.from(players.values()).filter(
    p => (p.role.includes('wolf') || p.role === 'mad') && p.live === 'live'
  );

  const aliveSeers = Array.from(players.values()).filter(
    p => p.role === 'mage' && p.live === 'live'
  );

  // 檢查狼人是否行動（殺人或跳過）
  const wolfActed = state.actions.some(a =>
    a.type === NightActionType.WolfKill ||
    (a.type === NightActionType.Skip && aliveWolves.some(w => w.uname === a.actor))
  );

  // 檢查占卜家是否行動（占卜或跳過）
  const seerActed = state.actions.some(a =>
    a.type === NightActionType.SeerDivine ||
    (a.type === NightActionType.Skip && aliveSeers.some(s => s.uname === a.actor))
  );

  if (aliveWolves.length > 0 && !wolfActed) {
    return false;
  }

  if (aliveSeers.length > 0 && !seerActed) {
    return false;
  }

  return true;
}

/**
 * 獲取夜晚結果摘要
 */
export function getNightSummary(state: NightState): string {
  const parts: string[] = [];

  if (state.victims.length > 0) {
    parts.push(`${state.victims.length} 人死亡`);
  }

  if (state.converted.length > 0) {
    parts.push(`${state.converted.length} 人被轉化`);
  }

  if (parts.length === 0) {
    return '昨晚是平安夜';
  }

  return `昨晚 ${parts.join('，')}`;
}

/**
 * 隨機選擇狼人殺人目標
 * （如果狼人沒有指定目標）
 */
export function randomWolfKill(
  state: NightState,
  players: Map<string, Player>
): void {
  const wolves = Array.from(players.values()).filter(
    p => p.role.includes('wolf') && p.live === 'live'
  );

  if (wolves.length === 0) {
    return;
  }

  // 隨機選擇一個非狼人玩家
  const targets = Array.from(players.values()).filter(
    p => !p.role.includes('wolf') && !p.role.includes('fox') && p.live === 'live'
  );

  if (targets.length === 0) {
    return;
  }

  const target = targets[Math.floor(Math.random() * targets.length)];
  wolfKill(state, players, [target.uname]);
}
