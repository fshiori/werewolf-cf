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
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          run: async () => ({ success: true }),
          first: async () => {
            if (query.includes('SELECT setting_value FROM game_settings')) {
              const settingName = args[0];
              const mockSettings: Record<string, string> = {
                default_time_limit: '300',
                silence_mode_enabled: '1',
                silence_mode_timeout: '60',
                allow_spectators: '1',
                max_spectators: '10',
              };
              const settingValue = mockSettings[settingName];
              return settingValue ? { setting_value: settingValue } : null;
            }
            return null;
          },
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
    ENVIRONMENT: 'development',
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

    it('GET /api/icons/upload/cancel 應該回傳取消成功', async () => {
      const response = await request('/api/icons/upload/cancel');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.cancelled).toBe(true);
      expect(data.message).toContain('cancel');
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

  describe('自訂表情（user_emot parity）', () => {
    it('GET /api/emoticons 應該回傳 emot/ 前綴列表', async () => {
      const env = createMockEnv();
      env.R2 = {
        put: async () => {},
        get: async () => null,
        list: async ({ prefix }: { prefix?: string }) => {
          if (prefix === 'emot/') {
            return {
              objects: [
                { key: 'emot/smile.png', size: 123, uploaded: '2026-01-01T00:00:00.000Z' },
                { key: 'emot/wolf.gif', size: 456, uploaded: '2026-01-02T00:00:00.000Z' },
              ]
            };
          }
          return { objects: [] };
        }
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/emoticons'),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.emoticons)).toBe(true);
      expect(data.emoticons.length).toBe(2);
      expect(data.emoticons[0].name).toBe('smile');
      expect(data.emoticons[0].url).toContain('/emot/smile.png');
    });

    it('GET /emot/:filename 應該回傳對應檔案', async () => {
      const env = createMockEnv();
      env.R2 = {
        put: async () => {},
        list: async () => ({ objects: [] }),
        get: async (key: string) => {
          if (key === 'emot/smile.png') {
            return {
              body: new ReadableStream(),
              httpEtag: 'test-etag',
              writeHttpMetadata: (headers: Headers) => {
                headers.set('content-type', 'image/png');
              }
            };
          }
          return null;
        }
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/emot/smile.png'),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/png');
      expect(response.headers.get('etag')).toBe('test-etag');
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

    it('POST /api/rooms legacy gameOption token 字串應可解析並傳入 DO', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'Legacy Token Room',
          maxUser: 16,
          gameOption: 'wish_role open_vote dummy_boy comoutl votedme votedisplay cust_dummy real_time:5:2 as_gm gm:GMABC123'
        })
      });

      expect(response.status).toBe(200);
      expect(lastDoInitBody).not.toBeNull();
      expect(lastDoInitBody.roomOptions.wishRole).toBe(true);
      expect(lastDoInitBody.roomOptions.openVote).toBe(true);
      expect(lastDoInitBody.roomOptions.dummyBoy).toBe(true);
      expect(lastDoInitBody.roomOptions.comoutl).toBe(true);
      expect(lastDoInitBody.roomOptions.voteMe).toBe(true);
      expect(lastDoInitBody.roomOptions.votedisplay).toBe(true);
      expect(lastDoInitBody.roomOptions.custDummy).toBe(true);
      expect(lastDoInitBody.roomOptions.realTime).toBe(true);
      expect(lastDoInitBody.roomOptions.realTimeDayLimitSec).toBe(300);
      expect(lastDoInitBody.roomOptions.realTimeNightLimitSec).toBe(120);
      expect(lastDoInitBody.roomOptions.gmEnabled).toBe(true);
      expect(lastDoInitBody.gmTrip).toBe('GMABC123');
    });

    it('POST /api/rooms gameOption JSON 帶 custDummy 自訂欄位應傳入 DO', async () => {
      const response = await request('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '198.51.100.77'
        },
        body: JSON.stringify({
          roomName: 'Custom Dummy Room',
          maxUser: 16,
          gameOption: JSON.stringify({
            dummyBoy: true,
            custDummy: true,
            dummyCustomName: '村口稻草人',
            dummyCustomLastWords: '我只是替身，別太想我。'
          })
        })
      });

      expect(response.status).toBe(200);
      expect(lastDoInitBody.roomOptions.dummyBoy).toBe(true);
      expect(lastDoInitBody.roomOptions.custDummy).toBe(true);
      expect(lastDoInitBody.roomOptions.dummyCustomName).toBe('村口稻草人');
      expect(lastDoInitBody.roomOptions.dummyCustomLastWords).toBe('我只是替身，別太想我。');
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

    it('房間不存在時，join 應回 404', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => null,
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/99999/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.46'
          },
          body: JSON.stringify({
            uname: 'nouser',
            handleName: 'NoUser',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Room not found');
    });

    it('trip 含非英數字元時 join 應拒絕（400）', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: ''
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.47'
          },
          body: JSON.stringify({
            uname: 'badtrip',
            handleName: 'BadTrip',
            trip: 'abc_123',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid trip format');
    });

    it('trip 缺少英數混合（僅字母）時 join 應拒絕（400）', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: ''
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.48'
          },
          body: JSON.stringify({
            uname: 'badtrip2',
            handleName: 'BadTrip2',
            trip: 'abcdef',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid trip format');
    });

    it('wishRole 房規啟用時，join 會保存希望角色到 session', async () => {
      let savedSession: any = null;
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: JSON.stringify({ wishRole: true })
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;
      env.KV = {
        get: async () => null,
        put: async (key: string, value: string) => {
          if (key.startsWith('session:')) {
            savedSession = JSON.parse(value);
          }
        },
        delete: async () => {},
        list: async () => ({ keys: [] })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male',
            wishRole: 'wolf'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      expect(savedSession?.wishRole).toBe('wolf');
    });

    it('wishRole 房規未啟用時，即使 join 傳 wishRole 也強制為 none', async () => {
      let savedSession: any = null;
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: JSON.stringify({ wishRole: false })
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;
      env.KV = {
        get: async () => null,
        put: async (key: string, value: string) => {
          if (key.startsWith('session:')) {
            savedSession = JSON.parse(value);
          }
        },
        delete: async () => {},
        list: async () => ({ keys: [] })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male',
            wishRole: 'wolf'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      expect(savedSession?.wishRole).toBe('none');
    });

    it('legacy game_option=wish_role 時，join 會保存 wishRole 到 session', async () => {
      let savedSession: any = null;
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: 'wish_role votedisplay'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;
      env.KV = {
        get: async () => null,
        put: async (key: string, value: string) => {
          if (key.startsWith('session:')) {
            savedSession = JSON.parse(value);
          }
        },
        delete: async () => {},
        list: async () => ({ keys: [] })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.49'
          },
          body: JSON.stringify({
            uname: 'legacywish',
            handleName: 'LegacyWish',
            trip: '',
            iconNo: 1,
            sex: 'male',
            wishRole: 'wolf'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      expect(savedSession?.wishRole).toBe('wolf');
    });

    it('legacy token game_option=istrip 時，不帶 trip 的 join 會被拒絕（403）', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: 'istrip votedisplay'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.41'
          },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Trip code required');
    });

    it('legacy token game_option=istrip 時，帶 trip 的 join 可成功', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: 'istrip votedisplay'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.42'
          },
          body: JSON.stringify({
            uname: 'testuser',
            handleName: 'Test',
            trip: 'TRIP1234',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('REGIST_ONE_IP_ADDRESS=1 且同 IP 已在房內時，join 應拒絕（403）', async () => {
      const env = createMockEnv();
      env.REGIST_ONE_IP_ADDRESS = '1';
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: ''
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;
      env.KV = {
        get: async (key: string) => {
          if (key === 'session:existing') {
            return {
              sessionId: 'existing',
              uname: 'existing_user',
              roomNo: 12345,
              userNo: 0,
              handleName: 'Existing',
              role: 'human',
              ipAddress: '203.0.113.88',
              createdAt: Date.now() - 1000,
              expiresAt: Date.now() + 3600_000,
            };
          }
          return null;
        },
        put: async () => {},
        delete: async () => {},
        list: async () => ({ keys: [{ name: 'session:existing' }] })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.88'
          },
          body: JSON.stringify({
            uname: 'newuser',
            handleName: 'NewUser',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Same IP already joined this room');
    });

    it('REGIST_ONE_IP_ADDRESS=1 但不同 IP 時，join 仍可成功', async () => {
      let savedSession: any = null;
      const env = createMockEnv();
      env.REGIST_ONE_IP_ADDRESS = 'true';
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: ''
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;
      env.KV = {
        get: async (key: string) => {
          if (key === 'session:existing') {
            return {
              sessionId: 'existing',
              uname: 'existing_user',
              roomNo: 12345,
              userNo: 0,
              handleName: 'Existing',
              role: 'human',
              ipAddress: '203.0.113.90',
              createdAt: Date.now() - 1000,
              expiresAt: Date.now() + 3600_000,
            };
          }
          return null;
        },
        put: async (key: string, value: string) => {
          if (key.startsWith('session:')) {
            savedSession = JSON.parse(value);
          }
        },
        delete: async () => {},
        list: async () => ({ keys: [{ name: 'session:existing' }] })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.91'
          },
          body: JSON.stringify({
            uname: 'newuser2',
            handleName: 'NewUser2',
            trip: '',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(savedSession?.ipAddress).toBe('203.0.113.91');
    });

    it('房間 status 非 waiting 時應拒絕 join（400）', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: 'as_gm gm:GM123TRIP',
              status: 'playing',
              day_night: 'day'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.44'
          },
          body: JSON.stringify({
            uname: 'latejoin',
            handleName: 'LateJoin',
            trip: 'GM123TRIP',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Game already started');
    });

    it('房間 day_night 非 beforegame 時應拒絕 join（400）', async () => {
      const env = createMockEnv();
      env.DB = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              is_private: 0,
              password_hash: null,
              game_option: 'as_gm gm:GM123TRIP',
              status: 'waiting',
              day_night: 'night'
            }),
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const testApp = new Hono();
      testApp.route('/', api);

      const response = await testApp.request(
        new Request('http://localhost/api/rooms/12345/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.45'
          },
          body: JSON.stringify({
            uname: 'latejoin2',
            handleName: 'LateJoin2',
            trip: 'GM123TRIP',
            iconNo: 1,
            sex: 'male'
          })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Game already started');
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
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.43'
          },
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

  // ==================== Task 5: 使用者端刪除房間 ====================
  describe('Task 5: DELETE /api/rooms/:roomNo 使用者端刪房', () => {
    // 輔助：建立帶有自訂 DB mock 的 env
    function createDbEnv(dbMock: any): Env {
      const env = createMockEnv();
      env.DB = dbMock;
      return env;
    }

    it('房間不存在 → 404', async () => {
      // DB.first 回傳 null（房間不存在）
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => null,
            all: async () => ({ results: [] })
          })
        })
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/99999', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        undefined,
        env
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('playing 狀態的房間不可刪除 → 400', async () => {
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              room_no: 1000,
              status: 'playing',
              is_private: 0,
              password_hash: ''
            }),
            all: async () => ({ results: [] })
          })
        })
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/1000', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        undefined,
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('in progress');
    });

    it('waiting 公開房間刪除成功 → 200', async () => {
      let batchCalled = false;
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              room_no: 2000,
              status: 'waiting',
              is_private: 0,
              password_hash: ''
            }),
            all: async () => ({ results: [] })
          })
        }),
        batch: async (_stmts: any[]) => {
          batchCalled = true;
        }
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/2000', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(batchCalled).toBe(true);
    });

    it('私人房間不帶密碼 → 403', async () => {
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              room_no: 3000,
              status: 'waiting',
              is_private: 1,
              password_hash: await sha256hex('room-pw')
            }),
            all: async () => ({ results: [] })
          })
        })
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/3000', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        undefined,
        env
      );

      expect(response.status).toBe(403);
    });

    it('私人房間密碼錯誤 → 403', async () => {
      const correctHash = await sha256hex('correct-pw');
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              room_no: 3001,
              status: 'waiting',
              is_private: 1,
              password_hash: correctHash
            }),
            all: async () => ({ results: [] })
          })
        })
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/3001', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'wrong-pw' })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(403);
    });

    it('私人房間密碼正確 → 刪除成功', async () => {
      let batchCalled = false;
      const correctHash = await sha256hex('correct-pw');
      const env = createDbEnv({
        prepare: (_q: string) => ({
          bind: (..._args: any[]) => ({
            run: async () => ({ success: true }),
            first: async () => ({
              room_no: 3002,
              status: 'ended',
              is_private: 1,
              password_hash: correctHash
            }),
            all: async () => ({ results: [] })
          })
        }),
        batch: async (_stmts: any[]) => {
          batchCalled = true;
        }
      });

      const deleteApp = new Hono();
      deleteApp.route('/', api);

      const response = await deleteApp.request(
        new Request('http://localhost/api/rooms/3002', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'correct-pw' })
        }),
        undefined,
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(batchCalled).toBe(true);
    });
  });

  // ==================== Task 6: Version & Rule Summary APIs ====================
  describe('Task 6: /api/version', () => {
    it('GET /api/version 應該返回正確結構', async () => {
      const response = await request('/api/version');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
      expect(data.buildDate).toBeDefined();
      expect(typeof data.buildDate).toBe('string');
      expect(data.tech).toBeDefined();
      expect(typeof data.tech).toBe('string');
      expect(data.tech).toContain('Cloudflare Workers');

      expect(data.scriptInfo).toBeDefined();
      expect(data.scriptInfo.timezone).toBe('Asia/Taipei');
      expect(data.scriptInfo.defaultTimeLimitSec).toBe(300);
      expect(data.scriptInfo.silenceModeEnabled).toBe(true);
      expect(data.scriptInfo.silenceModeTimeoutSec).toBe(60);
      expect(data.scriptInfo.allowSpectators).toBe(true);
      expect(data.scriptInfo.maxSpectators).toBe(10);
    });
  });

  describe('Task 6: /api/script-info', () => {
    it('GET /api/script-info 應該返回 script 設定摘要', async () => {
      const response = await request('/api/script-info');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.scriptInfo).toBeDefined();
      expect(data.scriptInfo.timezone).toBe('Asia/Taipei');
      expect(data.scriptInfo.defaultTimeLimitSec).toBe(300);
      expect(data.scriptInfo.silenceModeEnabled).toBe(true);
      expect(data.scriptInfo.silenceModeTimeoutSec).toBe(60);
      expect(data.scriptInfo.allowSpectators).toBe(true);
      expect(data.scriptInfo.maxSpectators).toBe(10);
    });
  });

  describe('Task 6: /api/announcement', () => {
    it('GET /api/announcement 無公告時應該返回空字串', async () => {
      const response = await request('/api/announcement');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.announcement).toBe('');
      expect(data.hasAnnouncement).toBe(false);
    });

    it('GET /api/announcement 有設定公告時應該返回內容', async () => {
      mockEnv.ANNOUNCEMENT_TEXT = '  server maintenance tonight  ';
      const response = await request('/api/announcement');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.announcement).toBe('server maintenance tonight');
      expect(data.hasAnnouncement).toBe(true);
    });
  });

  describe('Task 6: /api/rule-summary', () => {
    it('GET /api/rule-summary 應該返回角色陣列與必要欄位', async () => {
      const response = await request('/api/rule-summary');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles.length).toBeGreaterThan(0);

      // 每個角色必須有 name, team, description
      for (const role of data.roles) {
        expect(role.name).toBeDefined();
        expect(typeof role.name).toBe('string');
        expect(role.team).toBeDefined();
        expect(['human', 'wolf', 'fox']).toContain(role.team);
        expect(role.description).toBeDefined();
        expect(typeof role.description).toBe('string');
      }

      // phases
      expect(Array.isArray(data.phases)).toBe(true);
      expect(data.phases).toContain('waiting');
      expect(data.phases).toContain('day');
      expect(data.phases).toContain('night');

      // winConditions
      expect(data.winConditions).toBeDefined();
      expect(data.winConditions.human).toBeDefined();
      expect(data.winConditions.wolf).toBeDefined();
      expect(typeof data.winConditions.human).toBe('string');
      expect(typeof data.winConditions.wolf).toBe('string');
    });
  });
});
