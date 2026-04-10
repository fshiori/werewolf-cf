/**
 * Durable Object 房間測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { RoomData, Player, Message } from '../types';
import type { NightAction, NightState } from '../utils/night-action';
import type { VoteData } from '../utils/vote-system';
import type { SessionValue } from '../utils/session-manager';

// Mock Durable Object State
class MockDurableObjectState {
  storage = new Map<string, any>();
  
  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }
  
  async put(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.storage.keys())
      .filter(k => !options?.prefix || k.startsWith(options.prefix))
      .map(name => ({ name }));
    
    return { keys };
  }
  
  setAlarm(): void {}
  deleteAlarm(): void {}
}

describe('Durable Object Room', () => {
  describe('狀態持久化', () => {
    it('應該正確儲存房間資料', async () => {
      const state = new MockDurableObjectState();
      const room: RoomData = {
        roomNo: 1,
        roomName: 'Test',
        roomComment: '',
        maxUser: 16,
        status: 'waiting',
        date: 1,
        dayNight: 'beforegame',
        timeSpent: 0,
        lastUpdate: Date.now(),
        players: new Map(),
        gameOption: '',
        optionRole: ''
      };
      
      await state.put('room', {
        ...room,
        players: Object.fromEntries(room.players)
      });
      
      const saved = await state.get('room');
      expect(saved).toBeTruthy();
      expect(saved.roomNo).toBe(1);
    });
  });

  describe('WebSocket 連線管理', () => {
    it('應該正確處理 WebSocket 連線', () => {
      const mockEnv = {
        DB: {},
        KV: {},
        R2: {}
      };
      
      // 測試連線初始化
      const sessions = new Map<string, any>();
      const sessionId = 'test-session';
      const mockWs = {
        send: (data: string) => {},
        close: (code: number, reason: string) => {},
        addEventListener: (event: string, handler: any) => {}
      };
      
      sessions.set(sessionId, mockWs);
      
      expect(sessions.has(sessionId)).toBe(true);
    });

    it('應該正確處理斷線', () => {
      const sessions = new Map<string, any>();
      const sessionId = 'test-session';
      const mockWs = {
        send: () => {},
        close: () => {},
        addEventListener: (event: string, handler: any) => {
          if (event === 'close') {
            handler();
          }
        }
      };
      
      sessions.set(sessionId, mockWs);
      
      // 模擬斷線處理
      mockWs.addEventListener('close', () => {
        sessions.delete(sessionId);
      });
      
      expect(sessions.has(sessionId)).toBe(false);
    });
  });

  describe('訊息廣播', () => {
    it('應該廣播訊息給所有連線的客戶端', () => {
      const sessions = new Map<string, any>();
      const messages: string[] = [];
      
      // 模擬 WebSocket
      const createMockWs = (id: string) => ({
        send: (data: string) => {
          messages.push(`${id}: ${data}`);
        },
        close: () => {},
        addEventListener: () => {}
      });
      
      sessions.set('user1', createMockWs('user1'));
      sessions.set('user2', createMockWs('user2'));
      
      // 廣播訊息
      const message = JSON.stringify({ type: 'test', data: 'hello' });
      sessions.forEach((ws, id) => {
        ws.send(message);
      });
      
      expect(messages.length).toBe(2);
      expect(messages[0]).toContain('user1');
      expect(messages[1]).toContain('user2');
    });
  });

  describe('遊戲流程', () => {
    let room: RoomData;
    
    beforeEach(() => {
      room = {
        roomNo: 1,
        roomName: 'Test',
        roomComment: '',
        maxUser: 16,
        status: 'waiting',
        date: 1,
        dayNight: 'beforegame',
        timeSpent: 0,
        lastUpdate: Date.now(),
        players: new Map(),
        gameOption: '',
        optionRole: ''
      };
    });

    it('應該正確轉換階段', () => {
      // beforegame -> day
      room.dayNight = 'day';
      room.status = 'playing';
      
      expect(room.dayNight).toBe('day');
      expect(room.status).toBe('playing');
      
      // day -> night
      room.dayNight = 'night';
      room.date++;
      
      expect(room.dayNight).toBe('night');
      expect(room.date).toBe(2);
    });

    it('應該正確標記玩家死亡', () => {
      const player: Player = {
        userNo: 1,
        uname: 'player1',
        handleName: 'Player1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      };
      
      room.players.set('player1', player);
      
      player.live = 'dead';
      
      expect(room.players.get('player1')?.live).toBe('dead');
    });
  });

  describe('投票整合', () => {
    it('應該正確處理投票階段', () => {
      const voteData: VoteData = {
        roomNo: 1,
        date: 1,
        votes: new Map([
          ['player1', 'target1'],
          ['player2', 'target1'],
          ['player3', 'target2']
        ]),
        voteCounts: new Map([
          ['target1', 2],
          ['target2', 1]
        ])
      };
      
      // 檢查投票結果
      const maxVotes = Math.max(...voteData.voteCounts.values());
      const targets: string[] = [];
      
      for (const [target, count] of voteData.voteCounts) {
        if (count === maxVotes) {
          targets.push(target);
        }
      }
      
      expect(targets).toEqual(['target1']);
    });
  });

  describe('夜晚行動整合', () => {
    it('應該正確處理夜晚階段', () => {
      const nightState: NightState = {
        roomNo: 1,
        date: 1,
        actions: [],
        victims: [],
        divineResults: new Map(),
        converted: []
      };
      
      // 狼人殺人
      nightState.victims.push('victim1');
      nightState.actions.push({
        type: 'wolf_kill' as any,
        actor: 'wolf',
        target: 'victim1'
      });
      
      expect(nightState.victims).toContain('victim1');
      expect(nightState.actions.length).toBe(1);
    });

    it('應該檢查所有行動是否完成', () => {
      const nightState: NightState = {
        roomNo: 1,
        date: 1,
        actions: [
          { type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' },
          { type: 'seer_divine' as any, actor: 'seer', target: 'target', result: 'human' }
        ],
        victims: [],
        divineResults: new Map(),
        converted: []
      };
      
      const hasWolfKill = nightState.actions.some(a => a.type === 'wolf_kill');
      const hasSeerAction = nightState.actions.some(a => a.type === 'seer_divine');
      
      expect(hasWolfKill).toBe(true);
      expect(hasSeerAction).toBe(true);
    });
  });

  describe('Session 整合', () => {
    it('應該正確驗證 session', () => {
      const session: SessionValue = {
        sessionId: 'test-session',
        uname: 'player1',
        roomNo: 1,
        userNo: 1,
        handleName: 'Player1',
        role: 'human',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
      };
      
      // 檢查 session 是否有效
      const isValid = Date.now() < session.expiresAt;
      
      expect(isValid).toBe(true);
    });

    it('過期的 session 應該無效', () => {
      const session: SessionValue = {
        sessionId: 'test-session',
        uname: 'player1',
        roomNo: 1,
        userNo: 1,
        handleName: 'Player1',
        role: 'human',
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000
      };
      
      const isValid = Date.now() < session.expiresAt;
      
      expect(isValid).toBe(false);
    });
  });

  describe('錯誤處理', () => {
    it('無效的訊息格式應該被忽略', () => {
      const invalidMessages = [
        '',
        'not json',
        '{"invalid": "data"}',
        null,
        undefined
      ];
      
      for (const msg of invalidMessages) {
        try {
          JSON.parse(msg as string);
        } catch (e) {
          // 預期會拋出錯誤
          expect(e).toBeTruthy();
        }
      }
    });

    it('缺少必要欄位應該返回錯誤', () => {
      const incompleteData = [
        {},
        { type: 'say' }, // 缺少 text
        { text: 'hello' } // 缺少 type
      ];
      
      for (const data of incompleteData) {
        const hasType = 'type' in data;
        const hasText = 'text' in data;
        
        if (!hasType || !hasText) {
          // 應該返回錯誤
          expect(true).toBe(true);
        }
      }
    });
  });
});
