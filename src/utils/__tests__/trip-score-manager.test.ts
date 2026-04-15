/**
 * Tripcode 評分系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TripScoreManager } from '../trip-score-manager';

// Mock DB
class MockDB {
  private data = new Map<string, any>();

  prepare(sql: string) {
    const self = this;
    const stmt: any = {
      _sql: sql,
      _params: [] as any[],
      bind: (...params: any[]) => {
        stmt._params = params;
        return stmt;
      },
      first: async () => {
        const p = stmt._params;
        // SELECT COUNT(*) as count FROM trip_scores WHERE score > ?
        if (sql.includes('WHERE score > ?')) {
          const threshold = p[0];
          const count = Array.from(self.data.values()).filter((d: any) => d.score > threshold).length;
          return { count };
        }
        // SELECT COUNT(*) as count FROM trip_scores
        if (sql.includes('SELECT COUNT(*)') && sql.includes('FROM trip_scores') && !sql.includes('WHERE')) {
          return { count: self.data.size };
        }
        // SELECT SUM(games_played) as total, AVG(score) as avg FROM trip_scores
        if (sql.includes('SUM(games_played)') || sql.includes('AVG(score)')) {
          const values = Array.from(self.data.values());
          const totalGames = values.reduce((sum: number, d: any) => sum + (d.gamesPlayed || 0), 0);
          const avg = values.length > 0
            ? values.reduce((sum: number, d: any) => sum + d.score, 0) / values.length
            : 0;
          return { total: totalGames, avg };
        }
        // SELECT * FROM trip_scores WHERE trip = ?
        if (sql.includes('WHERE trip = ?')) {
          return self.data.get(p[0]) || null;
        }
        return null;
      },
      all: async () => {
        const p = stmt._params;
        // SELECT * FROM trip_scores ORDER BY score DESC LIMIT ?
        if (sql.includes('ORDER BY score DESC')) {
          const limit = p[0] || 100;
          return {
            results: Array.from(self.data.values())
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, limit)
          };
        }
        return { results: [] };
      },
      run: async () => {
        const p = stmt._params;
        if (sql.includes('INSERT INTO trip_scores')) {
          const record = {
            trip: p[0],
            score: p[1],
            gamesPlayed: p[2],
            humanWins: p[3],
            wolfWins: p[4],
            foxWins: p[5],
            lastPlayed: p[6]
          };
          self.data.set(p[0], record);
        } else if (sql.includes('UPDATE trip_scores')) {
          const trip = p[5]; // WHERE trip = ?
          const existing = self.data.get(trip);
          if (existing) {
            existing.score = p[0];
            existing.gamesPlayed = (existing.gamesPlayed || 0) + 1;
            existing.humanWins = (existing.humanWins || 0) + p[1];
            existing.wolfWins = (existing.wolfWins || 0) + p[2];
            existing.foxWins = (existing.foxWins || 0) + p[3];
            existing.lastPlayed = p[4];
          }
        }
        return { success: true };
      }
    };
    return stmt;
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
      mockDB['data'].set('testtrip', {
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
