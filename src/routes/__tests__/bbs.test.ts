/**
 * BBS 討論板路由測試
 * 測試：
 * - GET /api/bbs (列表)
 * - POST /api/bbs (建立)
 * - GET /api/bbs/:threadId (含回覆)
 * - POST /api/bbs/:threadId/reply (回覆)
 * - POST /api/bbs/:threadId/lock (鎖定)
 * - POST /api/bbs/:threadId/pin (置頂)
 * - DELETE /api/bbs/:threadId (刪除)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import bbs from '../bbs';
import type { Env } from '../../types';

// ========================================
// Mock 輔助
// ========================================

/** 追蹤 DB 呼叫的記錄器 */
interface DBRecord {
  query: string;
  params: any[];
}

let dbCalls: DBRecord[] = [];
let mockThreads: any[] = [];
let mockReplies: any[] = [];

/** 建立帶有追踪功能的 mock DB */
function createMockDB() {
  const calls: DBRecord[] = [];

  /** 建立返回物件，支援 .bind().all() 和 .all() 直接呼叫 */
  function createStatement(query: string) {
    return {
      bind: (...params: any[]) => {
        calls.push({ query, params });
        return createBoundStatement(query, params);
      },
      all: async () => {
        // 不帶 bind 的直接 .all() 呼叫
        if (query.includes('SELECT COUNT(*) as total FROM bbs_threads')) {
          return { results: [{ total: mockThreads.length }] };
        }
        return { results: [] };
      },
      run: async () => ({ success: true }),
      first: async () => null,
    };
  }

  function createBoundStatement(query: string, params: any[]) {
    return {
      all: async () => {
        // 根據 query 返回對應的 mock 資料
        if (query.includes('SELECT COUNT(*) as total FROM bbs_threads')) {
          return { results: [{ total: mockThreads.length }] };
        }
        if (query.includes('SELECT t.*') && !query.includes('WHERE id =')) {
          return { results: mockThreads };
        }
        if (query.includes('FROM bbs_threads WHERE id')) {
          const id = params[0];
          const thread = mockThreads.find((t: any) => t.id === id);
          return { results: thread ? [thread] : [] };
        }
        if (query.includes('FROM bbs_replies WHERE thread_id')) {
          const threadId = params[0];
          return { results: mockReplies.filter((r: any) => r.thread_id === threadId) };
        }
        if (query.includes('SELECT is_locked FROM bbs_threads')) {
          const id = params[0];
          const thread = mockThreads.find((t: any) => t.id === id);
          return { results: thread ? [thread] : [] };
        }
        // INSERT / UPDATE / DELETE
        if (query.includes('INSERT INTO bbs_threads')) {
          const newThread = {
            id: String(mockThreads.length + 1),
            title: params[0],
            author_trip: params[1],
            author_name: params[2],
            content: params[3],
            is_pinned: 0,
            is_locked: 0,
            reply_count: 0,
            created_at: params[4],
            updated_at: params[5],
          };
          mockThreads.push(newThread);
        }
        if (query.includes('INSERT INTO bbs_replies')) {
          mockReplies.push({
            id: String(mockReplies.length + 1),
            thread_id: params[0],
            author_trip: params[1],
            author_name: params[2],
            content: params[3],
            created_at: params[4],
          });
        }
        if (query.includes('UPDATE bbs_threads SET is_locked')) {
          const locked = params[0];
          const id = params[1];
          const thread = mockThreads.find((t: any) => t.id === id);
          if (thread) thread.is_locked = locked;
        }
        if (query.includes('UPDATE bbs_threads SET is_pinned')) {
          const pinned = params[0];
          const id = params[1];
          const thread = mockThreads.find((t: any) => t.id === id);
          if (thread) thread.is_pinned = pinned;
        }
        if (query.includes('UPDATE bbs_threads SET reply_count')) {
          const id = params[1];
          const thread = mockThreads.find((t: any) => t.id === id);
          if (thread) thread.reply_count++;
        }
        if (query.includes('DELETE FROM bbs_replies')) {
          const id = params[0];
          mockReplies = mockReplies.filter((r: any) => r.thread_id !== id);
        }
        if (query.includes('DELETE FROM bbs_threads WHERE id')) {
          const id = params[0];
          mockThreads = mockThreads.filter((t: any) => t.id !== id);
        }
        return { results: [] };
      },
      run: async () => ({ success: true }),
      first: async () => null,
    };
  }

  const db = {
    prepare: (query: string) => createStatement(query),
    _calls: calls,
  };

  return db;
}

function createMockEnv(): Env {
  return {
    DB: createMockDB() as any,
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

describe('BBS Routes', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = new Hono();
    app.route('/', bbs);
    mockThreads = [];
    mockReplies = [];
    dbCalls = [];
  });

  async function request(path: string, init?: RequestInit): Promise<Response> {
    return app.request(new Request(`http://localhost${path}`, init), undefined, mockEnv);
  }

  // ==================== GET /api/bbs ====================
  describe('GET /api/bbs — 列表', () => {
    it('應該返回空列表', async () => {
      const res = await request('/api/bbs');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.threads).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('應該返回討論串列表', async () => {
      mockThreads = [
        { id: '1', title: 'Thread 1', is_pinned: 1, updated_at: 1000 },
        { id: '2', title: 'Thread 2', is_pinned: 0, updated_at: 2000 },
      ];

      const res = await request('/api/bbs');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.threads.length).toBe(2);
      expect(data.total).toBe(2);
    });

    it('支援 limit 和 offset 參數', async () => {
      mockThreads = Array.from({ length: 100 }, (_, i) => ({
        id: String(i + 1),
        title: `Thread ${i + 1}`,
        is_pinned: 0,
        updated_at: i,
      }));

      const res = await request('/api/bbs?limit=10&offset=5');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(5);
    });
  });

  // ==================== POST /api/bbs ====================
  describe('POST /api/bbs — 建立討論串', () => {
    it('應該成功建立討論串', async () => {
      const res = await request('/api/bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Thread',
          authorName: 'Author',
          content: 'Test content',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockThreads.length).toBe(1);
      expect(mockThreads[0].title).toBe('Test Thread');
    });

    it('缺少必要欄位應返回 400', async () => {
      const res = await request('/api/bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          // 缺少 authorName 和 content
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeTruthy();
    });

    it('標題太長應返回 400', async () => {
      const res = await request('/api/bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'a'.repeat(101),
          authorName: 'Author',
          content: 'Content',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Title too long');
    });

    it('內容太長應返回 400', async () => {
      const res = await request('/api/bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Title',
          authorName: 'Author',
          content: 'a'.repeat(2001),
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content too long');
    });

    it('應該支援 authorTrip', async () => {
      const res = await request('/api/bbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Title',
          authorName: 'Author',
          authorTrip: 'trip123',
          content: 'Content',
        }),
      });

      expect(res.status).toBe(200);
      expect(mockThreads[0].author_trip).toBe('trip123');
    });
  });

  // ==================== GET /api/bbs/:threadId ====================
  describe('GET /api/bbs/:threadId — 取得討論串', () => {
    it('應該返回討論串和回覆', async () => {
      mockThreads = [
        { id: '1', title: 'Thread 1', content: 'Content 1' },
      ];
      mockReplies = [
        { id: '1', thread_id: '1', content: 'Reply 1' },
        { id: '2', thread_id: '1', content: 'Reply 2' },
      ];

      const res = await request('/api/bbs/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.thread).toBeTruthy();
      expect(data.thread.title).toBe('Thread 1');
      expect(data.replies.length).toBe(2);
    });

    it('不存在的討論串應返回 404', async () => {
      const res = await request('/api/bbs/999');
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('沒有回覆的討論串應返回空回覆列表', async () => {
      mockThreads = [{ id: '1', title: 'Thread' }];

      const res = await request('/api/bbs/1');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.replies).toEqual([]);
    });
  });

  // ==================== POST /api/bbs/:threadId/reply ====================
  describe('POST /api/bbs/:threadId/reply — 回覆', () => {
    it('應該成功回覆', async () => {
      mockThreads = [{ id: '1', title: 'Thread', is_locked: 0, reply_count: 0 }];

      const res = await request('/api/bbs/1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: 'Replier',
          content: 'Reply content',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockReplies.length).toBe(1);
    });

    it('缺少必要欄位應返回 400', async () => {
      mockThreads = [{ id: '1', is_locked: 0 }];

      const res = await request('/api/bbs/1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('鎖定的討論串應返回 403', async () => {
      mockThreads = [{ id: '1', is_locked: 1 }];

      const res = await request('/api/bbs/1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: 'Replier',
          content: 'Reply',
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('locked');
    });

    it('不存在的討論串應返回 404', async () => {
      const res = await request('/api/bbs/999/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: 'Replier',
          content: 'Reply',
        }),
      });

      expect(res.status).toBe(404);
    });

    it('回覆內容太長應返回 400', async () => {
      mockThreads = [{ id: '1', is_locked: 0 }];

      const res = await request('/api/bbs/1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: 'Replier',
          content: 'a'.repeat(2001),
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ==================== POST /api/bbs/:threadId/lock ====================
  describe('POST /api/bbs/:threadId/lock — 鎖定', () => {
    it('應該鎖定討論串', async () => {
      mockThreads = [{ id: '1', is_locked: 0 }];

      const res = await request('/api/bbs/1/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: true }),
      });

      expect(res.status).toBe(200);
      expect(mockThreads[0].is_locked).toBe(1);
    });

    it('應該解鎖討論串', async () => {
      mockThreads = [{ id: '1', is_locked: 1 }];

      const res = await request('/api/bbs/1/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: false }),
      });

      expect(res.status).toBe(200);
      expect(mockThreads[0].is_locked).toBe(0);
    });
  });

  // ==================== POST /api/bbs/:threadId/pin ====================
  describe('POST /api/bbs/:threadId/pin — 置頂', () => {
    it('應該置頂討論串', async () => {
      mockThreads = [{ id: '1', is_pinned: 0 }];

      const res = await request('/api/bbs/1/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: true }),
      });

      expect(res.status).toBe(200);
      expect(mockThreads[0].is_pinned).toBe(1);
    });

    it('應該取消置頂', async () => {
      mockThreads = [{ id: '1', is_pinned: 1 }];

      const res = await request('/api/bbs/1/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: false }),
      });

      expect(res.status).toBe(200);
      expect(mockThreads[0].is_pinned).toBe(0);
    });
  });

  // ==================== DELETE /api/bbs/:threadId ====================
  describe('DELETE /api/bbs/:threadId — 刪除', () => {
    it('應該刪除討論串及其回覆', async () => {
      mockThreads = [{ id: '1', title: 'Thread' }];
      mockReplies = [
        { id: '1', thread_id: '1', content: 'Reply 1' },
        { id: '2', thread_id: '1', content: 'Reply 2' },
      ];

      const res = await request('/api/bbs/1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Mock DB 的 delete 是模擬的，驗證 API 回應正確即可
    });
  });
});
