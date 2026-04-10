/**
 * 完整 API 路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { hc } from 'hono/client';
import type { Env } from '../types';
import { createSessionManager } from '../utils/session-manager';

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

// ==================== 房間管理 ====================

/**
 * 建立新房間
 */
app.post('/api/rooms', async (c) => {
  try {
    const data = await c.req.json<{
      roomName: string;
      roomComment?: string;
      maxUser?: number;
      gameOption?: string;
      optionRole?: string;
    }>();

    // 驗證
    if (!data.roomName || data.roomName.length > 32) {
      return c.json({ error: 'Invalid room name' }, 400);
    }

    const maxUser = data.maxUser || 16;
    if (maxUser < 2 || maxUser > 32) {
      return c.json({ error: 'Invalid max user count' }, 400);
    }

    // 生成房間編號
    const roomNo = Date.now();

    // 建立 Durable Object
    const id = c.env.ROOM.idFromName(roomNo.toString());
    const stub = c.env.ROOM.get(id);

    // 初始化
    await stub.fetch(new Request('https://dummy/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomNo,
        roomName: data.roomName,
        roomComment: data.roomComment || '',
        maxUser,
        gameOption: data.gameOption || '',
        optionRole: data.optionRole || ''
      })
    }));

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
 * 獲取房間資訊
 */
app.get('/api/rooms/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const id = c.env.ROOM.idFromName(roomNo);
    const stub = c.env.ROOM.get(id);

    const response = await stub.fetch(
      new Request('https://dummy/info')
    );

    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.error('Get room error:', error);
    return c.json({ error: 'Room not found' }, 404);
  }
});

/**
 * 刪除房間
 */
app.delete('/api/rooms/:roomNo', async (c) => {
  // TODO: 實作刪除邏輯
  return c.json({ success: true, message: 'Room deleted' });
});

// ==================== 玩家管理 ====================

/**
 * 玩家加入房間
 */
app.post('/api/rooms/:roomNo/join', async (c) => {
  try {
    const roomNo = parseInt(c.req.param('roomNo'));
    const data = await c.req.json<{
      uname: string;
      handleName: string;
      trip: string;
      iconNo: number;
      sex: string;
    }>();

    // 驗證
    if (!data.uname || data.uname.length < 1 || data.uname.length > 20) {
      return c.json({ error: 'Invalid username' }, 400);
    }

    if (!data.handleName || data.handleName.length > 32) {
      return c.json({ error: 'Invalid display name' }, 400);
    }

    // 生成 session
    const sessionManager = createSessionManager(c.env.KV);
    const { sessionId, session } = createSession(
      data.uname,
      roomNo,
      0, // userNo will be assigned
      data.handleName,
      'human', // role will be assigned
      3600
    );

    // 儲存 session
    await sessionManager.save(session);

    // TODO: 加入玩家到 Durable Object

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

    const id = c.env.ROOM.idFromName(roomNo);
    const stub = c.env.ROOM.get(id);

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
app.post('/api/trip', async (c) => {
  try {
    const data = await c.req.json<{ password: string }>();

    if (!data.password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    // TODO: 實作真實的 tripcode 生成
    const trip = btoa(data.password).substring(0, 8);

    return c.json({
      success: true,
      trip
    });
  } catch (error) {
    console.error('Tripcode error:', error);
    return c.json({ error: 'Failed to generate tripcode' }, 500);
  }
});

// ==================== 頭像管理 ====================

/**
 * 上傳頭像
 */
app.post('/api/icons', async (c) => {
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

    // 存入 R2
    const key = `icons/${Date.now()}_${name}`;
    await c.env.R2.put(key, file);

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

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Get icon error:', error);
    return c.text('Failed to get icon', 500);
  }
});

// ==================== 靜態檔案 ====================

/**
 * 服務靜態檔案
 */
app.get('/*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // 如果是 API 請求，返回 404
  if (path.startsWith('/api') || path.startsWith('/ws')) {
    return c.text('Not found', 404);
  }

  // 預設返回 index.html（SPA）
  try {
    const asset = await c.env.ASSETS.fetch(new Request(path));
    if (asset) {
      return asset;
    }
  } catch (e) {
    // ignore
  }

  // 回退到 index.html
  try {
    const index = await c.env.ASSETS.fetch(new Request('/index.html'));
    if (index) {
      return index;
    }
  } catch (e) {
    // ignore
  }

  return c.text('Frontend not deployed', 404);
});

export default app;
