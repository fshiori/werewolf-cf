/**
 * 房間路由
 */

import { Hono } from 'hono';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * 獲取所有房間列表
 */
app.get('/list', async (c) => {
  // TODO: 從 KV 或 D1 獲取房間列表
  return c.json({
    rooms: []
  });
});

/**
 * 獲取房間詳細資訊
 */
app.get('/:roomNo', async (c) => {
  const roomNo = c.req.param('roomNo');

  // TODO: 從 Durable Object 獲取房間資訊

  return c.json({
    roomNo
  });
});

/**
 * 刪除房間
 */
app.delete('/:roomNo', async (c) => {
  const roomNo = c.req.param('roomNo');

  // TODO: 刪除 Durable Object
  // TODO: 清理 KV session

  return c.json({
    success: true
  });
});

export default app;
