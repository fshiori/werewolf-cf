/**
 * 遺書系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WillManager, WillData } from '../will-manager';

// Mock DB
class MockDB {
  private wills: WillData[] = [];

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => {
        return {
          run: async () => {
            if (sql.includes('INSERT')) {
              const will: WillData = {
                roomNo: params[0],
                date: params[1],
                uname: params[2],
                handleName: params[3],
                will: params[4],
                time: params[5] * 1000
              };
              this.wills.push(will);
            }
            if (sql.includes('DELETE')) {
              this.wills = this.wills.filter(w => w.roomNo !== params[0]);
            }
            return { success: true };
          },
          first: async () => {
            if (sql.includes('COUNT(*)')) {
              return { count: this.wills.filter(w => w.uname === params[1]).length };
            }
            if (sql.includes('AVG')) {
              const roomWills = this.wills.filter(w => w.roomNo === params[0]);
              const avgLen = roomWills.reduce((sum, w) => sum + w.will.length, 0) / roomWills.length;
              return { count: roomWills.length, avg_length: avgLen || 0 };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('WHERE room_no = ?')) {
              if (sql.includes('AND date = ?')) {
                return { results: this.wills.filter(w => w.roomNo === params[0] && w.date === params[1]) };
              }
              if (sql.includes('AND uname = ?')) {
                const filtered = this.wills.filter(w => w.roomNo === params[0] && w.uname === params[1]);
                return { results: filtered.length > 0 ? [filtered[filtered.length - 1]] : [] };
              }
              return { results: this.wills.filter(w => w.roomNo === params[0]) };
            }
            return { results: [] };
          }
        };
      }
    };
  }
}

describe('WillManager', () => {
  let manager: WillManager;
  let mockDB: MockDB;

  beforeEach(() => {
    mockDB = new MockDB();
    manager = new WillManager(mockDB as any);
  });

  describe('儲存遺書', () => {
    it('應該成功儲存遺書', async () => {
      const will: WillData = {
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Goodbye everyone!',
        time: Date.now()
      };

      await manager.saveWill(will);
      
      const saved = await manager.hasPlayerLeftWill(1, 'player1');
      expect(saved).toBe(true);
    });
  });

  describe('獲取遺書', () => {
    beforeEach(async () => {
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Will 1',
        time: Date.now() - 2000
      });
      
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player2',
        handleName: 'Player 2',
        will: 'Will 2',
        time: Date.now() - 1000
      });
    });

    it('應該返回房間的所有遺書', async () => {
      const wills = await manager.getRoomWills(1);
      
      expect(wills.length).toBe(2);
      expect(wills[0].uname).toBe('player1');
      expect(wills[1].uname).toBe('player2');
    });

    it('應該按時間排序', async () => {
      const wills = await manager.getRoomWills(1);
      
      expect(wills[0].time).toBeLessThan(wills[1].time);
    });

    it('應該返回特定日期的遺書', async () => {
      const wills = await manager.getDateWills(1, 1);
      
      expect(wills.length).toBe(2);
    });

    it('不同日期的遺書應該分開', async () => {
      await manager.saveWill({
        roomNo: 1,
        date: 2,
        uname: 'player3',
        handleName: 'Player 3',
        will: 'Will 3',
        time: Date.now()
      });

      const date1Wills = await manager.getDateWills(1, 1);
      const date2Wills = await manager.getDateWills(1, 2);
      
      expect(date1Wills.length).toBe(2);
      expect(date2Wills.length).toBe(1);
    });
  });

  describe('玩家遺書', () => {
    it('應該返回玩家的最新遺書', async () => {
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'First will',
        time: Date.now() - 2000
      });

      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Second will',
        time: Date.now() - 1000
      });

      const will = await manager.getPlayerWill(1, 'player1');
      
      expect(will).toBeTruthy();
      expect(will?.will).toBe('Second will');
    });

    it('不存在的玩家應該返回 null', async () => {
      const will = await manager.getPlayerWill(1, 'nonexistent');
      
      expect(will).toBeNull();
    });
  });

  describe('檢查遺書', () => {
    it('應該正確檢測玩家是否留遺書', async () => {
      expect(await manager.hasPlayerLeftWill(1, 'player1')).toBe(false);
      
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Test',
        time: Date.now()
      });

      expect(await manager.hasPlayerLeftWill(1, 'player1')).toBe(true);
    });
  });

  describe('刪除遺書', () => {
    it('應該刪除房間的所有遺書', async () => {
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Will 1',
        time: Date.now()
      });

      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player2',
        handleName: 'Player 2',
        will: 'Will 2',
        time: Date.now()
      });

      await manager.deleteRoomWills(1);
      
      const wills = await manager.getRoomWills(1);
      expect(wills.length).toBe(0);
    });
  });

  describe('統計', () => {
    beforeEach(async () => {
      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player1',
        handleName: 'Player 1',
        will: 'Short',
        time: Date.now()
      });

      await manager.saveWill({
        roomNo: 1,
        date: 1,
        uname: 'player2',
        handleName: 'Player 2',
        will: 'This is a much longer will message',
        time: Date.now()
      });
    });

    it('應該返回正確的統計', async () => {
      const stats = await manager.getWillStats(1);
      
      expect(stats.totalWills).toBe(2);
      expect(stats.averageLength).toBeGreaterThan(0);
    });
  });
});
