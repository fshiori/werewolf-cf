/**
 * 統計系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StatsManager } from '../stats-manager';

// Mock KV
class MockKV {
  private store = new Map<string, string>();

  async get(key: string, format: 'json' | 'text' = 'json'): Promise<any> {
    const value = this.store.get(key);
    if (!value) return null;
    
    if (format === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.store.keys())
      .filter(k => !options?.prefix || k.startsWith(options.prefix))
      .map(name => ({ name }));
    
    return { keys };
  }
}

describe('StatsManager', () => {
  let manager: StatsManager;
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
    manager = new StatsManager(mockKV as any);
  });

  describe('獲取統計', () => {
    it('應該返回預設統計當沒有資料時', async () => {
      const stats = await manager.getStats();
      
      expect(stats.totalRooms).toBe(0);
      expect(stats.activeRooms).toBe(0);
      expect(stats.totalPlayers).toBe(0);
      expect(stats.activePlayers).toBe(0);
      expect(stats.totalGames).toBe(0);
      expect(stats.completedGames).toBe(0);
    });
  });

  describe('更新統計', () => {
    it('應該成功更新統計', async () => {
      await manager.updateStats({ totalRooms: 5 });
      
      const stats = await manager.getStats();
      expect(stats.totalRooms).toBe(5);
    });

    it('應該保留未更新的欄位', async () => {
      await manager.updateStats({ totalRooms: 5 });
      await manager.updateStats({ activeRooms: 3 });
      
      const stats = await manager.getStats();
      expect(stats.totalRooms).toBe(5);
      expect(stats.activeRooms).toBe(3);
    });
  });

  describe('房間計數', () => {
    it('應該增加房間計數', async () => {
      await manager.incrementRoomCount();
      await manager.incrementRoomCount();
      
      const stats = await manager.getStats();
      expect(stats.totalRooms).toBe(2);
    });

    it('應該更新活躍房間數', async () => {
      await manager.updateRoomStatus(5);
      
      const stats = await manager.getStats();
      expect(stats.activeRooms).toBe(5);
    });
  });

  describe('玩家計數', () => {
    it('應該增加玩家計數', async () => {
      await manager.incrementPlayerCount(5);
      await manager.incrementPlayerCount(3);
      
      const stats = await manager.getStats();
      expect(stats.totalPlayers).toBe(8);
    });

    it('應該更新活躍玩家數', async () => {
      await manager.updateActivePlayerCount(10);
      
      const stats = await manager.getStats();
      expect(stats.activePlayers).toBe(10);
    });
  });

  describe('遊戲統計', () => {
    it('應該記錄遊戲開始', async () => {
      await manager.recordGameStart();
      
      const stats = await manager.getStats();
      expect(stats.totalGames).toBe(1);
    });

    it('應該記錄遊戲結束', async () => {
      await manager.recordGameEnd('human', 300000); // 5 分鐘
      
      const stats = await manager.getStats();
      expect(stats.completedGames).toBe(1);
      expect(stats.humanWins).toBe(1);
      expect(stats.averageGameDuration).toBe(300000);
    });

    it('應該正確統計不同陣營勝利（含 betr/lovers）', async () => {
      await manager.recordGameEnd('human', 300000);
      await manager.recordGameEnd('wolf', 400000);
      await manager.recordGameEnd('fox', 500000);
      await manager.recordGameEnd('betr', 600000);
      await manager.recordGameEnd('lovers', 700000);

      const stats = await manager.getStats();
      expect(stats.humanWins).toBe(2); // human + lovers
      expect(stats.wolfWins).toBe(1);
      expect(stats.foxWins).toBe(2); // fox + betr
    });

    it('應該正確計算平均遊戲時長', async () => {
      await manager.recordGameEnd('human', 300000);
      await manager.recordGameEnd('human', 600000); // 10 分鐘
      
      const stats = await manager.getStats();
      expect(stats.averageGameDuration).toBe(450000); // 平均 7.5 分鐘
    });
  });

  describe('房間統計', () => {
    it('應該更新房間統計', async () => {
      await manager.updateRoomStats(1, {
        roomNo: 1,
        roomName: 'Test Room',
        playerCount: 5,
        status: 'playing',
        date: 1,
        dayNight: 'day',
        createdAt: Date.now()
      });
      
      const rooms = await manager.getRoomStats();
      expect(rooms.length).toBe(1);
      expect(rooms[0].roomName).toBe('Test Room');
    });

    it('應該獲取熱門房間', async () => {
      await manager.updateRoomStats(1, {
        roomNo: 1,
        roomName: 'Popular Room',
        playerCount: 10,
        status: 'playing',
        date: 1,
        dayNight: 'day',
        createdAt: Date.now()
      });
      
      await manager.updateRoomStats(2, {
        roomNo: 2,
        roomName: 'Quiet Room',
        playerCount: 2,
        status: 'playing',
        date: 1,
        dayNight: 'day',
        createdAt: Date.now()
      });
      
      const popular = await manager.getPopularRooms(10);
      
      expect(popular.length).toBe(2);
      expect(popular[0].roomName).toBe('Popular Room');
      expect(popular[0].playerCount).toBe(10);
    });

    it('應該刪除房間統計', async () => {
      await manager.updateRoomStats(1, {
        roomNo: 1,
        roomName: 'Test',
        playerCount: 5,
        status: 'playing',
        date: 1,
        dayNight: 'day',
        createdAt: Date.now()
      });
      
      await manager.deleteRoomStats(1);
      
      const rooms = await manager.getRoomStats();
      expect(rooms.length).toBe(0);
    });
  });

  describe('重置統計', () => {
    it('應該重置所有統計', async () => {
      await manager.incrementRoomCount();
      await manager.incrementPlayerCount(10);
      await manager.recordGameStart();
      
      await manager.resetStats();
      
      const stats = await manager.getStats();
      expect(stats.totalRooms).toBe(0);
      expect(stats.totalPlayers).toBe(0);
      expect(stats.totalGames).toBe(0);
    });
  });
});
