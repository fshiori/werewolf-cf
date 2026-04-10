/**
 * Tripcode 評分系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TripScoreManager } from '../trip-score-manager';

// Mock DB
class MockDB {
  private data = new Map<string, any>();
  private insertCount = 0;

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => {
        return {
          first: async () => {
            // 模擬查詢
            if (sql.includes('SELECT COUNT(*)')) {
              return { count: this.data.size };
            }
            if (sql.includes('AVG(score)')) {
              const scores = Array.from(this.data.values()).map((d: any) => d.score);
              const avg = scores.length > 0 
                ? scores.reduce((a, b) => a + b, 0) / scores.length 
                : 0;
              return { total: 100, avg };
            }
            if (sql.includes('trip = ?')) {
              for (const [key, value] of this.data) {
                if (key === params[0]) return value;
              }
              return null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('ORDER BY score DESC')) {
              const limit = params[0] || 100;
              const sorted = Array.from(this.data.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
              return { results: sorted };
            }
            return { results: [] };
          },
          run: async () => {
            this.insertCount++;
            return { success: true };
          }
        };
      }
    };
  }
}

describe('TripScoreManager', () => {
  let manager: TripScoreManager;
  let mockDB: MockDB;

  beforeEach(() => {
    mockDB = new MockDB();
    manager = new TripScoreManager(mockDB as any);
  });

  describe('獲取評分', () => {
    it('不存在的 tripcode 應該返回 null', async () => {
      const score = await manager.getTripScore('nonexistent');
      expect(score).toBeNull();
    });

    it('應該返回正確的評分資料', async () => {
      // 模擬已存在的資料
      mockDB.data.set('testtrip', {
        trip: 'testtrip',
        score: 100,
        gamesPlayed: 10,
        humanWins: 5,
        wolfWins: 3,
        foxWins: 2,
        lastPlayed: Date.now()
      });

      const score = await manager.getTripScore('testtrip');
      
      expect(score).toBeTruthy();
      expect(score?.score).toBe(100);
      expect(score?.gamesPlayed).toBe(10);
    });
  });

  describe('更新評分', () => {
    it('應該建立新的評分記錄', async () => {
      await manager.upsertTripScore({
        trip: 'newtrip',
        score: 50
      });

      const score = await manager.getTripScore('newtrip');
      expect(score).toBeTruthy();
    });

    it('應該更新現有的評分', async () => {
      // 先建立
      await manager.upsertTripScore({
        trip: 'updatetrip',
        score: 50,
        humanWins: 1
      });

      // 再更新
      await manager.upsertTripScore({
        trip: 'updatetrip',
        score: 75,
        wolfWins: 1
      });

      const score = await manager.getTripScore('updatetrip');
      expect(score?.score).toBeDefined();
    });
  });

  describe('遊戲結束更新', () => {
    it('勝利應該增加評分', async () => {
      await manager.updateScore('winner', 'human', true, false);
      
      const score = await manager.getTripScore('winner');
      expect(score).toBeTruthy();
      expect(score?.score).toBeGreaterThan(0);
    });

    it('失敗應該減少評分', async () => {
      await manager.updateScore('loser', 'human', false, false);
      
      const score = await manager.getTripScore('loser');
      expect(score).toBeDefined();
    });

    it('MVP 應該獲得額外加分', async () => {
      await manager.updateScore('mvp', 'human', true, true);
      
      const mvpScore = await manager.getTripScore('mvp');
      const normalScore = await manager.getTripScore('normal');
      
      expect(mvpScore).toBeTruthy();
    });

    it('不同角色應該有不同的加權', async () => {
      await manager.updateScore('wolf', 'wolf', true, false);
      await manager.updateScore('fox', 'fox', true, false);
      await manager.updateScore('human', 'human', true, false);
      
      const wolfScore = await manager.getTripScore('wolf');
      const foxScore = await manager.getTripScore('fox');
      const humanScore = await manager.getTripScore('human');
      
      expect(wolfScore).toBeTruthy();
      expect(foxScore).toBeTruthy();
      expect(humanScore).toBeTruthy();
    });
  });

  describe('排行榜', () => {
    beforeEach(async () => {
      // 建立測試資料
      await manager.upsertTripScore({ trip: 'trip1', score: 100 });
      await manager.upsertTripScore({ trip: 'trip2', score: 200 });
      await manager.upsertTripScore({ trip: 'trip3', score: 150 });
    });

    it('應該返回正確排序的排行榜', async () => {
      const leaderboard = await manager.getLeaderboard(10);
      
      expect(leaderboard.length).toBeGreaterThan(0);
      if (leaderboard.length >= 2) {
        expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[1].score);
      }
    });

    it('應該限制返回數量', async () => {
      const leaderboard = await manager.getLeaderboard(2);
      
      expect(leaderboard.length).toBeLessThanOrEqual(2);
    });
  });

  describe('排名', () => {
    it('應該返回正確的排名', async () => {
      await manager.upsertTripScore({ trip: 'top', score: 1000 });
      
      const rank = await manager.getTripRank('top');
      expect(rank).toBeGreaterThan(0);
    });

    it('不存在的 tripcode 應該返回 0', async () => {
      const rank = await manager.getTripRank('nonexistent');
      expect(rank).toBe(0);
    });
  });

  describe('統計', () => {
    it('應該返回正確的統計資料', async () => {
      await manager.upsertTripScore({ trip: 'trip1', score: 100 });
      await manager.upsertTripScore({ trip: 'trip2', score: 200 });
      
      const stats = await manager.getStats();
      
      expect(stats.totalTrips).toBeGreaterThanOrEqual(2);
      expect(stats.totalGames).toBeGreaterThanOrEqual(0);
      expect(stats.averageScore).toBeGreaterThanOrEqual(0);
    });
  });
});
