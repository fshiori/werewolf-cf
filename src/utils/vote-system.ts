/**
 * 投票系統
 */

import type { Player, Vote } from '../types';

/**
 * 投票資料
 */
export interface VoteData {
  roomNo: number;
  date: number;
  votes: Map<string, string>; // uname -> targetUname
  voteCounts: Map<string, number>; // targetUname -> count
}

/**
 * 建立投票資料
 */
export function createVoteData(roomNo: number, date: number): VoteData {
  return {
    roomNo,
    date,
    votes: new Map(),
    voteCounts: new Map()
  };
}

/**
 * 加入投票
 */
export function addVote(voteData: VoteData, uname: string, targetUname: string): boolean {
  // 檢查是否已投票
  if (voteData.votes.has(uname)) {
    return false;
  }

  // 移除舊投票（如果目標被重新投票）
  if (voteData.votes.has(uname)) {
    const oldTarget = voteData.votes.get(uname);
    if (oldTarget) {
      const count = voteData.voteCounts.get(oldTarget) || 0;
      if (count === 1) {
        voteData.voteCounts.delete(oldTarget);
      } else {
        voteData.voteCounts.set(oldTarget, count - 1);
      }
    }
  }

  // 加入新投票
  voteData.votes.set(uname, targetUname);
  const count = voteData.voteCounts.get(targetUname) || 0;
  voteData.voteCounts.set(targetUname, count + 1);

  return true;
}

/**
 * 取消投票
 */
export function removeVote(voteData: VoteData, uname: string): boolean {
  const target = voteData.votes.get(uname);
  if (!target) {
    return false;
  }

  // 減少票數
  const count = voteData.voteCounts.get(target) || 0;
  if (count === 1) {
    voteData.voteCounts.delete(target);
  } else {
    voteData.voteCounts.set(target, count - 1);
  }

  // 移除投票
  voteData.votes.delete(uname);

  return true;
}

/**
 * 獲得投票結果
 * 返回得票最多的玩家
 */
export function getVoteResult(voteData: VoteData): string[] {
  const maxVotes = Math.max(...voteData.voteCounts.values(), 0);
  
  if (maxVotes === 0) {
    return [];
  }

  // 找出所有得票最多的玩家（可能平手）
  const result: string[] = [];
  for (const [target, count] of voteData.voteCounts) {
    if (count === maxVotes) {
      result.push(target);
    }
  }

  return result;
}

/**
 * 檢查是否平手
 */
export function isTie(voteData: VoteData): boolean {
  const result = getVoteResult(voteData);
  return result.length > 1;
}

/**
 * 計算投票權重
 */
export function calculateWeightedVotes(
  voteData: VoteData,
  players: Map<string, Player>
): Map<string, number> {
  const weighted = new Map<string, number>();

  for (const [uname, target] of voteData.votes) {
    const player = players.get(uname);
    if (!player || player.live !== 'live') {
      continue;
    }

    // 權力者投票權重 x2
    const weight = player.role === 'authority' ? 2 : 1;
    const current = weighted.get(target) || 0;
    weighted.set(target, current + weight);
  }

  return weighted;
}

/**
 * 檢查投票是否完成
 * 所有存活玩家都已投票
 */
export function isVoteComplete(voteData: VoteData, alivePlayers: Player[]): boolean {
  const votedPlayers = Array.from(voteData.votes.keys()).filter(
    uname => alivePlayers.some(p => p.uname === uname && p.live === 'live')
  );

  return votedPlayers.length === alivePlayers.length;
}

/**
 * 處理投票處刑
 * 處決得票最多的玩家
 */
export function executeVote(
  voteData: VoteData,
  players: Map<string, Player>
): Player[] {
  const result = getVoteResult(voteData);
  const executed: Player[] = [];

  for (const uname of result) {
    const player = players.get(uname);
    if (player && player.live === 'live') {
      player.live = 'dead';
      executed.push(player);
    }
  }

  return executed;
}

/**
 * 清空投票
 */
export function clearVotes(voteData: VoteData): void {
  voteData.votes.clear();
  voteData.voteCounts.clear();
}

/**
 * 獲取投票統計
 */
export function getVoteStats(voteData: VoteData): Array<{
  uname: string;
  count: number;
}> {
  return Array.from(voteData.voteCounts.entries())
    .map(([uname, count]) => ({ uname, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 檢查玩家是否已投票
 */
export function hasVoted(voteData: VoteData, uname: string): boolean {
  return voteData.votes.has(uname);
}

/**
 * 取得目前已完成投票的玩家列表（依投票先後順序）
 */
export function getVotedUsers(voteData: VoteData): string[] {
  return Array.from(voteData.votes.keys());
}

/**
 * 獲取玩家的投票目標
 */
export function getPlayerVote(voteData: VoteData, uname: string): string | undefined {
  return voteData.votes.get(uname);
}

/**
 * 使用權重投票解析結果
 * 回傳 { executed: Player[], isTie: boolean, revote: boolean }
 *
 * - 計算加權票數（authority 算 2 票）
 * - 平手且無 decide 角色在平手者中 → revote=true, executed=[]
 * - 平手且有 decide 角色在平手者中 → 直接處決該 decide 玩家
 * - 非平手 → 處決最高票者
 */
export function resolveWeightedVoteResult(
  voteData: VoteData,
  players: Map<string, Player>
): { executed: Player[]; isTie: boolean; revote: boolean } {
  const weighted = calculateWeightedVotes(voteData, players);

  if (weighted.size === 0) {
    return { executed: [], isTie: false, revote: false };
  }

  const maxVotes = Math.max(...weighted.values(), 0);
  if (maxVotes === 0) {
    return { executed: [], isTie: false, revote: false };
  }

  // 找出所有最高加權票數的玩家
  const topTargets: string[] = [];
  for (const [target, count] of weighted) {
    if (count === maxVotes) {
      topTargets.push(target);
    }
  }

  if (topTargets.length === 1) {
    // 單一最高票 → 處決
    const player = players.get(topTargets[0]);
    if (player && player.live === 'live') {
      player.live = 'dead';
      return { executed: [player], isTie: false, revote: false };
    }
    return { executed: [], isTie: false, revote: false };
  }

  // 平手：檢查 decide 角色是否在平手玩家中
  const decideTarget = topTargets.find(t => {
    const p = players.get(t);
    return p && p.live === 'live' && p.role === 'decide';
  });

  if (decideTarget) {
    // 有 decide 玩家在平手中 → 直接處決
    const player = players.get(decideTarget)!;
    player.live = 'dead';
    return { executed: [player], isTie: true, revote: false };
  }

  // 平手且無 decide → 需要重新投票
  return { executed: [], isTie: true, revote: true };
}

/**
 * 隨機決定平手（突然死模式）
 */
export function randomTieBreak(voteData: VoteData): string {
  const result = getVoteResult(voteData);
  if (result.length === 0) {
    return '';
  }

  const randomIndex = Math.floor(Math.random() * result.length);
  return result[randomIndex];
}

/**
 * 轉換投票為資料庫格式
 */
export function voteToDatabase(voteData: VoteData, voteNumber: number): Vote[] {
  const votes: Vote[] = [];

  let voteTimes = 0;
  for (const [uname, targetUname] of voteData.votes) {
    votes.push({
      roomNo: voteData.roomNo,
      date: voteData.date,
      uname,
      targetUname,
      voteNumber,
      voteTimes: voteTimes++,
      situation: 'normal' // 預設情況
    });
  }

  return votes;
}

/**
 * 解析實際投票顯示模式（legacy openVote 相容）
 *
 * 規則：
 * - 若 voteDisplay 已明確設定為 1/2，優先使用它
 * - 若 voteDisplay 為 0 且 openVote=true，對齊 legacy「公開票數」語義 → 匿名模式(2)
 * - 其他情況維持 0
 */
export function resolveVoteDisplayMode(voteDisplay: number | undefined, openVote: boolean | undefined): number {
  const mode = voteDisplay ?? 0;
  if (mode === 1 || mode === 2) {
    return mode;
  }
  if (openVote) {
    return 2;
  }
  return 0;
}

/**
 * 驗證投票目標是否合法（voteMe 相容）
 */
export function canVoteTarget(
  players: Map<string, Player>,
  voterUname: string,
  targetUname: string,
  voteMeEnabled: boolean
): boolean {
  if (!targetUname || !targetUname.trim()) {
    return false;
  }

  const target = players.get(targetUname);
  if (!target || target.live !== 'live') {
    return false;
  }

  // legacy parity: 白天投票不可投給替身君或 GM
  if (target.uname === 'dummy_boy' || target.role === 'GM') {
    return false;
  }

  if (!voteMeEnabled && voterUname === targetUname) {
    return false;
  }

  return true;
}

// ── voteDisplay token: 投票結果展示 ──

/**
 * 根據 voteDisplay 模式過濾投票統計
 *
 * 0 = 不顯示任何投票資訊（回傳空陣列）
 * 1 = 顯示完整投票資訊（誰投給誰）
 * 2 = 匿名模式（只顯示票數，不顯示誰投給誰）
 *
 * @param voteData   投票資料
 * @param mode       voteDisplay 模式 (0/1/2)
 */
export function filterVoteDisplay(
  voteData: VoteData,
  mode: number
): { showResults: boolean; voteCounts: Array<{ uname: string; count: number }>; voterMap: Array<{ voter: string; target: string }> | null } {
  if (mode === 0) {
    // 完全隱藏
    return { showResults: false, voteCounts: [], voterMap: null };
  }

  const voteCounts = getVoteStats(voteData);

  if (mode === 2) {
    // 匿名：只顯示票數統計，不顯示誰投給誰
    return { showResults: true, voteCounts, voterMap: null };
  }

  // mode === 1: 完全顯示
  const voterMap = Array.from(voteData.votes.entries()).map(([voter, target]) => ({
    voter, target
  }));

  return { showResults: true, voteCounts, voterMap };
}
