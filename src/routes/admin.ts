/**
 * 管理員 API 路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { AdminManager } from '../utils/admin-manager';
import { BanManager, BAN_DURATIONS } from '../utils/ban-manager';
import { StatsManager } from '../utils/stats-manager';
import { adminRateLimiter } from '../utils/rate-limiter';
import { escapeHtml } from '../utils/security';

// Admin Session 類型
interface AdminSession {
  sessionId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

// 擴展 Hono 的 Variables
type AdminVariables = {
  adminSession: AdminSession;
};

const app = new Hono<{ Bindings: Env; Variables: AdminVariables }>();

// CORS
app.use('*', cors());

// 中間件：驗證管理員 Session
async function requireAdminAuth(c: any, next: any) {
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const adminManager = new AdminManager(c.env.KV);
  const session = await adminManager.getSession(sessionToken);

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // 將 session 附加到 context
  c.set('adminSession', session);
  await next();
}

// 中間件：速率限制
async function rateLimit(c: any, next: any) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  
  if (adminRateLimiter.isRateLimited(ip)) {
    const info = adminRateLimiter.getLimitInfo(ip);
    return c.json({
      error: 'Too many requests',
      retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000)
    }, 429);
  }

  await next();
}

// ==================== 管理員認證 ====================

/**
 * 調試端點：檢查 KV 值
 */
app.get('/api/admin/debug/kv', async (c) => {
  try {
    const adminManager = new AdminManager(c.env.KV);
    const data = await c.env.KV.get('admin:default', 'json');

    return c.json({
      exists: !!data,
      data: data,
      type: typeof data
    });
  } catch (error) {
    return c.json({
      error: String(error),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * 測試 Session 建立
 */
app.get('/api/admin/test/session', async (c) => {
  try {
    const { createAdminSession } = await import('../utils/admin-manager');
    const session = createAdminSession('admin');

    return c.json({
      success: true,
      session: session,
      hasSessionId: !!session.sessionId,
      hasUsername: !!session.username
    });
  } catch (error) {
    return c.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

/**
 * 管理員登入調試
 */
app.post('/api/admin/login/debug', async (c) => {
  try {
    const { username, password } = await c.req.json();

    // 讀取 KV 值
    const data = await c.env.KV.get('admin:default', 'json') as { passwordHash?: string; username?: string } | null;

    // 計算雜湊（直接實作）
    const ADMIN_SALT = 'werewolf-admin-salt-2026';
    const encoder = new TextEncoder();
    const data_bytes = encoder.encode(password + ADMIN_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data_bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return c.json({
      input: { username, password },
      kvData: data,
      inputHash: inputHash,
      storedHash: data?.passwordHash,
      usernameMatch: data?.username === username,
      hashMatch: data?.passwordHash === inputHash
    });
  } catch (error) {
    return c.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

/**
 * 管理員登入
 */
app.post('/api/admin/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    // 速率限制
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    if (adminRateLimiter.isRateLimited(ip)) {
      return c.json({ error: 'Too many login attempts' }, 429);
    }

    const adminManager = new AdminManager(c.env.KV);
    const valid = await adminManager.verifyAdminLogin(username, password);

    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // 建立 Session（使用獨立函數）
    const { createAdminSession } = await import('../utils/admin-manager');
    const session = createAdminSession(username);
    await adminManager.saveSession(session);

    return c.json({
      success: true,
      sessionId: session.sessionId,
      username: session.username
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

/**
 * 管理員登出
 */
app.post('/api/admin/logout', requireAdminAuth, async (c) => {
  try {
    const session = c.get('adminSession');
    const adminManager = new AdminManager(c.env.KV);
    
    await adminManager.logout(session.sessionId);

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Admin logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

/**
 * 驗證 Session
 */
app.get('/api/admin/verify', requireAdminAuth, async (c) => {
  const session = c.get('adminSession');
  
  return c.json({
    valid: true,
    username: session.username
  });
});

// ==================== 房間管理 ====================

/**
 * 獲取所有房間
 */
app.get('/api/admin/rooms', requireAdminAuth, rateLimit, async (c) => {
  try {
    const statsManager = new StatsManager(c.env.KV);
    const rooms = await statsManager.getRoomStats();

    return c.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return c.json({ error: 'Failed to get rooms' }, 500);
  }
});

/**
 * 刪除房間
 */
app.delete('/api/admin/rooms/:roomNo', requireAdminAuth, rateLimit, async (c) => {
  try {
    const roomNo = parseInt(c.req.param('roomNo'));
    
    // 通知 Durable Object 清理
    try {
      const id = c.env.WEREWOLF_ROOM.idFromName(roomNo.toString());
      const stub = c.env.WEREWOLF_ROOM.get(id);
      const response = await stub.fetch(new Request('https://internal/cleanup', { method: 'POST' }));
      if (!response.ok) {
        // DO 清理失敗，直接清理 D1
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
      }
    } catch (e) {
      // DO 不存在或喚醒失敗，直接清理 D1
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
    }

    // 清理 KV 統計
    const statsManager = new StatsManager(c.env.KV);
    await statsManager.deleteRoomStats(roomNo);

    return c.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    return c.json({ error: 'Failed to delete room' }, 500);
  }
});

// ==================== 玩家管理 ====================

/**
 * 踢出玩家
 */
app.post('/api/admin/rooms/:roomNo/kick', requireAdminAuth, rateLimit, async (c) => {
  try {
    const roomNo = parseInt(c.req.param('roomNo'));
    const { uname, reason } = await c.req.json();

    if (!uname) {
      return c.json({ error: 'Username required' }, 400);
    }

    // TODO: 通知 Durable Object 踢出玩家
    // 目前只能記錄
    
    return c.json({
      success: true,
      message: `Player ${escapeHtml(uname)} kicked`,
      reason: reason || 'No reason provided'
    });
  } catch (error) {
    console.error('Kick player error:', error);
    return c.json({ error: 'Failed to kick player' }, 500);
  }
});

// ==================== 封鎖管理 ====================

/**
 * 獲取所有封鎖
 */
app.get('/api/admin/bans', requireAdminAuth, rateLimit, async (c) => {
  try {
    const banManager = new BanManager(c.env.KV);
    const bans = await banManager.getAllBans();

    return c.json({ bans });
  } catch (error) {
    console.error('Get bans error:', error);
    return c.json({ error: 'Failed to get bans' }, 500);
  }
});

/**
 * 封鎖 IP
 */
app.post('/api/admin/bans', requireAdminAuth, rateLimit, async (c) => {
  try {
    const { ip, type, reason, duration } = await c.req.json();

    if (!ip || !type || !reason) {
      return c.json({ error: 'IP, type, and reason required' }, 400);
    }

    const banManager = new BanManager(c.env.KV);
    const session = c.get('adminSession');

    if (type === 'temporary') {
      if (!duration) {
        return c.json({ error: 'Duration required for temporary bans' }, 400);
      }
      await banManager.banTemporary(ip, reason, duration, session.username);
    } else if (type === 'permanent') {
      await banManager.banPermanent(ip, reason, session.username);
    } else {
      return c.json({ error: 'Invalid ban type' }, 400);
    }

    return c.json({ success: true, message: 'IP banned successfully' });
  } catch (error) {
    console.error('Ban IP error:', error);
    return c.json({ error: 'Failed to ban IP' }, 500);
  }
});

/**
 * 解封 IP
 */
app.delete('/api/admin/bans/:ip', requireAdminAuth, rateLimit, async (c) => {
  try {
    const ip = c.req.param('ip');
    
    const banManager = new BanManager(c.env.KV);
    await banManager.unban(ip);

    return c.json({ success: true, message: 'IP unbanned successfully' });
  } catch (error) {
    console.error('Unban IP error:', error);
    return c.json({ error: 'Failed to unban IP' }, 500);
  }
});

/**
 * 獲取封鎖統計
 */
app.get('/api/admin/bans/stats', requireAdminAuth, async (c) => {
  try {
    const banManager = new BanManager(c.env.KV);
    const stats = await banManager.getBanStats();

    return c.json({ stats });
  } catch (error) {
    console.error('Get ban stats error:', error);
    return c.json({ error: 'Failed to get ban stats' }, 500);
  }
});

// ==================== 統計 ====================

/**
 * 獲取全局統計
 */
app.get('/api/admin/stats', requireAdminAuth, async (c) => {
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
 * 重置統計
 */
app.post('/api/admin/stats/reset', requireAdminAuth, rateLimit, async (c) => {
  try {
    const statsManager = new StatsManager(c.env.KV);
    await statsManager.resetStats();

    return c.json({ success: true, message: 'Stats reset successfully' });
  } catch (error) {
    console.error('Reset stats error:', error);
    return c.json({ error: 'Failed to reset stats' }, 500);
  }
});

export default app;
