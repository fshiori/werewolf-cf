/**
 * 密語系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WhisperManager, WhisperMessage, canWhisper } from '../whisper-manager';
import type { Player } from '../../types';

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

/**
 * 建立測試用玩家
 */
function makePlayer(uname: string, role: Player['role'], live: Player['live'] = 'live'): Player {
  return {
    userNo: 0,
    uname,
    handleName: uname,
    trip: '',
    iconNo: 0,
    sex: 'unknown',
    role,
    live,
    score: 0,
  };
}

// 預設測試用玩家列表（含各種角色）
const defaultPlayers: Player[] = [
  makePlayer('alice', 'mage'),          // 預言家
  makePlayer('bob', 'wolf'),            // 狼人
  makePlayer('charlie', 'human'),       // 村民
  makePlayer('diana', 'necromancer'),   // 靈媒
  makePlayer('eve', 'fox'),             // 妖狐
  makePlayer('frank', 'guard'),         // 獵人
  makePlayer('grace', 'authority'),     // 權力者
  makePlayer('henry', 'wfbig'),         // 大狼
  makePlayer('ivy', 'betr'),            // 背德者
  makePlayer('jack', 'wolf_partner'),   // 狼人夥伴
  makePlayer('deadguy', 'mage', 'dead'), // 死亡的預言家
];

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

  describe('密語權限檢查（舊 API 向後相容）', () => {
    it('白天應該不允許密語', async () => {
      const can = await manager.canWhisper(1, 'alice', 'bob', 'day');
      
      expect(can).toBe(false);
    });

    it('夜晚應該允許密語（舊 API 無角色檢查）', async () => {
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

// ==================== 基於角色的密語權限測試 ====================

describe('canWhisper（純函數）', () => {
  it('預言家可以在夜晚密語', () => {
    expect(canWhisper('alice', 'bob', 'night', defaultPlayers)).toBe(true);
  });

  it('狼人可以在夜晚密語', () => {
    expect(canWhisper('bob', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('大狼可以在夜晚密語', () => {
    expect(canWhisper('henry', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('狼人夥伴可以在夜晚密語', () => {
    expect(canWhisper('jack', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('妖狐可以在夜晚密語', () => {
    expect(canWhisper('eve', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('背德者可以在夜晚密語', () => {
    expect(canWhisper('ivy', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('靈媒可以在夜晚密語', () => {
    expect(canWhisper('diana', 'alice', 'night', defaultPlayers)).toBe(true);
  });

  it('村民不能在夜晚密語', () => {
    expect(canWhisper('charlie', 'alice', 'night', defaultPlayers)).toBe(false);
  });

  it('獵人不能在夜晚密語', () => {
    expect(canWhisper('frank', 'alice', 'night', defaultPlayers)).toBe(false);
  });

  it('權力者不能在夜晚密語', () => {
    expect(canWhisper('grace', 'alice', 'night', defaultPlayers)).toBe(false);
  });

  it('白天任何人不能密語', () => {
    expect(canWhisper('alice', 'bob', 'day', defaultPlayers)).toBe(false);
    expect(canWhisper('bob', 'alice', 'day', defaultPlayers)).toBe(false);
  });

  it('等待階段任何人不能密語', () => {
    const players = [makePlayer('a', 'mage')];
    expect(canWhisper('a', 'a', 'beforegame', players)).toBe(false);
  });

  it('死亡玩家不能密語', () => {
    // deadguy 是死亡的預言家
    expect(canWhisper('deadguy', 'alice', 'night', defaultPlayers)).toBe(false);
  });

  it('不能密語給死亡玩家', () => {
    // alice（預言家，存活）嘗試密語給 deadguy（死亡）
    expect(canWhisper('alice', 'deadguy', 'night', defaultPlayers)).toBe(false);
  });

  it('不能密語自己', () => {
    expect(canWhisper('alice', 'alice', 'night', defaultPlayers)).toBe(false);
    expect(canWhisper('bob', 'bob', 'night', defaultPlayers)).toBe(false);
  });

  it('找不到發送者時拒絕', () => {
    expect(canWhisper('unknown', 'alice', 'night', defaultPlayers)).toBe(false);
  });

  it('找不到接收者時拒絕', () => {
    expect(canWhisper('alice', 'unknown', 'night', defaultPlayers)).toBe(false);
  });

  it('玩家列表為空時拒絕', () => {
    expect(canWhisper('alice', 'bob', 'night', [])).toBe(false);
  });
});
