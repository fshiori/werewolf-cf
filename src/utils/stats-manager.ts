/**
 * 統計系統
 */

/**
 * 統計資料
 */
export interface StatsData {
  totalRooms: number;
  activeRooms: number;
  totalPlayers: number;
  activePlayers: number;
  totalGames: number;
  completedGames: number;
  humanWins: number;
  wolfWins: number;
  foxWins: number;
  averageGameDuration: number;
  lastUpdated: number;
}

/**
 * 房間統計
 */
export interface RoomStats {
  roomNo: number;
  roomName: string;
  playerCount: number;
  status: string;
  date: number;
  dayNight: string;
  createdAt: number;
}

/**
 * 統計管理器
 */
export class StatsManager {
  constructor(private kv: KVNamespace) {}

  /**
   * 更新統計資料
   */
  async updateStats(updates: Partial<StatsData>): Promise<void> {
    const current = await this.getStats();
    
    const updated: StatsData = {
      ...current,
      ...updates,
      lastUpdated: Date.now()
    };

    await this.kv.put('stats:global', JSON.stringify(updated));
  }

  /**
   * 獲取統計資料
   */
  async getStats(): Promise<StatsData> {
    const data = await this.kv.get('stats:global', 'json');
    
    if (data && typeof data === 'object') {
      return data as StatsData;
    }

    // 回傳預設值
    return {
      totalRooms: 0,
      activeRooms: 0,
      totalPlayers: 0,
      activePlayers: 0,
      totalGames: 0,
      completedGames: 0,
      humanWins: 0,
      wolfWins: 0,
      foxWins: 0,
      averageGameDuration: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * 增加房間計數
   */
  async incrementRoomCount(): Promise<void> {
    const stats = await this.getStats();
    stats.totalRooms++;
    await this.updateStats(stats);
  }

  /**
   * 更新房間狀態
   */
  async updateRoomStatus(active: number): Promise<void> {
    const stats = await this.getStats();
    stats.activeRooms = active;
    await this.updateStats(stats);
  }

  /**
   * 增加玩家計數
   */
  async incrementPlayerCount(count: number = 1): Promise<void> {
    const stats = await this.getStats();
    stats.totalPlayers += count;
    await this.updateStats(stats);
  }

  /**
   * 更新活躍玩家數
   */
  async updateActivePlayerCount(count: number): Promise<void> {
    const stats = await this.getStats();
    stats.activePlayers = count;
    await this.updateStats(stats);
  }

  /**
   * 記錄遊戲開始
   */
  async recordGameStart(): Promise<void> {
    const stats = await this.getStats();
    stats.totalGames++;
    await this.updateStats(stats);
  }

  /**
   * 記錄遊戲結束
   */
  async recordGameEnd(winner: string, duration: number): Promise<void> {
    const stats = await this.getStats();
    stats.completedGames++;
    
    if (winner === 'human') {
      stats.humanWins++;
    } else if (winner.includes('wolf') || winner === 'mad') {
      stats.wolfWins++;
    } else if (winner.includes('fox')) {
      stats.foxWins++;
    }

    // 更新平均遊戲時長
    const totalDuration = stats.averageGameDuration * (stats.completedGames - 1) + duration;
    stats.averageGameDuration = totalDuration / stats.completedGames;
    
    await this.updateStats(stats);
  }

  /**
   * 獲取房間統計
   */
  async getRoomStats(): Promise<RoomStats[]> {
    const list = await this.kv.list({ prefix: 'stats:room:' });
    const rooms: RoomStats[] = [];

    for (const key of list.keys) {
      const data = await this.kv.get(key.name, 'json');
      
      if (data && typeof data === 'object') {
        rooms.push(data as RoomStats);
      }
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 更新房間統計
   */
  async updateRoomStats(roomNo: number, stats: Partial<RoomStats>): Promise<void> {
    const key = `stats:room:${roomNo}`;
    
    const current = await this.kv.get(key, 'json');
    const roomStats = current ? { ...current, ...stats } : stats;
    
    await this.kv.put(key, JSON.stringify(roomStats));
  }

  /**
   * 刪除房間統計
   */
  async deleteRoomStats(roomNo: number): Promise<void> {
    await this.kv.delete(`stats:room:${roomNo}`);
  }

  /**
   * 獲取熱門房間
   */
  async getPopularRooms(limit: number = 10): Promise<RoomStats[]> {
    const rooms = await this.getRoomStats();
    return rooms
      .filter(r => r.status === 'playing' || r.status === 'waiting')
      .sort((a, b) => b.playerCount - a.playerCount)
      .slice(0, limit);
  }

  /**
   * 獲取時段統計（過去 24 小時）
   */
  async getHourlyStats(): Promise<number[]> {
    const stats: number[] = new Array(24).fill(0);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // TODO: 實作更詳細的時段統計
    // 這裡只是示例
    
    return stats;
  }

  /**
   * 重置統計
   */
  async resetStats(): Promise<void> {
    const defaultStats: StatsData = {
      totalRooms: 0,
      activeRooms: 0,
      totalPlayers: 0,
      activePlayers: 0,
      totalGames: 0,
      completedGames: 0,
      humanWins: 0,
      wolfWins: 0,
      foxWins: 0,
      averageGameDuration: 0,
      lastUpdated: Date.now()
    };

    await this.kv.put('stats:global', JSON.stringify(defaultStats));
  }
}
