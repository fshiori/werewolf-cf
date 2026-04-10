/**
 * 密語系統
 */

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
   * 檢查玩家是否可以密語
   */
  async canWhisper(
    roomNo: number,
    from: string,
    to: string,
    phase: string
  ): Promise<boolean> {
    // 只有夜晚可以密語
    if (phase !== 'night') {
      return false;
    }

    // TODO: 檢查角色是否有密語權限
    // 預言家、靈媒等特殊角色可以密語
    
    return true;
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
