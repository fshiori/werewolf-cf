/**
 * Trip 註冊 / 驗證路由
 * 使用 KV 儲存已註冊的 tripcode
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateTripcode, hashPassword } from '../utils/crypto';

const app = new Hono<{ Bindings: Env }>();

/**
 * 註冊 Tripcode
 * POST /api/trip/register
 * Body: { password: string }
 * 回傳: { trip: string, registered: boolean }
 *   - registered: true  → 全新註冊
 *   - registered: false → 已存在（冪等）
 */
app.post('/api/trip/register', async (c) => {
  try {
    const { password } = await c.req.json<{ password?: string }>();

    if (!password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    // 用 generateTripcode 產生 trip 字串
    const trip = generateTripcode(password);
    const kvKey = `trip:${trip}`;

    // 檢查是否已註冊
    const existing = await c.env.KV.get(kvKey, 'json');

    if (existing) {
      // 已存在，冪等回傳
      return c.json({ trip, registered: false });
    }

    // 新註冊：雜湊密碼後存入 KV
    const passwordHash = await hashPassword(password);
    await c.env.KV.put(kvKey, JSON.stringify({
      passwordHash,
      createdAt: Date.now()
    }));

    return c.json({ trip, registered: true });
  } catch (error) {
    console.error('Trip register error:', error);
    return c.json({ error: 'Failed to register tripcode' }, 500);
  }
});

/**
 * 驗證 Tripcode
 * POST /api/trip/verify
 * Body: { password: string, trip: string }
 * 回傳: { valid: boolean }
 */
app.post('/api/trip/verify', async (c) => {
  try {
    const { password, trip } = await c.req.json<{ password?: string; trip?: string }>();

    if (!password || !trip) {
      return c.json({ error: 'Password and trip are required' }, 400);
    }

    // 確認 trip 格式是由 generateTripcode 產生的
    const expectedTrip = generateTripcode(password);
    if (expectedTrip !== trip) {
      return c.json({ valid: false });
    }

    // 查 KV 確認已註冊
    const kvKey = `trip:${trip}`;
    const stored = await c.env.KV.get(kvKey, 'json') as { passwordHash?: string } | null;

    if (!stored) {
      // trip 尚未註冊
      return c.json({ valid: false });
    }

    // 驗證密碼雜湊
    const inputHash = await hashPassword(password);
    return c.json({ valid: inputHash === stored.passwordHash });
  } catch (error) {
    console.error('Trip verify error:', error);
    return c.json({ error: 'Failed to verify tripcode' }, 500);
  }
});

export default app;
