/**
 * 開局投票狀態計算（legacy GAMESTART parity）
 */

export interface StartGameVoteState {
  votedUsers: string[];
  votedCount: number;
  totalRequired: number;
  ready: boolean;
}

/**
 * 根據目前等待中的玩家，計算開局投票狀態。
 * - 只保留仍在 waiting 名單內的投票者
 * - 需 waiting 全員都投票才可開始
 */
export function buildStartGameVoteState(
  votedUsers: string[],
  waitingUsers: string[]
): StartGameVoteState {
  const waitingSet = new Set(waitingUsers);
  const normalized = votedUsers.filter(uname => waitingSet.has(uname));

  return {
    votedUsers: normalized,
    votedCount: normalized.length,
    totalRequired: waitingUsers.length,
    ready: waitingUsers.length > 0 && normalized.length >= waitingUsers.length,
  };
}
