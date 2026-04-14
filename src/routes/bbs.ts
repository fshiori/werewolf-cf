/**
 * BBS 討論板 API 路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { escapeHtml } from '../utils/security';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors());

// ==================== 討論串 ====================

/**
 * 獲取討論串列表
 */
app.get('/api/bbs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '30');
    const offset = parseInt(c.req.query('offset') || '0');

    const stmt = c.env.DB.prepare(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM bbs_replies WHERE thread_id = t.id) as actual_reply_count
       FROM bbs_threads t
       ORDER BY t.is_pinned DESC, t.updated_at DESC
       LIMIT ? OFFSET ?`
    );
    const result = await stmt.bind(limit, offset).all();

    // 總數
    const countStmt = c.env.DB.prepare('SELECT COUNT(*) as total FROM bbs_threads');
    const countResult = await countStmt.all();
    const total = (countResult.results[0] as { total?: number } | undefined)?.total || 0;

    return c.json({
      threads: result.results,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get BBS threads error:', error);
    return c.json({ error: 'Failed to get threads' }, 500);
  }
});

/**
 * 建立新討論串
 */
app.post('/api/bbs', async (c) => {
  try {
    const data = await c.req.json<{
      title: string;
      authorName: string;
      authorTrip?: string;
      content: string;
    }>();

    if (!data.title || !data.authorName || !data.content) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (data.title.length > 100) {
      return c.json({ error: 'Title too long (max 100 chars)' }, 400);
    }

    if (data.content.length > 2000) {
      return c.json({ error: 'Content too long (max 2000 chars)' }, 400);
    }

    const safeTitle = escapeHtml(data.title);
    const safeName = escapeHtml(data.authorName);
    const safeContent = escapeHtml(data.content);
    const now = Date.now();

    const stmt = c.env.DB.prepare(`
      INSERT INTO bbs_threads (title, author_trip, author_name, content, is_pinned, is_locked, reply_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)
    `);

    await stmt.bind(
      safeTitle,
      data.authorTrip || '',
      safeName,
      safeContent,
      now,
      now
    ).all();

    return c.json({ success: true, message: 'Thread created' });
  } catch (error) {
    console.error('Create BBS thread error:', error);
    return c.json({ error: 'Failed to create thread' }, 500);
  }
});

/**
 * 獲取單一討論串（含回覆）
 */
app.get('/api/bbs/:threadId', async (c) => {
  try {
    const threadId = c.req.param('threadId');

    // 取得主文
    const threadStmt = c.env.DB.prepare('SELECT * FROM bbs_threads WHERE id = ?');
    const threadResult = await threadStmt.bind(threadId).all();

    if (threadResult.results.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    // 取得回覆
    const repliesStmt = c.env.DB.prepare(
      'SELECT * FROM bbs_replies WHERE thread_id = ? ORDER BY created_at ASC'
    );
    const repliesResult = await repliesStmt.bind(threadId).all();

    return c.json({
      thread: threadResult.results[0],
      replies: repliesResult.results
    });
  } catch (error) {
    console.error('Get BBS thread error:', error);
    return c.json({ error: 'Failed to get thread' }, 500);
  }
});

/**
 * 回覆討論串
 */
app.post('/api/bbs/:threadId/reply', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const data = await c.req.json<{
      authorName: string;
      authorTrip?: string;
      content: string;
    }>();

    if (!data.authorName || !data.content) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (data.content.length > 2000) {
      return c.json({ error: 'Content too long (max 2000 chars)' }, 400);
    }

    // 檢查是否鎖定
    const lockStmt = c.env.DB.prepare('SELECT is_locked FROM bbs_threads WHERE id = ?');
    const lockResult = await lockStmt.bind(threadId).all();
    if (lockResult.results.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }
    if ((lockResult.results[0] as { is_locked?: number })?.is_locked === 1) {
      return c.json({ error: 'Thread is locked' }, 403);
    }

    const safeName = escapeHtml(data.authorName);
    const safeContent = escapeHtml(data.content);
    const now = Date.now();

    // 插入回覆
    const replyStmt = c.env.DB.prepare(`
      INSERT INTO bbs_replies (thread_id, author_trip, author_name, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    await replyStmt.bind(threadId, data.authorTrip || '', safeName, safeContent, now).all();

    // 更新討論串的 reply_count 和 updated_at
    const updateStmt = c.env.DB.prepare(`
      UPDATE bbs_threads 
      SET reply_count = reply_count + 1, updated_at = ?
      WHERE id = ?
    `);
    await updateStmt.bind(now, threadId).all();

    return c.json({ success: true, message: 'Reply posted' });
  } catch (error) {
    console.error('Reply BBS thread error:', error);
    return c.json({ error: 'Failed to post reply' }, 500);
  }
});

/**
 * 鎖定/解鎖討論串（管理員用）
 */
app.post('/api/bbs/:threadId/lock', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const data = await c.req.json<{ locked: boolean }>();

    const stmt = c.env.DB.prepare(
      'UPDATE bbs_threads SET is_locked = ? WHERE id = ?'
    );
    await stmt.bind(data.locked ? 1 : 0, threadId).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Lock BBS thread error:', error);
    return c.json({ error: 'Failed to lock thread' }, 500);
  }
});

/**
 * 置頂/取消置頂討論串（管理員用）
 */
app.post('/api/bbs/:threadId/pin', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const data = await c.req.json<{ pinned: boolean }>();

    const stmt = c.env.DB.prepare(
      'UPDATE bbs_threads SET is_pinned = ? WHERE id = ?'
    );
    await stmt.bind(data.pinned ? 1 : 0, threadId).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Pin BBS thread error:', error);
    return c.json({ error: 'Failed to pin thread' }, 500);
  }
});

/**
 * 刪除討論串（管理員用）
 */
app.delete('/api/bbs/:threadId', async (c) => {
  try {
    const threadId = c.req.param('threadId');

    // 先刪回覆
    await c.env.DB.prepare('DELETE FROM bbs_replies WHERE thread_id = ?').bind(threadId).all();
    // 再刪主文
    await c.env.DB.prepare('DELETE FROM bbs_threads WHERE id = ?').bind(threadId).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete BBS thread error:', error);
    return c.json({ error: 'Failed to delete thread' }, 500);
  }
});

export default app;
