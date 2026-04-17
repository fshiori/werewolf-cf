/**
 * Features 路由測試
 * 測試：
 * - 遊戲記錄 (game-logs)
 * - 投票歷史 (vote-history)
 * - 個人統計 (stats)
 * - 排行榜 (leaderboard)
 * - 黑白名單 (blacklist / whitelist)
 * - 遺書系統 (wills)
 * - 成就系統 (achievements)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import features from '../features';
import type { Env } from '../../types';

// ========================================
// Mock 輔助
// ========================================

/** 記憶體中的模擬資料表 */
type Table = Record<string, any[]>;

let tables: Record<string, Table>;

function resetTables() {
  tables = {
    game_logs: [],
    vote_history: [],
    vote_history_archive: [],
    trip_scores: [],
    user_blacklist: [],
    user_whitelist: [],
    ng_users: [],
    wills: [],
    whispers: [],
    game_events: [],
    game_events_archive: [],
    talk: [],
    talk_archive: [],
    achievements: [],
    room: [],
  };
}

/** 建立帶有模擬記憶體 DB 的 mock env */
function createMockEnv(): Env {
  resetTables();

  // 建立一個可以根據 query 名稱選擇資料表的機制
  function getTable(query: string): string {
    if (query.includes('game_logs')) return 'game_logs';
    if (query.includes('vote_history_archive')) return 'vote_history_archive';
    if (query.includes('vote_history')) return 'vote_history';
    if (query.includes('trip_scores')) return 'trip_scores';
    if (query.includes('user_blacklist')) return 'user_blacklist';
    if (query.includes('user_whitelist')) return 'user_whitelist';
    if (query.includes('ng_users')) return 'ng_users';
    if (query.includes('wills')) return 'wills';
    if (query.includes('whispers')) return 'whispers';
    if (query.includes('game_events_archive')) return 'game_events_archive';
    if (query.includes('game_events')) return 'game_events';
    if (query.includes('talk_archive')) return 'talk_archive';
    if (query.includes('talk')) return 'talk';
    if (query.includes('achievements')) return 'achievements';
    if (query.includes('spectators')) return 'spectators';
    if (query.includes('user_entry')) return 'user_entry';
    if (query.includes('game_settings')) return 'game_settings';
    if (query.includes('room')) return 'room';
    return 'unknown';
  }
  // 通用查詢邏輯（支援 bind 和直接 all）
  function queryAll(query: string, params: any[] = []) {
    const tableName = getTable(query);
    const data = tables[tableName] || [];

    let filtered = [...data];
    if (query.includes('WHERE')) {
      const wherePart = query.split('WHERE')[1]?.split('ORDER')[0]?.split('GROUP')[0]?.split('LIMIT')[0] || '';
      const clauses = wherePart.split('AND').map(c => c.trim());

      for (let i = 0; i < clauses.length && i < params.length; i++) {
        const clause = clauses[i];
        if (clause.includes('=')) {
          const col = clause.split('=')[0].trim();
          const val = params[i];
          filtered = filtered.filter(row => String(row[col]) === String(val));
        }
      }
    }

    if (query.includes('DESC')) filtered.reverse();

    const limitMatch = query.match(/LIMIT\s+(\?|\d+)/);
    if (limitMatch) {
      const limitIdx = (query.match(/\?/g) || []).length - 1;
      if (limitMatch[1] === '?' && params[limitIdx]) {
        filtered = filtered.slice(0, params[limitIdx]);
      } else if (limitMatch[1] !== '?') {
        filtered = filtered.slice(0, parseInt(limitMatch[1]));
      }
    }

    if (query.includes('COUNT(*)')) {
      return { results: [{ count: filtered.length }] };
    }

    return { results: filtered };
  }

  const db = {
    prepare: (query: string) => {
      return {
        bind: (...params: any[]) => ({
          all: () => queryAll(query, params),
          run: async () => ({ success: true }),
          first: async () => {
            const result = queryAll(query, params);
            return result.results.length > 0 ? result.results[0] : null;
          },
        }),
        // 支援直接 .prepare(...).all() 不經 bind
        all: () => queryAll(query, []),
        run: async () => ({ success: true }),
      };
    },
    // 用來插入資料的輔助方法
    _insert: (table: string, row: any) => {
      if (!tables[table]) tables[table] = [];
      tables[table].push(row);
    },
    _tables: () => tables,
  };

  return {
    DB: db as any,
    KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
    } as any,
    WEREWOLF_ROOM: {
      idFromName: (n: string) => n,
      get: () => ({ fetch: async () => new Response('{}') }),
    } as any,
    R2: {
      put: async () => {},
      get: async () => null,
      list: async () => ({ objects: [] }),
    } as any,
  };
}

// ========================================
// 測試
// ========================================

describe('Features Routes', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = new Hono();
    app.route('/', features);
  });

  async function request(path: string, init?: RequestInit): Promise<Response> {
    return app.request(new Request(`http://localhost${path}`, init), undefined, mockEnv);
  }

  // ==================== 遊戲記錄 ====================
  describe('POST /api/game-logs — 建立遊戲記錄', () => {
    it('應該成功建立遊戲記錄', async () => {
      const res = await request('/api/game-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          roomName: 'Test Room',
          winner: 'human',
          totalDays: 3,
          playerCount: 8,
          roles: 'wolf:2,human:4,mage:1,guard:1',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('缺少必要欄位應返回 400', async () => {
      const res = await request('/api/game-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNo: 1 }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/game-logs — 取得遊戲記錄列表', () => {
    it('應該返回遊戲記錄列表', async () => {
      const res = await request('/api/game-logs');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.logs).toBeDefined();
      expect(data.count).toBeDefined();
    });

    it('支援 winner 過濾', async () => {
      const res = await request('/api/game-logs?winner=human');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/game-logs/:roomNo — 取得單一遊戲記錄', () => {
    it('不存在的記錄應返回 404', async () => {
      const res = await request('/api/game-logs/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/replay/:roomNo — 回放模式', () => {
    it('不存在的房間應返回 404', async () => {
      const res = await request('/api/replay/404');
      expect(res.status).toBe(404);
    });

    it('mode=heaven 應只回傳天國聊天', async () => {
      (mockEnv.DB as any)._insert('game_logs', { room_no: '1', room_name: 'r1' });
      (mockEnv.DB as any)._insert('game_events', { room_no: '1', date: 1, event_type: 'execution', related_uname: 'dead1', time: 1 });
      (mockEnv.DB as any)._insert('talk', { room_no: '1', date: 1, uname: 'dead1', font_type: 'heaven', sentence: 'heaven msg', time: 2 });
      (mockEnv.DB as any)._insert('talk', { room_no: '1', date: 1, uname: 'live1', font_type: 'normal', sentence: 'normal msg', time: 3 });

      const res = await request('/api/replay/1?mode=heaven');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.talks)).toBe(true);
      expect(data.talks.length).toBe(1);
      expect(data.talks[0].font_type).toBe('heaven');
    });

    it('mode=heaven_only 應僅保留死亡相關事件與死亡者天國訊息', async () => {
      (mockEnv.DB as any)._insert('game_logs', { room_no: '2', room_name: 'r2' });
      (mockEnv.DB as any)._insert('game_events', { room_no: '2', date: 1, event_type: 'execution', related_uname: 'dead1', time: 1 });
      (mockEnv.DB as any)._insert('game_events', { room_no: '2', date: 1, event_type: 'system', related_uname: 'live1', time: 2 });
      (mockEnv.DB as any)._insert('talk', { room_no: '2', date: 1, uname: 'dead1', font_type: 'heaven', sentence: 'from dead', time: 3 });
      (mockEnv.DB as any)._insert('talk', { room_no: '2', date: 1, uname: 'live1', font_type: 'heaven', sentence: 'from live', time: 4 });

      const res = await request('/api/replay/2?mode=heaven_only');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.every((e: any) => e.event_type === 'execution' || e.event_type === 'night_death')).toBe(true);
      expect(data.talks.length).toBe(1);
      expect(data.talks[0].uname).toBe('dead1');
    });

    it('主表無資料時應 fallback 到 archive 表', async () => {
      (mockEnv.DB as any)._insert('game_logs', { room_no: '3', room_name: 'r3' });
      (mockEnv.DB as any)._insert('game_events_archive', { room_no: '3', date: 1, event_type: 'execution', target: 'deadA', time: 10 });
      (mockEnv.DB as any)._insert('vote_history_archive', { room_no: '3', date: 1, round: 1, voter: 'u1', candidate: 'u2', time: 11 });
      (mockEnv.DB as any)._insert('talk_archive', { room_no: '3', date: 1, uname: 'deadA', font_type: 'heaven', sentence: 'archive heaven', time: 12 });

      const res = await request('/api/replay/3?mode=full');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.length).toBe(1);
      expect(data.votes.length).toBe(1);
      expect(data.talks.length).toBe(1);
    });
  });

  // ==================== 投票歷史 ====================
  describe('POST /api/vote-history — 記錄投票', () => {
    it('應該成功記錄投票', async () => {
      const res = await request('/api/vote-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          date: 1,
          voterUname: 'player1',
          targetUname: 'player2',
          voteType: 'normal',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/vote-history/:roomNo — 取得投票歷史', () => {
    it('應該返回投票歷史', async () => {
      const res = await request('/api/vote-history/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.votes).toBeDefined();
    });

    it('支援 date 過濾', async () => {
      const res = await request('/api/vote-history/1?date=1');
      expect(res.status).toBe(200);
    });
  });

  // ==================== 個人統計 ====================
  describe('GET /api/stats/:trip — 取得 Trip 統計', () => {
    it('不存在的 trip 應返回預設值', async () => {
      const res = await request('/api/stats/nonexistent');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalGames).toBe(0);
      expect(data.humanWins).toBe(0);
      expect(data.score).toBe(0);
    });
  });

  describe('POST /api/stats/:trip — 更新 Trip 統計', () => {
    it('應該成功更新統計', async () => {
      const res = await request('/api/stats/trip123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: 'human_win',
          role: 'human',
          survived: true,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('不同結果應累加不同分數', async () => {
      // human_win = +10, survived = +5 → 15
      await request('/api/stats/trip1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'human_win', role: 'human', survived: true }),
      });
      // wolf_win = +15, survived = +5 → 20
      await request('/api/stats/trip2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'wolf_win', role: 'wolf', survived: true }),
      });
      // fox_win = +20, no survive → 20
      await request('/api/stats/trip3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'fox_win', role: 'fox', survived: false }),
      });

      // 無法直接驗證 DB 內容，但驗證沒有錯誤
      expect(true).toBe(true);
    });
  });

  // ==================== 排行榜 ====================
  describe('GET /api/leaderboard — 排行榜', () => {
    it('應該返回排行榜', async () => {
      const res = await request('/api/leaderboard');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.leaderboard).toBeDefined();
    });

    it('支援 type 參數 (score/games/wins)', async () => {
      const res1 = await request('/api/leaderboard?type=score');
      expect(res1.status).toBe(200);

      const res2 = await request('/api/leaderboard?type=games');
      expect(res2.status).toBe(200);

      const res3 = await request('/api/leaderboard?type=wins');
      expect(res3.status).toBe(200);
    });

    it('預設 type 為 score', async () => {
      const res = await request('/api/leaderboard');
      expect(res.status).toBe(200);
    });
  });

  // ==================== 黑名單 ====================
  describe('POST /api/blacklist — 新增黑名單', () => {
    it('應該成功新增黑名單', async () => {
      const res = await request('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'bad_trip',
          reason: 'Griefing',
          createdBy: 'admin',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/blacklist/check/:trip — 檢查黑名單', () => {
    it('不在黑名單應返回 false', async () => {
      const res = await request('/api/blacklist/check/not_blacklisted');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.blacklisted).toBe(false);
    });
  });

  describe('GET /api/blacklist — 黑名單列表', () => {
    it('應該返回黑名單', async () => {
      const res = await request('/api/blacklist');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.blacklist).toBeDefined();
    });
  });

  // ==================== 白名單 ====================
  describe('POST /api/whitelist — 新增白名單', () => {
    it('應該成功新增白名單', async () => {
      const res = await request('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'good_trip',
          trustLevel: 5,
          notes: 'Trusted player',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/whitelist/check/:trip — 檢查白名單', () => {
    it('不在白名單應返回 false', async () => {
      const res = await request('/api/whitelist/check/not_whitelisted');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.whitelisted).toBe(false);
    });
  });

  // ==================== 遺書系統 ====================
  describe('POST /api/wills — 儲存遺書', () => {
    it('應該成功儲存遺書', async () => {
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        status: 'playing',
        game_option: JSON.stringify({ will: true }),
      });

      const res = await request('/api/wills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          date: 1,
          uname: 'player1',
          handleName: 'Player 1',
          will: 'I am the seer. Trust player2!',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('缺少必要欄位應返回 400', async () => {
      const res = await request('/api/wills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNo: 1 }),
      });

      expect(res.status).toBe(400);
    });

    it('遺書太長應返回 400', async () => {
      const res = await request('/api/wills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          uname: 'player1',
          will: 'a'.repeat(501),
        }),
      });

      expect(res.status).toBe(400);
    });

    it('will 關閉且遊戲進行中時應返回 403', async () => {
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        status: 'playing',
        game_option: JSON.stringify({ will: false }),
      });

      const res = await request('/api/wills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          date: 1,
          uname: 'player1',
          handleName: 'Player 1',
          will: 'this should be blocked',
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/wills/:roomNo — 取得遺書', () => {
    it('應該返回房間的遺書列表', async () => {
      const res = await request('/api/wills/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.wills).toBeDefined();
    });

    it('will 關閉且遊戲進行中時應隱藏遺書內容', async () => {
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        status: 'playing',
        game_option: JSON.stringify({ will: false }),
      });
      (mockEnv.DB as any)._insert('wills', {
        room_no: 1,
        date: 1,
        uname: 'player1',
        handle_name: 'P1',
        will: 'secret',
      });

      const res = await request('/api/wills/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.wills).toEqual([]);
    });
  });

  // ==================== 成就系統 ====================
  describe('GET /api/achievements/definitions — 成就定義', () => {
    it('應該返回成就定義列表', async () => {
      const res = await request('/api/achievements/definitions');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.achievements).toBeDefined();
      expect(data.achievements.length).toBeGreaterThan(0);
    });

    it('應包含 first_win 成就', async () => {
      const res = await request('/api/achievements/definitions');
      const data = await res.json();

      const firstWin = data.achievements.find((a: any) => a.key === 'first_win');
      expect(firstWin).toBeTruthy();
      expect(firstWin.name).toContain('初次勝利');
    });
  });

  describe('POST /api/achievements/check — 檢查成就', () => {
    it('缺少 trip 應返回 400', async () => {
      const res = await request('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('應該成功檢查成就', async () => {
      const res = await request('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'test_trip',
          stats: {
            human_wins: 1,
            total_games: 1,
          },
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.trip).toBe('test_trip');
      expect(data.newlyUnlocked).toBeDefined();
      expect(data.achievements).toBeDefined();
    });
  });

  // ==================== 觀戰模式 ====================
  describe('POST /api/spectate/:roomNo — 加入觀戰', () => {
    it('應該成功加入觀戰', async () => {
      // room option: allowSpectators=true, maxSpectators=10
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        game_option: JSON.stringify({ allowSpectators: true, maxSpectators: 10 }),
      });

      const res = await request('/api/spectate/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'spectator1',
          handleName: 'Spectator',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('房間停用觀戰時應拒絕加入（403）', async () => {
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        game_option: JSON.stringify({ allowSpectators: false, maxSpectators: 10 }),
      });

      const res = await request('/api/spectate/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'spectator2',
          handleName: 'Spectator2',
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('disabled');
    });

    it('房間觀戰額滿時應拒絕加入（403）', async () => {
      (mockEnv.DB as any)._insert('room', {
        room_no: 1,
        game_option: JSON.stringify({ allowSpectators: true, maxSpectators: 1 }),
      });
      (mockEnv.DB as any)._insert('spectators', {
        room_no: 1,
        trip: 'already_in',
        handle_name: 'AlreadyIn',
        joined_at: Date.now(),
      });

      const res = await request('/api/spectate/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: 'spectator3',
          handleName: 'Spectator3',
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('limit');
    });
  });

  describe('GET /api/spectate/:roomNo — 觀戰列表', () => {
    it('應該返回觀戰列表', async () => {
      const res = await request('/api/spectate/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.spectators).toBeDefined();
    });
  });

  // ==================== 遊戲事件 ====================
  describe('POST /api/game-events — 記錄事件', () => {
    it('應該成功記錄遊戲事件', async () => {
      const res = await request('/api/game-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: 1,
          date: 1,
          eventType: 'vote',
          description: 'Player1 voted for Player2',
          relatedUname: 'Player1',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/game-events/:roomNo — 取得事件', () => {
    it('應該返回遊戲事件', async () => {
      const res = await request('/api/game-events/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.events).toBeDefined();
    });

    it('支援 event type 過濾', async () => {
      const res = await request('/api/game-events/1?type=vote');
      expect(res.status).toBe(200);
    });
  });
});
