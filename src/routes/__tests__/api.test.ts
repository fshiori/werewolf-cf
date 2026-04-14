/**
 * API 路由測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import api from '../api';
import type { Env } from '../types';

// Mock 環境
function createMockEnv(): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] })
        })
      })
    } as any,
    KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] })
    } as any,
    R2: {
      put: async () => {},
      get: async () => null,
      list: async () => ({ objects: [] })
    } as any,
    WEREWOLF_ROOM: {
      idFromName: () => ({
        get: () => ({
          fetch: async () => new Response(JSON.stringify({}), { status: 200 })
        })
      })
    } as any,
    ASSETS: {
      fetch: async () => null
    } as any
  };
}

describe('API Routes', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = new Hono();
    app.route('/', api);
  });

  describe('健康檢查', () => {
    it('GET / 應該返回健康狀態', async () => {
      const response = await app.request('/');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.name).toBe('Werewolf CF');
      expect(data.status).toBe('ok');
    });
  });

  describe('建立房間', () => {
    it('POST /api/rooms 應該建立新房間', async () => {
      const response = await app.request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Test Room',
          roomComment: 'Test',
          maxUser: 16
        })
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.roomNo).toBeTruthy();
    });

    it('缺少房間名稱應該返回錯誤', async () => {
      const response = await app.request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: ''
        })
      });
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('房間名稱太長應該返回錯誤', async () => {
      const response = await app.request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'a'.repeat(33)
        })
      });
      
      expect(response.status).toBe(400);
    });

    it('無效的人數限制應該返回錯誤', async () => {
      const response = await app.request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Test',
          maxUser: 1
        })
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('獲取房間資訊', () => {
    it('GET /api/rooms/:roomNo 應該返回房間資訊', async () => {
      const response = await app.request('/api/rooms/123');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toBeTruthy();
    });
  });

  describe('Tripcode 生成', () => {
    it('POST /api/trip 應該生成 tripcode', async () => {
      const response = await app.request('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'test123'
        })
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.trip).toBeTruthy();
      expect(data.trip.length).toBeGreaterThan(0);
    });

    it('缺少密碼應該返回錯誤', async () => {
      const response = await app.request('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('頭像上傳', () => {
    it('POST /api/icons 應該上傳頭像', async () => {
      const formData = new FormData();
      formData.append('icon', new Blob(['test'], { type: 'image/png' }), 'test.png');
      formData.append('name', 'test');
      
      const response = await app.request('/api/icons', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.iconFilename).toBeTruthy();
    });

    it('缺少檔案應該返回錯誤', async () => {
      const formData = new FormData();
      formData.append('name', 'test');
      
      const response = await app.request('/api/icons', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('頭像列表', () => {
    it('GET /api/icons 應該返回頭像列表', async () => {
      const response = await app.request('/api/icons');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data.icons)).toBe(true);
    });
  });

  describe('CORS', () => {
    it('應該包含 CORS headers', async () => {
      const response = await app.request('/', {
        method: 'OPTIONS'
      });
      
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });
  });

  describe('404 處理', () => {
    it('未知的 API 應該返回 404', async () => {
      const response = await app.request('/api/unknown');
      
      expect(response.status).toBe(404);
    });
  });
});
