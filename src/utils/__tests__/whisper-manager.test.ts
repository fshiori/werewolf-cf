/**
 * 密語系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WhisperManager, WhisperMessage } from '../whisper-manager';

// Mock DB
class MockDB {
  private whispers: WhisperMessage[] = [];

  prepare(sql: string) {
    const self = this;
    const stmt: any = {
      _sql: sql,
      _params: [] as any[],
      bind: (...params: any[]) => {
        stmt._params = params;
        return stmt;
      },
      run: async () => {
        const p = stmt._params;
        if (sql.includes('INSERT')) {
          const whisper: WhisperMessage = {
            id: p[0],
            roomNo: p[1],
            date: p[2],
            from: p[3],
            to: p[4],
            message: p[5],
            time: p[6] * 1000
          };
          self.whispers.push(whisper);
        }
        if (sql.includes('DELETE')) {
          self.whispers = self.whispers.filter(w => w.roomNo !== p[0]);
        }
        return { success: true };
      },
      first: async () => {
        const p = stmt._params;
        // SELECT COUNT(*) as count FROM whispers WHERE room_no = ?
        if (sql.includes('COUNT(*)') && !sql.includes('DISTINCT')) {
          return { count: self.whispers.filter(w => w.roomNo === p[0]).length };
        }
        // SELECT COUNT(DISTINCT ...) as count FROM whispers WHERE room_no = ?
        if (sql.includes('COUNT(DISTINCT')) {
          const roomWhispers = self.whispers.filter(w => w.roomNo === p[0]);
          const pairs = new Set<string>();
          for (const w of roomWhispers) {
            const key = [w.from, w.to].sort().join('-');
            pairs.add(key);
          }
          return { count: pairs.size };
        }
        return null;
      },
      all: async () => {
        const p = stmt._params;
        // SELECT * FROM whispers WHERE room_no = ? AND (from_uname = ? OR to_uname = ?)
        // bind params: [roomNo, uname, uname, limit]
        if (sql.includes('from_uname = ? OR to_uname = ?')) {
          const roomNo = p[0];
          const uname = p[1];
          const limit = p[3];
          const filtered = self.whispers.filter(
            w => w.roomNo === roomNo &&
                 (w.from === uname || w.to === uname)
          );
          return { results: filtered.reverse().slice(0, limit || 50) };
        }
        // SELECT * FROM whispers WHERE room_no = ? AND ((from_uname = ? AND to_uname = ?) OR ...)
        // bind params: [roomNo, uname1, uname2, uname2, uname1, limit]
        if (sql.includes('from_uname = ? AND to_uname = ?')) {
          const roomNo = p[0];
          const uname1 = p[1];
          const uname2 = p[2];
          const limit = p[5];
          const filtered = self.whispers.filter(
            w => w.roomNo === roomNo &&
                 ((w.from === uname1 && w.to === uname2) ||
                  (w.from === uname2 && w.to === uname1))
          );
          return { results: filtered.slice(0, limit || 50) };
        }
        return { results: [] };
      }
    };
    return stmt;
  }
}

describe('WhisperManager', () => {
  let manager: WhisperManager;
  let mockDB: MockDB;

  beforeEach(() => {
    mockDB = new MockDB();
    manager = new WhisperManager(mockDB as any);
  });

  describe('傳送密語', () => {
    it('應該成功傳送密語', async () => {
      const id = await manager.sendWhisper(1, 1, 'alice', 'bob', 'Hello Bob!');
      
      expect(id).toBeTruthy();
      expect(id.length).toBeGreaterThan(0);
    });

    it('應該產生唯一的訊息 ID', async () => {
      const id1 = await manager.sendWhisper(1, 1, 'alice', 'bob', 'Message 1');
      const id2 = await manager.sendWhisper(1, 1, 'alice', 'bob', 'Message 2');
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('獲取密語', () => {
    beforeEach(async () => {
      await manager.sendWhisper(1, 1, 'alice', 'bob', 'Message 1');
      await manager.sendWhisper(1, 1, 'bob', 'alice', 'Message 2');
      await manager.sendWhisper(1, 1, 'charlie', 'alice', 'Message 3');
    });

    it('應該返回玩家的所有密語', async () => {
      const whispers = await manager.getPlayerWhispers(1, 'alice', 10);
      
      expect(whispers.length).toBeGreaterThanOrEqual(2);
    });

    it('應該按時間倒序排列', async () => {
      const whispers = await manager.getPlayerWhispers(1, 'alice', 10);
      
      // 應該是倒序（最新的在前）
      if (whispers.length >= 2) {
        expect(whispers[0].time).toBeGreaterThanOrEqual(whispers[1].time);
      }
    });

    it('應該限制返回數量', async () => {
      const whispers = await manager.getPlayerWhispers(1, 'alice', 2);
      
      expect(whispers.length).toBeLessThanOrEqual(2);
    });
  });

  describe('對話歷史', () => {
    beforeEach(async () => {
      await manager.sendWhisper(1, 1, 'alice', 'bob', 'Hi Bob');
      await manager.sendWhisper(1, 1, 'bob', 'alice', 'Hi Alice');
      await manager.sendWhisper(1, 1, 'alice', 'bob', 'How are you?');
      await manager.sendWhisper(1, 1, 'charlie', 'alice', 'Hey Alice');
    });

    it('應該返回兩個人之間的對話', async () => {
      const conversation = await manager.getConversation(1, 'alice', 'bob', 10);
      
      expect(conversation.length).toBe(3);
      
      // 所有訊息都應該是 alice <-> bob
      for (const msg of conversation) {
        expect(
          (msg.from === 'alice' && msg.to === 'bob') ||
          (msg.from === 'bob' && msg.to === 'alice')
        ).toBe(true);
      }
    });

    it('不應該包含其他人的訊息', async () => {
      const conversation = await manager.getConversation(1, 'alice', 'bob', 10);
      
      const hasCharlie = conversation.some(msg => 
        msg.from === 'charlie' || msg.to === 'charlie'
      );
      
      expect(hasCharlie).toBe(false);
    });

    it('應該按時間正序排列', async () => {
      const conversation = await manager.getConversation(1, 'alice', 'bob', 10);
      
      if (conversation.length >= 2) {
        expect(conversation[0].time).toBeLessThanOrEqual(conversation[1].time);
      }
    });
  });

  describe('密語權限檢查', () => {
    it('白天應該不允許密語', async () => {
      const can = await manager.canWhisper(1, 'alice', 'bob', 'day');
      
      expect(can).toBe(false);
    });

    it('夜晚應該允許密語', async () => {
      const can = await manager.canWhisper(1, 'alice', 'bob', 'night');
      
      expect(can).toBe(true);
    });
  });

  describe('刪除密語', () => {
    it('應該刪除房間的所有密語', async () => {
      await manager.sendWhisper(1, 1, 'alice', 'bob', 'Message 1');
      await manager.sendWhisper(1, 1, 'bob', 'alice', 'Message 2');
      
      await manager.deleteRoomWhispers(1);
      
      const whispers = await manager.getPlayerWhispers(1, 'alice', 10);
      expect(whispers.length).toBe(0);
    });
  });

  describe('統計', () => {
    beforeEach(async () => {
      await manager.sendWhisper(1, 1, 'alice', 'bob', 'Message 1');
      await manager.sendWhisper(1, 1, 'bob', 'alice', 'Message 2');
      await manager.sendWhisper(1, 1, 'alice', 'charlie', 'Message 3');
    });

    it('應該返回正確的統計', async () => {
      const stats = await manager.getWhisperStats(1);
      
      expect(stats.totalWhispers).toBe(3);
      expect(stats.activeConversations).toBeGreaterThanOrEqual(1);
    });

    it('應該正確計算活躍對話數', async () => {
      const stats = await manager.getWhisperStats(1);
      
      // alice-bob 和 alice-charlice 應該算 2 個對話
      expect(stats.activeConversations).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ID 生成', () => {
    it('應該產生唯一且可識別的 ID', async () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const id = await manager.sendWhisper(1, 1, 'user', 'user', 'test');
        ids.add(id);
      }
      
      expect(ids.size).toBe(100);
    });
  });
});
