/**
 * Trip 註冊 / 驗證路由測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import tripRoutes from '../trip';
import type { Env } from '../../types';

// 模擬 KV store（記憶體實作）
function createInMemoryKV() {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key) || null;
      if (type === 'json' && val) {
        return JSON.parse(val);
      }
      return val;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [] })
  };
}

function createMockEnv(): Env {
  return {
    DB: {
      prepare: () => ({
        bind: (..._args: any[]) => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] })
        })
      })
    } as any,
    KV: createInMemoryKV() as any,
    R2: {
      put: async () => {},
      get: async () => null,
      list: async () => ({ objects: [] })
    } as any,
    WEREWOLF_ROOM: {
      idFromName: (name: string) => name,
      get: (_id: string) => ({
        fetch: async () => new Response(JSON.stringify({}), { status: 200 })
      })
    } as any,
    ASSETS: {
      fetch: async () => null
    } as any
  };
}

describe('Trip Register/Verify API', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = new Hono();
    app.route('/', tripRoutes);
  });

  // 輔助：發送請求
  async function request(path: string, init?: RequestInit): Promise<Response> {
    return app.request(new Request(`http://localhost${path}`, init), undefined, mockEnv);
  }

  describe('POST /api/trip/register', () => {
    it('新密碼註冊 → registered: true', async () => {
      const response = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'my-secret' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.trip).toBeTruthy();
      expect(data.trip.length).toBeGreaterThan(0);
      expect(data.registered).toBe(true);
    });

    it('重複註冊同密碼 → registered: false（冪等）', async () => {
      const body = JSON.stringify({ password: 'my-secret' });

      // 第一次
      const res1 = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.registered).toBe(true);

      // 第二次同密碼
      const res2 = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.registered).toBe(false);
      // trip 字串應相同
      expect(data2.trip).toBe(data1.trip);
    });

    it('缺少密碼 → 400', async () => {
      const response = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/trip/verify', () => {
    it('正確密碼驗證 → valid: true', async () => {
      // 先註冊
      const registerRes = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' })
      });
      const { trip } = await registerRes.json();

      // 再驗證
      const verifyRes = await request('/api/trip/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password', trip })
      });

      expect(verifyRes.status).toBe(200);
      const data = await verifyRes.json();
      expect(data.valid).toBe(true);
    });

    it('錯誤密碼驗證 → valid: false', async () => {
      // 先註冊
      const registerRes = await request('/api/trip/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' })
      });
      const { trip } = await registerRes.json();

      // 用錯誤密碼驗證
      const verifyRes = await request('/api/trip/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password', trip })
      });

      expect(verifyRes.status).toBe(200);
      const data = await verifyRes.json();
      expect(data.valid).toBe(false);
    });

    it('未註冊的 trip → valid: false', async () => {
      const verifyRes = await request('/api/trip/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'never-registered', trip: 'ZZZZZZZZ' })
      });

      expect(verifyRes.status).toBe(200);
      const data = await verifyRes.json();
      expect(data.valid).toBe(false);
    });

    it('缺少參數 → 400', async () => {
      const response = await request('/api/trip/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test' })
      });

      expect(response.status).toBe(400);
    });
  });
});
