/**
 * Cloudflare Workers 主入口
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { Room } from './room';

const app = new Hono<{ Bindings: Env }>();

// CORS 設定
app.use('*', cors());

// 健康檢查
app.get('/', (c) => {
  return c.json({
    name: 'Werewolf CF',
    version: '1.0.0',
    status: 'ok',
    environment: c.env.ENVIRONMENT
  });
});

// ====================
// 房間管理 API
// ====================

/**
 * 建立新房間
 */
app.post('/api/rooms', async (c) => {
  const data = await c.req.json<{
    roomName: string;
    roomComment: string;
    maxUser: number;
    gameOption: string;
    optionRole: string;
  }>();

  // 生成房間編號
  const roomNo = Date.now();

  // 建立 Durable Object
  const id = c.env.ROOM.idFromName(roomNo.toString());
  const stub = c.env.ROOM.get(id);

  // 初始化房間
  await stub.fetch(new Request('https://dummy/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomNo,
      roomName: data.roomName,
      roomComment: data.roomComment,
      maxUser: data.maxUser,
      gameOption: data.gameOption,
      optionRole: data.optionRole
    })
  }));

  return c.json({
    success: true,
    roomNo
  });
});

/**
 * 獲取房間資訊
 */
app.get('/api/rooms/:roomNo', async (c) => {
  const roomNo = c.req.param('roomNo');
  const id = c.env.ROOM.idFromName(roomNo);
  const stub = c.env.ROOM.get(id);

  const response = await stub.fetch(
    new Request(`https://dummy/info`)
  );

  const data = await response.json();

  return c.json(data);
});

/**
 * WebSocket 連線
 */
app.get('/ws/:roomNo', async (c) => {
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
});

// ====================
// 玩家管理 API
// ====================

/**
 * 玩家加入房間
 */
app.post('/api/rooms/:roomNo/join', async (c) => {
  const roomNo = c.req.param('roomNo');
  const data = await c.req.json<{
    uname: string;
    handleName: string;
    trip: string;
    iconNo: number;
    sex: string;
  }>();

  // TODO: 驗證 tripcode
  // TODO: 檢查房間人數
  // TODO: 分配角色

  // 生成 session token
  const sessionToken = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  // 存入 KV
  await c.env.KV.put(`session:${sessionToken}`, JSON.stringify({
    uname: data.uname,
    roomNo: parseInt(roomNo),
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000 // 1 小時
  }), {
    expirationTtl: 3600
  });

  // TODO: 加入玩家到 Durable Object

  return c.json({
    success: true,
    sessionToken
  });
});

/**
 * 玩家離開房間
 */
app.post('/api/rooms/:roomNo/leave', async (c) => {
  const roomNo = c.req.param('roomNo');
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionToken) {
    return c.json({ error: 'Missing session token' }, 401);
  }

  // TODO: 從 Durable Object 移除玩家
  // TODO: 刪除 KV session

  return c.json({ success: true });
});

// ====================
// 頭像管理 API
// ====================

/**
 * 上傳頭像
 */
app.post('/api/icons', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('icon') as File;
  const name = formData.get('name') as string;

  if (!file || !name) {
    return c.json({ error: 'Missing file or name' }, 400);
  }

  // 存入 R2
  const key = `icons/${Date.now()}_${name}`;
  await c.env.R2.put(key, file);

  return c.json({
    success: true,
    iconFilename: key
  });
});

/**
 * 獲取頭像列表
 */
app.get('/api/icons', async (c) => {
  const listed = await c.env.R2.list({ prefix: 'icons/' });

  const icons = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded
  }));

  return c.json({ icons });
});

// ====================
// Tripcode API
// ====================

/**
 * 生成 Tripcode
 */
app.post('/api/trip', async (c) => {
  const data = await c.req.json<{
    password: string;
  }>();

  // TODO: 實作真實的 tripcode 生成邏輯
  const trip = btoa(data.password).substring(0, 8);

  return c.json({
    success: true,
    trip
  });
});

// ====================
// 匯出 Worker
// ====================
export default {
  fetch: app.fetch,
};

// 匯出 Durable Object
export { Room };
