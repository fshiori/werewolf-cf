/**
 * 密語系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WhisperManager, WhisperMessage } from '../whisper-manager';

// Mock DB
class MockDB {
  private whispers: WhisperMessage[] = [];

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => {
        return {
          run: async () => {
            if (sql.includes('INSERT')) {
              const whisper: WhisperMessage = {
                id: params[0],
                roomNo: params[1],
                date: params[2],
                from: params[3],
                to: params[4],
                message: params[5],
                time: params[6] * 1000
              };
              this.whispers.push(whisper);
            }
            if (sql.includes('DELETE')) {
              this.whispers = this.whispers.filter(w => w.roomNo !== params[0]);
            }
            return { success: true };
          },
          first: async () => {
            return null;
          },
          all: async () => {
            if (sql.includes('from_uname = ? OR to_uname = ?')) {
              const filtered = this.whispers.filter(
                w => w.roomNo === params[0] && 
                     (w.from === params[1] || w.to === params[1])
              );
              return { results: filtered.reverse().slice(0, params[2] || 50) };
            }
            if (sql.includes('AND (from_uname = ? AND to_uname = ?) OR (from_uname = ? AND to_uname = ?)')) {
              const filtered = this.whispers.filter(
                w => w.roomNo === params[0] &&
                     ((w.from === params[1] && w.to === params[2]) ||
                      (w.from === params[2] && w.to === params[1]))
              );
              return { results: filtered.slice(0, params[4] || 50) };
            }
            return { results: [] };
          }
        };
      }
    };
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
