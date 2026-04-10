/**
 * 遺書系統
 */

/**
 * 遺書資料
 */
export interface WillData {
  roomNo: number;
  date: number;
  uname: string;
  handleName: string;
  will: string;
  time: number;
}

/**
 * 遺書管理器
 */
export class WillManager {
  constructor(private db: any) {}

  /**
   * 儲存遺書
   */
  async saveWill(will: WillData): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO wills (room_no, date, uname, handle_name, will, time)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        will.roomNo,
        will.date,
        will.uname,
        will.handleName,
        will.will,
        Math.floor(will.time / 1000)
      )
      .run();
  }

  /**
   * 獲取房間的所有遺書
   */
  async getRoomWills(roomNo: number): Promise<WillData[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM wills
        WHERE room_no = ?
        ORDER BY time ASC
      `)
      .bind(roomNo)
      .all();

    return result.results.map((r: any) => ({
      ...r,
      time: r.time * 1000
    }));
  }

  /**
   * 獲取特定日期的遺書
   */
  async getDateWills(roomNo: number, date: number): Promise<WillData[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM wills
        WHERE room_no = ? AND date = ?
        ORDER BY time ASC
      `)
      .bind(roomNo, date)
      .all();

    return result.results.map((r: any) => ({
      ...r,
      time: r.time * 1000
    }));
  }

  /**
   * 獲取玩家的遺書
   */
  async getPlayerWill(roomNo: number, uname: string): Promise<WillData | null> {
    const result = await this.db
      .prepare(`
        SELECT * FROM wills
        WHERE room_no = ? AND uname = ?
        ORDER BY date DESC
        LIMIT 1
      `)
      .bind(roomNo, uname)
      .first();

    if (!result) return null;

    return {
      ...result,
      time: (result as any).time * 1000
    } as WillData;
  }

  /**
   * 檢查玩家是否已留遺書
   */
  async hasPlayerLeftWill(roomNo: number, uname: string): Promise<boolean> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count FROM wills
        WHERE room_no = ? AND uname = ?
      `)
      .bind(roomNo, uname)
      .first();

    return (result as any).count > 0;
  }

  /**
   * 刪除房間的所有遺書
   */
  async deleteRoomWills(roomNo: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM wills WHERE room_no = ?')
      .bind(roomNo)
      .run();
  }

  /**
   * 獲取遺書統計
   */
  async getWillStats(roomNo: number): Promise<{
    totalWills: number;
    averageLength: number;
  }> {
    const result = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as count,
          AVG(LENGTH(will)) as avg_length
        FROM wills
        WHERE room_no = ?
      `)
      .bind(roomNo)
      .first();

    return {
      totalWills: (result as any).count,
      averageLength: Math.round((result as any).avg_length || 0)
    };
  }
}
