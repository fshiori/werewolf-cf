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
  FosiDivine = 'fosi_divine',
  CatResurrect = 'cat_resurrect',
  FoxDivine = 'fox_divine',
  BetrConvert = 'betr_convert',
  GuardShoot = 'guard_shoot',
  GuardProtect = 'guard_protect',
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
  guardedTarget?: string; // 守護者保護的目標 uname
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
 * 驗證狼人夜晚擊殺目標是否合法（含 dummy_boy parity）
 */
export function canWolfKillTarget(
  players: Map<string, Player>,
  actorUname: string,
  targetUname: string,
  currentDate: number,
  dummyBoyEnabled: boolean
): boolean {
  const actor = players.get(actorUname);
  const target = players.get(targetUname);

  if (!actor || actor.live !== 'live' || !target || target.live !== 'live') {
    return false;
  }

  const actorIsWolf = actor.role.includes('wolf') || actor.role === 'wfbig';
  if (!actorIsWolf) {
    return false;
  }

  if (actorUname === targetUname) {
    return false;
  }

  if (target.role.includes('wolf')) {
    return false;
  }

  // legacy parity: GM 不屬於可被夜晚擊殺目標
  if (target.role === 'GM') {
    return false;
  }

  // legacy parity: dummy_boy 啟用且第 1 天夜晚，狼人只能投 dummy_boy
  if (dummyBoyEnabled && currentDate === 1 && targetUname !== 'dummy_boy') {
    return false;
  }

  return true;
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

    // 檢查是否被守護者保護
    if (state.guardedTarget && state.guardedTarget === target) {
      continue; // 守護成功，不加入受害者
    }

    state.victims.push(target);
    addNightAction(state, NightActionType.WolfKill, 'wolf', target);
  }
}

/**
 * 大狼占卜偽裝判定（legacy 近似行為）
 * 回傳 true 表示本次被判定為 human
 */
export function shouldMaskWfbigAsHuman(): boolean {
  // 參照 legacy game_vote.php 的隨機偽裝語義（偏高機率）
  return Math.random() < 0.7;
}

/**
 * 子狐對大狼的占卜偽裝判定（legacy 近似行為，偽裝率更高）
 */
export function shouldMaskWfbigAsHumanForFosi(): boolean {
  return Math.random() < 0.96;
}

/**
 * 子狐占卜結果是否偽裝為 nofosi（legacy: randme(101,200) >= 140）
 */
export function shouldReturnNoFosiResult(): boolean {
  return Math.random() < 0.61;
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
  let result: 'wolf' | 'human';
  if (targetPlayer.role === 'wfbig') {
    result = shouldMaskWfbigAsHuman() ? 'human' : 'wolf';
  } else {
    result = (targetPlayer.role.includes('wolf') || targetPlayer.role === 'mad')
      ? 'wolf'
      : 'human';
  }

  state.divineResults.set(seer, result);
  addNightAction(state, NightActionType.SeerDivine, seer, target, result);

  return result;
}

/**
 * 子狐占卜（legacy FOSI_DO 近似）
 * - 可檢出狼（含大狼）
 * - 對大狼有高機率誤判為 human
 * - 整體結果可被偽裝為 nofosi
 */
export function fosiDivine(
  state: NightState,
  players: Map<string, Player>,
  fosi: string,
  target: string
): 'wolf' | 'human' | 'nofosi' | null {
  const fosiPlayer = players.get(fosi);
  const targetPlayer = players.get(target);

  if (!fosiPlayer || !targetPlayer) {
    return null;
  }

  if (fosiPlayer.role !== 'fosi') {
    return null;
  }

  const isWolfLike = targetPlayer.role.includes('wolf') || targetPlayer.role === 'wfbig';

  let result: 'wolf' | 'human' | 'nofosi' = 'human';
  if (isWolfLike) {
    if (targetPlayer.role === 'wfbig') {
      result = shouldMaskWfbigAsHumanForFosi() ? 'human' : 'wolf';
    } else {
      result = 'wolf';
    }
  }

  if (shouldReturnNoFosiResult()) {
    result = 'nofosi';
  }

  state.divineResults.set(fosi, result);
  addNightAction(state, NightActionType.FosiDivine, fosi, target, result);

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
 * 守護者保護目標
 * @returns true 表示守護成功
 */
export function guardTarget(
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

  // 檢查是否為守護者
  if (guardPlayer.role !== 'guard') {
    return false;
  }

  // 守護者必須存活
  if (guardPlayer.live !== 'live') {
    return false;
  }

  // 不能守護自己
  if (guard === target) {
    return false;
  }

  // 目標必須存活
  if (targetPlayer.live !== 'live') {
    return false;
  }

  // 同一晚不能重複設定同一目標
  if (state.guardedTarget === target) {
    return false;
  }

  // 設定守護目標
  state.guardedTarget = target;
  addNightAction(state, NightActionType.GuardProtect, guard, target);

  return true;
}

/**
 * 貓又夜晚行動（CAT_DO）
 * 指定一名目標，夜晚結算時有機率復活目標
 */
export function catResurrect(
  state: NightState,
  players: Map<string, Player>,
  cat: string,
  target: string
): boolean {
  const catPlayer = players.get(cat);
  const targetPlayer = players.get(target);

  if (!catPlayer || !targetPlayer) {
    return false;
  }

  if (catPlayer.role !== 'cat' || catPlayer.live !== 'live') {
    return false;
  }

  if (cat === target) {
    return false;
  }

  addNightAction(state, NightActionType.CatResurrect, cat, target);
  return true;
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
  const catBlocked = new Set<string>();

  // 處理所有受害者（legacy: 貓又被狼咬有機率不死）
  for (const victim of state.victims) {
    const player = players.get(victim);
    if (!player || player.live !== 'live') {
      continue;
    }

    if (player.role === 'cat' && Math.random() < 0.11) {
      catBlocked.add(player.uname);
      continue;
    }

    player.live = 'dead';
    dead.push(player);
  }

  // legacy parity: 夜晚被狼咬死的毒系（poison/cat）會反噴一名存活狼人
  const poisonTriggers = dead.filter(p => p.role === 'poison' || p.role === 'cat');
  for (const _trigger of poisonTriggers) {
    const aliveWolves = Array.from(players.values()).filter(
      p => p.live === 'live' && (p.role.includes('wolf') || p.role === 'wfbig')
    );
    if (aliveWolves.length === 0) {
      continue;
    }

    const idx = Math.floor(Math.random() * aliveWolves.length);
    const retaliationTarget = aliveWolves[idx];
    if (!retaliationTarget || retaliationTarget.live !== 'live') {
      continue;
    }

    retaliationTarget.live = 'dead';
    dead.push(retaliationTarget);
  }

  // legacy parity: CAT_DO（cat_resurrect）
  const catActions = state.actions.filter(a => a.type === NightActionType.CatResurrect);
  for (const action of catActions) {
    const actor = players.get(action.actor);
    const target = action.target ? players.get(action.target) : undefined;

    if (!actor || actor.role !== 'cat' || actor.live !== 'live') {
      continue;
    }
    if (catBlocked.has(actor.uname)) {
      continue;
    }
    if (!target || target.live !== 'dead') {
      continue;
    }

    if (Math.random() < 0.11) {
      target.live = 'live';
      const idx = dead.findIndex(p => p.uname === target.uname);
      if (idx >= 0) {
        dead.splice(idx, 1);
      }
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
  state.guardedTarget = undefined;
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

  const aliveGuards = Array.from(players.values()).filter(
    p => p.role === 'guard' && p.live === 'live'
  );

  const aliveFosi = Array.from(players.values()).filter(
    p => p.role === 'fosi' && p.live === 'live'
  );

  const aliveCats = Array.from(players.values()).filter(
    p => p.role === 'cat' && p.live === 'live'
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

  // 檢查守護者是否行動（保護或跳過）
  const guardActed = state.actions.some(a =>
    a.type === NightActionType.GuardProtect ||
    (a.type === NightActionType.Skip && aliveGuards.some(g => g.uname === a.actor))
  );

  // 檢查子狐是否行動（占卜或跳過）
  const fosiActed = state.actions.some(a =>
    a.type === NightActionType.FosiDivine ||
    (a.type === NightActionType.Skip && aliveFosi.some(f => f.uname === a.actor))
  );

  // 檢查貓又是否行動（CAT_DO 或跳過）
  const catActed = state.actions.some(a =>
    a.type === NightActionType.CatResurrect ||
    (a.type === NightActionType.Skip && aliveCats.some(c => c.uname === a.actor))
  );

  if (aliveWolves.length > 0 && !wolfActed) {
    return false;
  }

  if (aliveSeers.length > 0 && !seerActed) {
    return false;
  }

  if (aliveGuards.length > 0 && !guardActed) {
    return false;
  }

  if (aliveFosi.length > 0 && !fosiActed) {
    return false;
  }

  if (aliveCats.length > 0 && !catActed) {
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

  // 守護成功保護了某人
  if (state.guardedTarget) {
    parts.push('守護成功保護了一人');
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
