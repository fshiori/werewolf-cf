/**
 * 完整 API 路由（更新版）
 * 整合所有新功能
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { createSessionManager, createSession } from '../utils/session-manager';
import { BanManager } from '../utils/ban-manager';
import { StatsManager } from '../utils/stats-manager';
import { escapeHtml, sanitizeHtml } from '../utils/security';
import { defaultRateLimiter, apiRateLimiter } from '../utils/rate-limiter';
import { parseRoomOptions } from '../types/room-options';
import adminRoutes from './admin';
import featuresRoutes from './features';
import bbsRoutes from './bbs';
import tripRoutes from './trip';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors());

// 健康檢查
app.get('/', (c) => {
  return c.json({
    name: 'Werewolf CF',
    version: '1.0.0',
    status: 'ok',
    timestamp: Date.now()
  });
});

// ==================== 中間件 ====================

/**
 * IP 封鎖檢查
 */
async function checkBan(c: any, next: any) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  
  const banManager = new BanManager(c.env.KV);
  const isBanned = await banManager.isBanned(ip);
  
  if (isBanned) {
    const banInfo = await banManager.getBanInfo(ip);
    return c.json({
      error: 'IP banned',
      reason: banInfo?.reason || 'Violation of rules',
      expiresAt: banInfo?.expiresAt
    }, 403);
  }

  await next();
}

/**
 * 速率限制
 */
async function rateLimit(c: any, next: any) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  
  if (apiRateLimiter.isRateLimited(ip)) {
    const info = apiRateLimiter.getLimitInfo(ip);
    return c.json({
      error: 'Too many requests',
      retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000)
    }, 429);
  }

  await next();
}

// ==================== 房間管理 ====================

/**
 * 調試：測試 Session 建立流程
 */
app.post('/api/debug/session', async (c) => {
  try {
    const data = await c.req.json<{
      uname: string;
      handleName: string;
    }>();

    const sessionManager = createSessionManager(c.env.KV);
    const { sessionId, session } = createSession(
      data.uname,
      12345,
      0,
      data.handleName,
      'human',
      3600
    );

    // 儲存 session
    await sessionManager.save(session);

    // 讀回驗證
    const saved = await sessionManager.get(sessionId);

    return c.json({
      success: true,
      sessionId,
      session,
      saved: !!saved,
      savedSession: saved
    });
  } catch (error) {
    return c.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

/**
 * 建立新房間
 */
app.post('/api/rooms', checkBan, rateLimit, async (c) => {
  try {
    const data = await c.req.json<{
      roomName: string;
      roomComment?: string;
      maxUser?: number;
      gameOption?: string;
      optionRole?: string;
      password?: string;
      options?: any;
    }>();

    // 驗證
    if (!data.roomName || data.roomName.length > 32) {
      return c.json({ error: 'Invalid room name' }, 400);
    }

    const maxUser = data.maxUser || 16;
    if (maxUser < 2 || maxUser > 32) {
      return c.json({ error: 'Invalid max user count' }, 400);
    }

    // 轉義房間名稱（防止 XSS）
    const safeRoomName = escapeHtml(data.roomName);
    const safeComment = data.roomComment ? escapeHtml(data.roomComment) : '';

    // 處理私人房間密碼
    let isPrivate = false;
    let passwordHash = '';
    if (data.password && data.password.length > 0) {
      isPrivate = true;
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data.password + 'room-pw-salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 解析 typed room options
    const roomOptions = parseRoomOptions(data.options);

    // 生成房間編號
    const roomNo = Date.now();

    // 建立 Durable Object
    const id = c.env.WEREWOLF_ROOM.idFromName(roomNo.toString());
    const stub = c.env.WEREWOLF_ROOM.get(id);

    // 初始化
    await stub.fetch(new Request('https://dummy/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNo,
        roomName: safeRoomName,
        roomComment: safeComment,
        maxUser,
        gameOption: data.gameOption || '',
        optionRole: data.optionRole || '',
        isPrivate,
        passwordHash,
        roomOptions
      })
    }));

    // 更新統計
    const statsManager = new StatsManager(c.env.KV);
    await statsManager.incrementRoomCount();

    return c.json({
      success: true,
      roomNo,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Create room error:', error);
    return c.json({ error: 'Failed to create room' }, 500);
  }
});

/**
 * 獲取所有房間列表（從 D1 查詢）
 * NOTE: This static route must be registered BEFORE /api/rooms/:roomNo
 */
app.get('/api/rooms', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status');

    let query = 'SELECT room_no, room_name, room_comment, max_user, status, date, day_night, is_private, time_limit, silence_mode, uptime FROM room';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    // 只顯示最近有活動的房間（排除超過 24 小時沒更新的）
    query += status ? ' AND (last_updated IS NULL OR last_updated > ?)' : ' WHERE (last_updated IS NULL OR last_updated > ?)';
    params.push(Date.now() - 24 * 60 * 60 * 1000);

    query += ' ORDER BY last_updated DESC NULLS LAST LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    // 同時查詢各房間的玩家人數
    const rooms = result.results as any[];
    const roomNos = rooms.map(r => r.room_no);

    let playerCounts: Record<number, number> = {};
    if (roomNos.length > 0) {
      const placeholders = roomNos.map(() => '?').join(',');
      const countStmt = c.env.DB.prepare(
        `SELECT room_no, COUNT(*) as player_count FROM user_entry WHERE room_no IN (${placeholders}) GROUP BY room_no`
      );
      const countResult = await countStmt.bind(...roomNos).all();
      for (const row of countResult.results as any[]) {
        playerCounts[row.room_no] = row.player_count;
      }
    }

    const enrichedRooms = rooms.map(r => ({
      ...r,
      playerCount: playerCounts[r.room_no] || 0
    }));

    return c.json({ rooms: enrichedRooms, count: enrichedRooms.length });
  } catch (error) {
    console.error('Get rooms list error:', error);
    return c.json({ error: 'Failed to get rooms list' }, 500);
  }
});

/**
 * 獲取房間資訊
 */
app.get('/api/rooms/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const id = c.env.WEREWOLF_ROOM.idFromName(roomNo);
    const stub = c.env.WEREWOLF_ROOM.get(id);

    // @ts-ignore - TypeScript has trouble with Request type inference in Workers
    const response = await stub.fetch(new Request('https://dummy/info'));

    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.error('Get room error:', error);
    return c.json({ error: 'Room not found' }, 404);
  }
});

/**
 * 刪除房間（使用者端）
 * 條件：房間存在、非 playing 狀態、私人房需驗證密碼
 */
app.delete('/api/rooms/:roomNo', async (c) => {
  try {
    const roomNo = parseInt(c.req.param('roomNo'));
    const { password } = await c.req.json<{ password?: string }>().catch(() => ({}));

    // 從 D1 查詢房間
    const roomRow = await c.env.DB.prepare(
      'SELECT room_no, status, is_private, password_hash FROM room WHERE room_no = ?'
    ).bind(roomNo).first() as { room_no: number; status: string; is_private: number; password_hash: string } | null;

    if (!roomRow) {
      return c.json({ error: 'Room not found' }, 404);
    }

    // 只有 waiting 或 ended 狀態的房間可以刪除
    if (roomRow.status === 'playing') {
      return c.json({ error: 'Cannot delete room while game is in progress' }, 400);
    }

    // 私人房間需要驗證密碼
    if (roomRow.is_private === 1) {
      if (!password) {
        return c.json({ error: 'Password required for private room' }, 403);
      }

      // 雜湊使用者提供的密碼並比對
      const encoder = new TextEncoder();
      const encoded = encoder.encode(password + 'room-pw-salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (inputHash !== roomRow.password_hash) {
        return c.json({ error: 'Wrong password' }, 403);
      }
    }

    // 清理：通知 Durable Object
    try {
      const id = c.env.WEREWOLF_ROOM.idFromName(roomNo.toString());
      const stub = c.env.WEREWOLF_ROOM.get(id);
      await stub.fetch(new Request('https://internal/cleanup', { method: 'POST' }));
    } catch (e) {
      // DO 不存在或喚醒失敗，直接清理 D1
    }

    // 清理 D1 表格
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM talk WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM vote_history WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM game_events WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM user_entry WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM wills WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM whispers WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM spectators WHERE room_no = ?').bind(roomNo),
      c.env.DB.prepare('DELETE FROM room WHERE room_no = ?').bind(roomNo),
    ]);

    // 清理 KV 統計
    const statsManager = new StatsManager(c.env.KV);
    await statsManager.deleteRoomStats(roomNo);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete room error:', error);
    return c.json({ error: 'Failed to delete room' }, 500);
  }
});

// ==================== 玩家管理 ====================

/**
 * 玩家加入房間
 */
app.post('/api/rooms/:roomNo/join', checkBan, rateLimit, async (c) => {
  try {
    const roomNo = parseInt(c.req.param('roomNo'));
    const data = await c.req.json<{
      uname: string;
      handleName: string;
      trip: string;
      iconNo: number;
      sex: string;
      password?: string;
    }>();

    // 驗證
    if (!data.uname || data.uname.length < 1 || data.uname.length > 20) {
      return c.json({ error: 'Invalid username' }, 400);
    }

    if (!data.handleName || data.handleName.length > 32) {
      return c.json({ error: 'Invalid display name' }, 400);
    }

    // ---- 私人房間密碼驗證 ----
    // 從 D1 查詢房間是否為私人房間
    try {
      const roomRow = await c.env.DB.prepare(
        'SELECT is_private, password_hash FROM room WHERE room_no = ?'
      ).bind(roomNo).first();

      if (roomRow && roomRow.is_private === 1) {
        // 私人房間，必須提供密碼
        if (!data.password) {
          return c.json({ error: 'Password required for private room' }, 403);
        }

        // 雜湊使用者提供的密碼並比對
        const encoder = new TextEncoder();
        const encoded = encoder.encode(data.password + 'room-pw-salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (inputHash !== roomRow.password_hash) {
          return c.json({ error: 'Wrong password' }, 403);
        }
      }
    } catch (dbErr) {
      // D1 查詢失敗（可能房間不存在），不阻擋加入流程
      console.error('Room password check error:', dbErr);
    }

    // 轉義（XSS 防護）
    const safeUname = escapeHtml(data.uname);
    const safeHandleName = escapeHtml(data.handleName);

    // 生成 session
    const sessionManager = createSessionManager(c.env.KV);
    const { sessionId, session } = createSession(
      safeUname,
      roomNo,
      0, // userNo will be assigned
      safeHandleName,
      'human', // role will be assigned
      3600
    );

    // 儲存 session
    await sessionManager.save(session);

    // 更新統計
    const statsManager = new StatsManager(c.env.KV);
    await statsManager.incrementPlayerCount();

    return c.json({
      success: true,
      sessionId,
      message: 'Joined room successfully'
    });
  } catch (error) {
    console.error('Join room error:', error);
    return c.json({ error: 'Failed to join room' }, 500);
  }
});

/**
 * 玩家離開房間
 */
app.post('/api/rooms/:roomNo/leave', async (c) => {
  try {
    const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sessionManager = createSessionManager(c.env.KV);
    await sessionManager.delete(sessionToken);

    return c.json({ success: true, message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    return c.json({ error: 'Failed to leave room' }, 500);
  }
});

// ==================== WebSocket ====================

/**
 * WebSocket 連線
 */
app.get('/ws/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const sessionToken = c.req.query('session');

    if (!sessionToken) {
      return c.json({ error: 'Missing session token' }, 400);
    }

    // IP 封鎖檢查
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const banManager = new BanManager(c.env.KV);
    const isBanned = await banManager.isBanned(ip);
    
    if (isBanned) {
      return c.json({ error: 'IP banned' }, 403);
    }

    const id = c.env.WEREWOLF_ROOM.idFromName(roomNo);
    const stub = c.env.WEREWOLF_ROOM.get(id);

    const url = new URL(c.req.url);
    url.pathname = '/ws';
    url.searchParams.set('session', sessionToken);

    return stub.fetch(new Request(url, c.req.raw));
  } catch (error) {
    console.error('WebSocket error:', error);
    return c.json({ error: 'WebSocket connection failed' }, 500);
  }
});

// ==================== Tripcode ====================

/**
 * 生成 Tripcode
 */
app.post('/api/trip', rateLimit, async (c) => {
  try {
    const data = await c.req.json<{ password: string }>();

    if (!data.password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    // 改進的 Tripcode 生成（使用 SHA-256）
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data.password + 'trip-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const trip = hashHex.substring(0, 10);

    return c.json({
      success: true,
      trip
    });
  } catch (error) {
    console.error('Tripcode error:', error);
    return c.json({ error: 'Failed to generate tripcode' }, 500);
  }
});


// ==================== 統計 ====================

/**
 * 獲取公開統計
 */
app.get('/api/stats', async (c) => {
  try {
    const statsManager = new StatsManager(c.env.KV);
    const stats = await statsManager.getStats();

    return c.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

/**
 * 獲取熱門房間
 */
app.get('/api/rooms/popular', async (c) => {
  try {
    const statsManager = new StatsManager(c.env.KV);
    const limit = parseInt(c.req.query('limit') || '10');
    const rooms = await statsManager.getPopularRooms(limit);

    return c.json({ rooms });
  } catch (error) {
    console.error('Get popular rooms error:', error);
    return c.json({ error: 'Failed to get popular rooms' }, 500);
  }
});

// ==================== 頭像管理 ====================

/**
 * 上傳頭像
 */
app.post('/api/icons', checkBan, rateLimit, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('icon') as File;
    const name = formData.get('name') as string;

    if (!file || !name) {
      return c.json({ error: 'Missing file or name' }, 400);
    }

    // 驗證檔案類型
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400);
    }

    // 驗證檔案大小（max 100KB）
    if (file.size > 100 * 1024) {
      return c.json({ error: 'File too large (max 100KB)' }, 400);
    }

    // 將 File 轉換為 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 存入 R2
    const key = `icons/${Date.now()}_${name}`;
    await c.env.R2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    });

    return c.json({
      success: true,
      iconFilename: key
    });
  } catch (error) {
    console.error('Upload icon error:', error);
    return c.json({ error: 'Failed to upload icon' }, 500);
  }
});

/**
 * 獲取頭像
 */
app.get('/api/icons', async (c) => {
  try {
    const prefix = c.req.query('prefix') || 'icons/';
    const listed = await c.env.R2.list({ prefix });

    const icons = listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded
    }));

    return c.json({ icons });
  } catch (error) {
    console.error('List icons error:', error);
    return c.json({ error: 'Failed to list icons' }, 500);
  }
});

/**
 * 獲取頭像圖片
 */
app.get('/icons/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const object = await c.env.R2.get(`icons/${filename}`);

    if (!object) {
      return c.text('Not found', 404);
    }

    const headers = new Headers() as any;
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body as any, { headers });
  } catch (error) {
    console.error('Get icon error:', error);
    return c.text('Failed to get icon', 500);
  }
});

// ==================== Task 6: Version & Rule Summary APIs ====================

// GET /api/version
app.get('/api/version', async (c) => {
  return c.json({
    version: '1.0.0',
    buildDate: '2026-04-16',
    tech: 'Cloudflare Workers + Durable Objects + D1 + R2 + KV',
  });
});

// GET /api/rule-summary
app.get('/api/rule-summary', async (c) => {
  const roles = [
    { name: 'human', team: 'human', description: '一般村民，白天可發言和投票' },
    { name: 'mage', team: 'human', description: '預言家，夜晚可驗證一名玩家身分' },
    { name: 'guard', team: 'human', description: '守衛，夜晚可保護一名玩家免受攻擊' },
    { name: 'necromancer', team: 'human', description: '靈媒，白天可驗證死亡玩家的身分' },
    { name: 'authority', team: 'human', description: '權力者，投票權重為兩倍' },
    { name: 'common', team: 'human', description: '共有者，與另一名共有者共享資訊' },
    { name: 'lovers', team: 'human', description: '戀人，與另一名戀人同生共死' },
    { name: 'wolf', team: 'wolf', description: '狼人，夜晚可選擇一名玩家殺害' },
    { name: 'wolf_partner', team: 'wolf', description: '狼人同夥，與狼人共享殺人決定' },
    { name: 'wfbig', team: 'wolf', description: '大狼，擁有特殊能力的狼人' },
    { name: 'mad', team: 'wolf', description: '瘋子，歸類為狼人陣營' },
    { name: 'fox', team: 'fox', description: '妖狐，擁有特殊勝利條件' },
    { name: 'betr', team: 'fox', description: '背德者，歸類為妖狐陣營' },
    { name: 'fosi', team: 'fox', description: '妖狐相關角色' },
  ];

  return c.json({
    roles,
    phases: ['waiting', 'day', 'night'],
    winConditions: {
      human: '消滅所有狼人和妖狐',
      wolf: '狼人數量 ≥ 村民數量',
      fox: '妖狐存活且狼人全滅，妖狐數量 ≥ 村民數量',
    },
  });
});

// 掛載管理員路由
app.route('/', adminRoutes);

// 掛載新功能路由
app.route('/', featuresRoutes);

// 掛載 BBS 路由
app.route('/', bbsRoutes);

// 掛載 Trip 註冊/驗證路由
app.route('/', tripRoutes);

// ==================== 靜態檔案（catch-all，必須放在最後） ====================

/*
 * NOTE: This catch-all MUST be the last route registered. It serves as a fallback
 * for static assets (SPA). API routes (/api/*) and WebSocket (/ws/*) are handled
 * by specific routes above and will return notFound() if they reach here.
 * Do NOT move this above app.route() calls or parameterized routes.
 */
app.get('/*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // 跳過 API 和 WebSocket 請求（由其他路由處理）
  if (path.startsWith('/api') || path.startsWith('/ws')) {
    return c.notFound();
  }

  // 預設返回對應的靜態檔案
  try {
    const assetUrl = new URL(path, c.req.url);
    const asset = await c.env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (asset && asset.status !== 404) {
      return asset;
    }
  } catch (e) {
    // ignore
  }

  // 回退到 index.html（SPA routing）
  try {
    const indexUrl = new URL('/index.html', c.req.url);
    const index = await c.env.ASSETS.fetch(new Request(indexUrl.toString()));
    if (index && index.status !== 404) {
      return index;
    }
  } catch (e) {
    // ignore
  }

  return c.text('Frontend not deployed', 404);
});

export default app;
