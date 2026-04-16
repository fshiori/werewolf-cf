/**
 * 角色系統
 */

import type { Role, Player } from '../types';

/**
 * 角色陣營
 */
export type RoleTeam = 'human' | 'wolf' | 'fox';

/**
 * 判斷角色陣營
 */
export function getRoleTeam(role: Role): RoleTeam {
  if (role.includes('wolf') || role === 'mad') {
    return 'wolf';
  } else if (role.includes('fox') || role === 'betr' || role === 'fosi') {
    return 'fox';
  } else {
    return 'human';
  }
}

/**
 * 判斷是否為狼人陣營
 */
export function isWolfTeam(role: Role): boolean {
  return getRoleTeam(role) === 'wolf';
}

/**
 * 判斷是否為村民陣營
 */
export function isHumanTeam(role: Role): boolean {
  return getRoleTeam(role) === 'human';
}

/**
 * 判斷是否為妖狐陣營
 */
export function isFoxTeam(role: Role): boolean {
  return getRoleTeam(role) === 'fox';
}

/**
 * 判斷角色是否可以在夜晚行動
 */
export function canActAtNight(role: Role): boolean {
  const nightActionRoles: Role[] = [
    'wolf',
    'wolf_partner',
    'mage',        // 預言家
    'fox',
    'betr',        // 背德者
    'wfbig',       // 大狼
  ];
  
  return nightActionRoles.includes(role);
}

/**
 * 判斷角色是否可以在白天行動
 */
export function canActAtDay(role: Role): boolean {
  const dayActionRoles: Role[] = [
    'necromancer', // 靈媒
  ];
  
  return dayActionRoles.includes(role);
}

/**
 * 勝負判定
 */
export function checkVictory(players: Player[]): string | null {
  const alivePlayers = players.filter(p => p.live === 'live');
  
  if (alivePlayers.length === 0) {
    return null;
  }

  const aliveWolves = alivePlayers.filter(p => isWolfTeam(p.role)).length;
  const aliveVillagers = alivePlayers.filter(p => isHumanTeam(p.role)).length;
  const aliveFoxes = alivePlayers.filter(p => p.role === 'fox' || p.role === 'fosi').length;
  const aliveBetr = alivePlayers.filter(p => p.role === 'betr').length;

  // 檢查妖狐勝利條件（妖狐存活且狼人全滅且妖狐數量 >= 村民數量）
  if (aliveFoxes > 0 && aliveWolves === 0 && aliveFoxes >= aliveVillagers) {
    return 'fox';
  }

  // 檢查背德者勝利條件（妖狐死亡但背德者存活，且狼人全滅）
  if (aliveBetr > 0 && aliveFoxes === 0 && aliveWolves === 0) {
    return 'betr';
  }

  // 檢查村民勝利條件（所有非村民陣營死亡）
  if (aliveWolves === 0 && aliveFoxes === 0 && aliveBetr === 0) {
    return 'human';
  }

  // 檢查狼人勝利條件
  if (aliveWolves >= aliveVillagers) {
    return 'wolf';
  }

  // 遊戲繼續
  return null;
}

/**
 * 取得勝利訊息
 * 根據勝利陣營返回對應的詳細說明訊息
 */
export function getVictoryMessage(winner: string): string {
  switch (winner) {
    case 'human':
      return '所有狼人已被消滅，村民陣營獲勝！';
    case 'wolf':
      return '狼人數量壓倒村民，狼人陣營獲勝！';
    case 'fox':
      return '妖狐存活且狼人全滅，妖狐陣營獲勝！';
    case 'betr':
      return '妖狐死亡但背德者存活，背德者單獨獲勝！';
    default:
      return `未知勝利陣營：${winner}`;
  }
}

/**
 * 隨機分配角色
 */
export function assignRoles(
  players: Player[],
  roleConfig: Record<Role, number>
): void {
  // 建立角色池
  const rolePool: Role[] = [];
  for (const [role, count] of Object.entries(roleConfig)) {
    for (let i = 0; i < count; i++) {
      rolePool.push(role as Role);
    }
  }

  // Fisher-Yates 洗牌
  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  // 分配角色
  players.forEach((player, index) => {
    if (index < rolePool.length) {
      player.role = rolePool[index];
    } else {
      player.role = 'human'; // 超出人數的默認為村民
    }
  });
}

/**
 * 檢查玩家是否存活
 */
export function isPlayerAlive(player: Player): boolean {
  return player.live === 'live';
}

/**
 * 檢查玩家是否可以說話
 */
export function canSpeak(player: Player, phase: 'day' | 'night'): boolean {
  if (!isPlayerAlive(player)) {
    return false;
  }

  // 死人不能說話（除非有特殊規則）
  // 靈媒白天可以說話
  if (player.role === 'necromancer' && phase === 'day') {
    return true;
  }

  return player.live === 'live';
}

/**
 * 檢查玩家是否可以投票
 */
export function canVote(player: Player): boolean {
  if (!isPlayerAlive(player)) {
    return false;
  }

  // 某些角色可能不能投票
  return player.live === 'live';
}

/**
 * 計算投票權重
 */
export function getVoteWeight(player: Player): number {
  // 權力者投票權重 x2
  if (player.role === 'authority') {
    return 2;
  }
  
  return 1;
}

/**
 * 判斷角色是否為共有者
 */
export function isCommoner(role: Role): boolean {
  return role === 'common' || role === 'common_partner';
}

/**
 * 判斷角色是否為戀人
 */
export function isLover(role: Role): boolean {
  return role === 'lovers' || role === 'lovers_partner';
}

/**
 * 判斷角色是否為妖狐相關
 */
export function isFoxRelated(role: Role): boolean {
  return role === 'fox' || role === 'fosi' || role === 'betr' || role === 'betr_partner';
}
