/**
 * API 路由測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import api from '../api';
import type { Env } from '../../types';

// SHA-256 雜湊輔助（與 api.ts 中的密碼雜湊邏輯一致）
async function sha256hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text + 'room-pw-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 記錄 DO fetch 呼叫的 body
let lastDoInitBody: any = null;

// Mock 環境
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
      idFromName: (name: string) => name,
      get: (_id: string) => ({
        fetch: async (req: Request) => {
          const url = new URL(req.url);
          if (url.pathname === '/init' && req.method === 'POST') {
            lastDoInitBody = await req.json();
          }
          return new Response(JSON.stringify({}), { status: 200 });
        }
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

  // Helper to make requests with env bindings
  async function request(path: string, init?: RequestInit): Promise<Response> {
    return app.request(new Request(`http://localhost${path}`, init), undefined, mockEnv);
  }

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
      const response = await request('/api/rooms', {
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
      const response = await request('/api/rooms', {
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
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'a'.repeat(33)
        })
      });
      
      expect(response.status).toBe(400);
    });

    it('無效的人數限制應該返回錯誤', async () => {
      const response = await request('/api/rooms', {
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
      const response = await request('/api/rooms/123');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toBeTruthy();
    });
  });

  describe('Tripcode 生成', () => {
    it('POST /api/trip 應該生成 tripcode', async () => {
      const response = await request('/api/trip', {
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
      const response = await request('/api/trip', {
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
      
      const response = await request('/api/icons', {
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
      
      const response = await request('/api/icons', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('頭像列表', () => {
    it('GET /api/icons 應該返回頭像列表', async () => {
      const response = await request('/api/icons');
      
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

  // ==================== Task 2: 建房 typed options + 密碼 ====================
  describe('Task 2: 建房 typed options 與私人房間', () => {
    beforeEach(() => {
      lastDoInitBody = null;
    });

    it('POST /api/rooms 不帶密碼 → is_private = 0', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Public Room',
          maxUser: 16
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // 驗證傳給 DO 的 init body
      expect(lastDoInitBody).not.toBeNull();
      expect(lastDoInitBody.isPrivate).toBe(false);
      expect(lastDoInitBody.passwordHash).toBe('');
    });

    it('POST /api/rooms 帶密碼 → is_private = 1，passwordHash 為 SHA-256', async () => {
      const password = 'my-secret-room';
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Private Room',
          maxUser: 16,
          password
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // 驗證傳給 DO 的 init body
      expect(lastDoInitBody).not.toBeNull();
      expect(lastDoInitBody.isPrivate).toBe(true);
      // 驗證密碼已雜湊（不應該是明文）
      expect(lastDoInitBody.passwordHash).not.toBe(password);
      expect(lastDoInitBody.passwordHash).toBeTruthy();
      // 驗證雜湊長度為 64 字元（SHA-256 hex）
      expect(lastDoInitBody.passwordHash.length).toBe(64);
    });

    it('POST /api/rooms 帶 options → 解析並傳入 DO', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Opts Room',
          maxUser: 16,
          options: {
            timeLimit: 120,
            silenceMode: true,
            openVote: true,
            will: false
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // 驗證傳給 DO 的 roomOptions
      expect(lastDoInitBody).not.toBeNull();
      expect(lastDoInitBody.roomOptions).toBeDefined();
      expect(lastDoInitBody.roomOptions.timeLimit).toBe(120);
      expect(lastDoInitBody.roomOptions.silenceMode).toBe(true);
      expect(lastDoInitBody.roomOptions.openVote).toBe(true);
      expect(lastDoInitBody.roomOptions.will).toBe(false);
      // 未指定的欄位應 fallback 到預設值
      expect(lastDoInitBody.roomOptions.allowSpectators).toBe(true);
    });

    it('POST /api/rooms options 為非法值 → fallback 到預設', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Bad Opts Room',
          maxUser: 16,
          options: {
            timeLimit: -5,  // 不合法
            silenceMode: 'yes' as any  // 不是 boolean
          }
        })
      });

      expect(response.status).toBe(200);

      // 驗證非法值 fallback 到預設
      expect(lastDoInitBody.roomOptions.timeLimit).toBe(60); // 預設值
      expect(lastDoInitBody.roomOptions.silenceMode).toBe(false); // 預設值
    });

    it('POST /api/rooms 帶密碼 + options → 兩者都正確傳入', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Full Room',
          maxUser: 16,
          password: 'pw123',
          options: { timeLimit: 90, silenceMode: true }
        })
      });

      expect(response.status).toBe(200);
      expect(lastDoInitBody.isPrivate).toBe(true);
      expect(lastDoInitBody.passwordHash).toBeTruthy();
      expect(lastDoInitBody.roomOptions.timeLimit).toBe(90);
      expect(lastDoInitBody.roomOptions.silenceMode).toBe(true);
    });
  });

  // ==================== Task 3: 加入房間密碼驗證 ====================
  describe('Task 3: 加入房間密碼驗證', () => {
    // 為了測試密碼驗證，需要 mock DB.prepare.first 回傳私人房間
    it('私人房間，不帶密碼 → 403', async () => {
      // 建立一個會回傳私人房間的 mockEnv
      const privateEnv = createMockEnv();
      privateEnv.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 1,
              password_hash: 'somehash'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const privateApp = new Hono();
      privateApp.route('/', api);

      const response = await privateApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        privateEnv
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('私人房間，密碼錯誤 → 403', async () => {
      const correctHash = await sha256hex('correct-pw');
      const privateEnv = createMockEnv();
      privateEnv.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 1,
              password_hash: correctHash
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const privateApp = new Hono();
      privateApp.route('/', api);

      const response = await privateApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male',
            password: 'wrong-password'
          })
        }),
        undefined,
        privateEnv
      );

      expect(response.status).toBe(403);
    });

    it('私人房間，密碼正確 → 成功加入', async () => {
      const correctHash = await sha256hex('correct-pw');
      const privateEnv = createMockEnv();
      privateEnv.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 1,
              password_hash: correctHash
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const privateApp = new Hono();
      privateApp.route('/', api);

      const response = await privateApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male',
            password: 'correct-pw'
          })
        }),
        undefined,
        privateEnv
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('公開房間，不需密碼 → 成功加入', async () => {
      const publicEnv = createMockEnv();
      publicEnv.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const publicApp = new Hono();
      publicApp.route('/', api);

      const response = await publicApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        publicEnv
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('私人房間，密碼正確但不帶 password 欄位 → 403', async () => {
      const correctHash = await sha256hex('correct-pw');
      const privateEnv = createMockEnv();
      privateEnv.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 1,
              password_hash: correctHash
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const privateApp = new Hono();
      privateApp.route('/', api);

      const response = await privateApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male'
            // 沒有 password 欄位
          })
        }),
        undefined,
        privateEnv
      );

      expect(response.status).toBe(403);
    });
  });

  // ==================== Task 4: Room info 安全性 ====================
  describe('Task 4: Room info 不洩漏敏感資料', () => {
    it('/info 應該返回 isPrivate、timeLimit、silenceMode', async () => {
      // 模擬 DO 回傳帶有 roomOptions 的資訊
      const infoEnv = createMockEnv();
      infoEnv.WEREWOLF_ROOM = {
        idFromName: (name: string) => name,
        get: (_id: string) => ({
          fetch: async (req: Request) => {
            const url = new URL(req.url);
            if (url.pathname === '/info') {
              return new Response(JSON.stringify({
                roomNo: 12345,
                roomName: 'Test',
                roomComment: '',
                maxUser: 16,
                status: 'waiting',
                date: 1,
                dayNight: 'beforegame',
                playerCount: 0,
                lastUpdated: Date.now(),
                isPrivate: true,
                timeLimit: 120,
                silenceMode: true
              }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
          }
        })
      } as any;

      const infoApp = new Hono();
      infoApp.route('/', api);

      const response = await infoApp.request(
        new Request('http://localhost/api/rooms/12345'),
        undefined,
        infoEnv
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isPrivate).toBe(true);
      expect(data.timeLimit).toBe(120);
      expect(data.silenceMode).toBe(true);
    });

    it('/info 不應該返回 passwordHash', async () => {
      const infoEnv = createMockEnv();
      infoEnv.WEREWOLF_ROOM = {
        idFromName: (name: string) => name,
        get: (_id: string) => ({
          fetch: async (req: Request) => {
            const url = new URL(req.url);
            if (url.pathname === '/info') {
              return new Response(JSON.stringify({
                roomNo: 12345,
                roomName: 'Private Room',
                isPrivate: true,
                timeLimit: 60,
                silenceMode: false
              }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
          }
        })
      } as any;

      const infoApp = new Hono();
      infoApp.route('/', api);

      const response = await infoApp.request(
        new Request('http://localhost/api/rooms/12345'),
        undefined,
        infoEnv
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // 確認沒有 passwordHash 欄位
      expect(data.passwordHash).toBeUndefined();
      // 確認沒有 password 欄位
      expect(data.password).toBeUndefined();
    });

    it('/info 不應該洩漏玩家角色資訊', async () => {
      const infoEnv = createMockEnv();
      infoEnv.WEREWOLF_ROOM = {
        idFromName: (name: string) => name,
        get: (_id: string) => ({
          fetch: async (req: Request) => {
            const url = new URL(req.url);
            if (url.pathname === '/info') {
              return new Response(JSON.stringify({
                roomNo: 12345,
                roomName: 'Game Room',
                isPrivate: false,
                timeLimit: 60,
                silenceMode: false,
                playerCount: 3
              }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
          }
        })
      } as any;

      const infoApp = new Hono();
      infoApp.route('/', api);

      const response = await infoApp.request(
        new Request('http://localhost/api/rooms/12345'),
        undefined,
        infoEnv
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // 確認沒有玩家角色資訊
      expect(data.players).toBeUndefined();
      expect(data.roles).toBeUndefined();
    });
  });
});
