/**
 * 密語系統
 */

import type { Player, Role } from '../types';

/**
 * 密語訊息
 */
export interface WhisperMessage {
  id: string;
  roomNo: number;
  date: number;
  from: string;
  to: string;
  message: string;
  time: number;
}

/**
 * 密語管理器
 */
export class WhisperManager {
  constructor(private db: any) {}

  /**
   * 建立密語訊息 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 傳送密語
   */
  async sendWhisper(
    roomNo: number,
    date: number,
    from: string,
    to: string,
    message: string
  ): Promise<string> {
    const id = this.generateId();

    await this.db
      .prepare(`
        INSERT INTO whispers (id, room_no, date, from_uname, to_uname, message, time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        roomNo,
        date,
        from,
        to,
        message,
        Math.floor(Date.now() / 1000)
      )
      .run();

    return id;
  }

  /**
   * 獲取玩家的密語歷史
   */
  async getPlayerWhispers(
    roomNo: number,
    uname: string,
    limit: number = 50
  ): Promise<WhisperMessage[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM whispers
        WHERE room_no = ? AND (from_uname = ? OR to_uname = ?)
        ORDER BY time DESC
        LIMIT ?
      `)
      .bind(roomNo, uname, uname, limit)
      .all();

    return result.results.map((r: any) => ({
      ...r,
      time: r.time * 1000
    }));
  }

  /**
   * 獲取特定對話的密語
   */
  async getConversation(
    roomNo: number,
    uname1: string,
    uname2: string,
    limit: number = 50
  ): Promise<WhisperMessage[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM whispers
        WHERE room_no = ?
          AND ((from_uname = ? AND to_uname = ?) OR (from_uname = ? AND to_uname = ?))
        ORDER BY time ASC
        LIMIT ?
      `)
      .bind(roomNo, uname1, uname2, uname2, uname1, limit)
      .all();

    return result.results.map((r: any) => ({
      ...r,
      time: r.time * 1000
    }));
  }

  /**
   * 檢查玩家是否可以密語（委託給純函數 canWhisper）
   * @deprecated 請直接使用匯出的 canWhisper 純函數
   */
  async canWhisper(
    roomNo: number,
    from: string,
    to: string,
    phase: string
  ): Promise<boolean> {
    // 向後相容：舊的 API 簽名不包含 players，一律回傳 true（夜間）
    // 新的 API 請直接用匯出的 canWhisper(from, to, phase, players)
    return phase === 'night';
  }

  /**
   * 刪除房間的所有密語
   */
  async deleteRoomWhispers(roomNo: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM whispers WHERE room_no = ?')
      .bind(roomNo)
      .run();
  }

  /**
   * 獲取密語統計
   */
  async getWhisperStats(roomNo: number): Promise<{
    totalWhispers: number;
    activeConversations: number;
  }> {
    const totalResult = await this.db
      .prepare(`
        SELECT COUNT(*) as count FROM whispers
        WHERE room_no = ?
      `)
      .bind(roomNo)
      .first();

    // 統計活躍對話
    const convResult = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT CONCAT(
          LEAST(from_uname, to_uname),
          '-',
          GREATEST(from_uname, to_uname)
        )) as count
        FROM whispers
        WHERE room_no = ?
      `)
      .bind(roomNo)
      .first();

    return {
      totalWhispers: (totalResult as any).count,
      activeConversations: (convResult as any).count
    };
  }
}

/**
 * 可密語的角色列表（夜晚才能密語）
 * 預言家、靈媒、狼人系列、妖狐系列、背德者、大狼
 */
const WHISPER_ROLES: Role[] = [
  'mage',         // 預言家
  'necromancer',  // 靈媒
  'wolf',         // 狼人
  'wolf_partner', // 狼人夥伴
  'wfbig',        // 大狼
  'fox',          // 妖狐
  'betr',         // 背德者
];

/**
 * 檢查玩家是否可以密語（純函數，不依賴資料庫）
 *
 * 規則：
 * - 只有夜晚可以密語
 * - 只有特定角色可以密語（預言家、靈媒、狼人系列、妖狐、背德者）
 * - 死亡玩家不能密語也不能接收密語
 * - 不能密語自己
 *
 * @param from   發送者 uname
 * @param to     接收者 uname
 * @param phase  遊戲階段（day / night / beforegame 等）
 * @param players 所有玩家列表（用於查找角色與存活狀態）
 */
export function canWhisper(
  from: string,
  to: string,
  phase: string,
  players: Player[]
): boolean {
  // 不能密語自己
  if (from === to) {
    return false;
  }

  // 只有夜晚可以密語
  if (phase !== 'night') {
    return false;
  }

  // 查找發送者與接收者
  const sender = players.find((p) => p.uname === from);
  const receiver = players.find((p) => p.uname === to);

  // 找不到玩家則拒絕
  if (!sender || !receiver) {
    return false;
  }

  // 死亡玩家不能密語
  if (sender.live !== 'live') {
    return false;
  }

  // 接收者已死亡則不能密語
  if (receiver.live !== 'live') {
    return false;
  }

  // 檢查發送者角色是否在允許密語列表中
  return WHISPER_ROLES.includes(sender.role);
}
