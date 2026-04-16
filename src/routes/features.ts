/**
 * 新增功能的 API 路由
 * 包含：遊戲記錄、投票統計、個人統計、房間密碼、觀戰模式、黑白名單、NG用戶
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';
import { escapeHtml } from '../utils/security';
import { apiRateLimiter } from '../utils/rate-limiter';
import { canWhisper } from '../utils/whisper-manager';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors());

// ==================== 遊戲記錄/記者報導 ====================

/**
 * 建立遊戲記錄（遊戲結束時調用）
 */
app.post('/api/game-logs', async (c) => {
  try {
    const data = await c.req.json<{
      roomNo: number;
      roomName: string;
      winner: string;
      totalDays: number;
      playerCount: number;
      roles: string;
      deathOrder?: string;
      keyEvents?: string;
    }>();

    // 驗證
    if (!data.roomNo || !data.roomName || !data.winner) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const stmt = c.env.DB.prepare(`
      INSERT INTO game_logs (
        room_no, room_name, winner, total_days, player_count,
        roles, death_order, key_events, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_no) DO UPDATE SET
        winner = ?,
        total_days = ?,
        death_order = ?,
        key_events = ?
    `);

    await stmt.bind(
      data.roomNo,
      data.roomName,
      data.winner,
      data.totalDays,
      data.playerCount,
      data.roles,
      data.deathOrder || '',
      data.keyEvents || '',
      Date.now(),
      data.winner,
      data.totalDays,
      data.deathOrder || '',
      data.keyEvents || ''
    ).all();

    return c.json({ success: true, message: 'Game log created' });
  } catch (error) {
    console.error('Create game log error:', error);
    return c.json({ error: 'Failed to create game log' }, 500);
  }
});

/**
 * 獲取遊戲記錄列表
 */
app.get('/api/game-logs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const winner = c.req.query('winner');

    let query = 'SELECT * FROM game_logs';
    const params: any[] = [];

    if (winner) {
      query += ' WHERE winner = ?';
      params.push(winner);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json({
      logs: result.results,
      count: result.results.length
    });
  } catch (error) {
    console.error('Get game logs error:', error);
    return c.json({ error: 'Failed to get game logs' }, 500);
  }
});

/**
 * 獲取單一遊戲記錄
 */
app.get('/api/game-logs/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const stmt = c.env.DB.prepare('SELECT * FROM game_logs WHERE room_no = ?');
    const result = await stmt.bind(roomNo).all();

    if (result.results.length === 0) {
      return c.json({ error: 'Game log not found' }, 404);
    }

    return c.json(result.results[0]);
  } catch (error) {
    console.error('Get game log error:', error);
    return c.json({ error: 'Failed to get game log' }, 500);
  }
});

// ==================== 投票統計 ====================

/**
 * 記錄投票（詳細版）
 */
app.post('/api/vote-history', async (c) => {
  try {
    const data = await c.req.json<{
      roomNo: number;
      date: number;
      voterUname: string;
      targetUname: string;
      voteType?: string;
    }>();

    const stmt = c.env.DB.prepare(`
      INSERT INTO vote_history (
        room_no, date, voter_uname, target_uname, vote_type, time
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      data.roomNo,
      data.date,
      data.voterUname,
      data.targetUname,
      data.voteType || 'normal',
      Date.now()
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Record vote error:', error);
    return c.json({ error: 'Failed to record vote' }, 500);
  }
});

/**
 * 獲取房間投票歷史
 */
app.get('/api/vote-history/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const date = c.req.query('date');

    let query = 'SELECT * FROM vote_history WHERE room_no = ?';
    const params: any[] = [roomNo];

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY date ASC, time ASC';

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json({ votes: result.results });
  } catch (error) {
    console.error('Get vote history error:', error);
    return c.json({ error: 'Failed to get vote history' }, 500);
  }
});

// ==================== 個人統計 ====================

/**
 * 獲取 Tripcode 統計
 */
app.get('/api/stats/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');

    const stmt = c.env.DB.prepare('SELECT * FROM trip_scores WHERE trip = ?');
    const result = await stmt.bind(trip).all();

    if (result.results.length === 0) {
      return c.json({
        trip,
        totalGames: 0,
        humanWins: 0,
        wolfWins: 0,
        foxWins: 0,
        score: 0
      });
    }

    const stats = result.results[0] as { role_history?: string };

    // 解析 role_history JSON
    let roleHistory: Record<string, number> = {};
    if (stats.role_history) {
      try {
        roleHistory = JSON.parse(stats.role_history) as Record<string, number>;
      } catch (e) {
        // ignore
      }
    }

    return c.json({
      ...stats,
      roleHistory
    });
  } catch (error) {
    console.error('Get trip stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

/**
 * 更新 Tripcode 統計（遊戲結束時調用）
 */
app.post('/api/stats/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const data = await c.req.json<{
      result: 'human_win' | 'wolf_win' | 'fox_win' | 'lose';
      role: string;
      survived: boolean;
    }>();

    // 獲取現有統計
    const stmt = c.env.DB.prepare('SELECT * FROM trip_scores WHERE trip = ?');
    const result = await stmt.bind(trip).all();

    interface TripStats {
      trip: string;
      score: number;
      games_played: number;
      human_wins: number;
      wolf_wins: number;
      fox_wins: number;
      total_games: number;
      survivor_count: number;
      role_history: string;
      last_played: number;
    }

    const existingStats = result.results[0] as unknown as TripStats | undefined;

    let stats: TripStats = existingStats || {
      trip,
      score: 0,
      games_played: 0,
      human_wins: 0,
      wolf_wins: 0,
      fox_wins: 0,
      total_games: 0,
      survivor_count: 0,
      role_history: '{}',
      last_played: Date.now()
    };

    // 解析 role_history
    let roleHistory: Record<string, number> = {};
    try {
      roleHistory = JSON.parse(stats.role_history || '{}') as Record<string, number>;
    } catch (e) {
      roleHistory = {};
    }

    // 更新統計
    stats.games_played = (stats.games_played || 0) + 1;
    stats.total_games = (stats.total_games || 0) + 1;

    if (data.result === 'human_win') {
      stats.human_wins = (stats.human_wins || 0) + 1;
      stats.score = (stats.score || 0) + 10;
    } else if (data.result === 'wolf_win') {
      stats.wolf_wins = (stats.wolf_wins || 0) + 1;
      stats.score = (stats.score || 0) + 15;
    } else if (data.result === 'fox_win') {
      stats.fox_wins = (stats.fox_wins || 0) + 1;
      stats.score = (stats.score || 0) + 20;
    }

    if (data.survived) {
      stats.survivor_count = (stats.survivor_count || 0) + 1;
      stats.score = (stats.score || 0) + 5;
    }

    // 更新角色歷史
    if (data.role) {
      roleHistory[data.role] = (roleHistory[data.role] || 0) + 1;
      stats.role_history = JSON.stringify(roleHistory);
    }
    stats.last_played = Date.now();

    // UPSERT
    const upsertStmt = c.env.DB.prepare(`
      INSERT INTO trip_scores (
        trip, score, games_played, human_wins, wolf_wins, fox_wins,
        total_games, survivor_count, role_history, last_played
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trip) DO UPDATE SET
        score = ?,
        games_played = ?,
        human_wins = ?,
        wolf_wins = ?,
        fox_wins = ?,
        total_games = ?,
        survivor_count = ?,
        role_history = ?,
        last_played = ?
    `);

    await upsertStmt.bind(
      trip, stats.score, stats.games_played, stats.human_wins,
      stats.wolf_wins, stats.fox_wins, stats.total_games,
      stats.survivor_count, stats.role_history, stats.last_played,
      stats.score, stats.games_played, stats.human_wins,
      stats.wolf_wins, stats.fox_wins, stats.total_games,
      stats.survivor_count, stats.role_history, stats.last_played
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Update trip stats error:', error);
    return c.json({ error: 'Failed to update stats' }, 500);
  }
});

/**
 * 獲取排行榜
 */
app.get('/api/leaderboard', async (c) => {
  try {
    const type = c.req.query('type') || 'score'; // score, games, wins
    const limit = parseInt(c.req.query('limit') || '50');

    let orderBy = 'score DESC';
    if (type === 'games') {
      orderBy = 'total_games DESC';
    } else if (type === 'wins') {
      orderBy = '(human_wins + wolf_wins + fox_wins) DESC';
    }

    const stmt = c.env.DB.prepare(`
      SELECT * FROM trip_scores
      ORDER BY ${orderBy}
      LIMIT ?
    `);

    const result = await stmt.bind(limit).all();

    return c.json({ leaderboard: result.results });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return c.json({ error: 'Failed to get leaderboard' }, 500);
  }
});

// ==================== 黑白名單 ====================

/**
 * 新增黑名單
 */
app.post('/api/blacklist', async (c) => {
  try {
    const data = await c.req.json<{
      trip: string;
      reason?: string;
      createdBy: string;
    }>();

    const stmt = c.env.DB.prepare(`
      INSERT INTO user_blacklist (trip, reason, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(
      data.trip,
      data.reason || '',
      data.createdBy,
      Date.now()
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Add blacklist error:', error);
    return c.json({ error: 'Failed to add blacklist' }, 500);
  }
});

/**
 * 檢查是否在黑名單
 */
app.get('/api/blacklist/check/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const stmt = c.env.DB.prepare('SELECT * FROM user_blacklist WHERE trip = ?');
    const result = await stmt.bind(trip).all();

    return c.json({
      blacklisted: result.results.length > 0,
      info: result.results[0] || null
    });
  } catch (error) {
    console.error('Check blacklist error:', error);
    return c.json({ error: 'Failed to check blacklist' }, 500);
  }
});

/**
 * 獲取黑名單列表
 */
app.get('/api/blacklist', async (c) => {
  try {
    const stmt = c.env.DB.prepare('SELECT * FROM user_blacklist ORDER BY created_at DESC');
    const result = await stmt.all();

    return c.json({ blacklist: result.results });
  } catch (error) {
    console.error('Get blacklist error:', error);
    return c.json({ error: 'Failed to get blacklist' }, 500);
  }
});

/**
 * 刪除黑名單
 */
app.delete('/api/blacklist/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const stmt = c.env.DB.prepare('DELETE FROM user_blacklist WHERE id = ?');
    await stmt.bind(id).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete blacklist error:', error);
    return c.json({ error: 'Failed to delete blacklist' }, 500);
  }
});

/**
 * 新增白名單
 */
app.post('/api/whitelist', async (c) => {
  try {
    const data = await c.req.json<{
      trip: string;
      trustLevel?: number;
      notes?: string;
    }>();

    const stmt = c.env.DB.prepare(`
      INSERT INTO user_whitelist (trip, trust_level, notes, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(trip) DO UPDATE SET
        trust_level = ?,
        notes = ?
    `);

    await stmt.bind(
      data.trip,
      data.trustLevel || 0,
      data.notes || '',
      Date.now(),
      data.trustLevel || 0,
      data.notes || ''
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Add whitelist error:', error);
    return c.json({ error: 'Failed to add whitelist' }, 500);
  }
});

/**
 * 檢查是否在白名單
 */
app.get('/api/whitelist/check/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const stmt = c.env.DB.prepare('SELECT * FROM user_whitelist WHERE trip = ?');
    const result = await stmt.bind(trip).all();

    return c.json({
      whitelisted: result.results.length > 0,
      info: result.results[0] || null
    });
  } catch (error) {
    console.error('Check whitelist error:', error);
    return c.json({ error: 'Failed to check whitelist' }, 500);
  }
});

/**
 * 獲取白名單列表
 */
app.get('/api/whitelist', async (c) => {
  try {
    const stmt = c.env.DB.prepare('SELECT * FROM user_whitelist ORDER BY trust_level DESC');
    const result = await stmt.all();

    return c.json({ whitelist: result.results });
  } catch (error) {
    console.error('Get whitelist error:', error);
    return c.json({ error: 'Failed to get whitelist' }, 500);
  }
});

// ==================== NG 用戶 ====================

/**
 * 新增 NG 用戶
 */
app.post('/api/ng-users', async (c) => {
  try {
    const data = await c.req.json<{
      trip: string;
      ngTrip: string;
      reason?: string;
    }>();

    const stmt = c.env.DB.prepare(`
      INSERT INTO ng_users (trip, ng_trip, reason, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(
      data.trip,
      data.ngTrip,
      data.reason || '',
      Date.now()
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Add NG user error:', error);
    return c.json({ error: 'Failed to add NG user' }, 500);
  }
});

/**
 * 獲取 NG 用戶列表
 */
app.get('/api/ng-users/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const stmt = c.env.DB.prepare('SELECT * FROM ng_users WHERE trip = ?');
    const result = await stmt.bind(trip).all();

    return c.json({ ngUsers: result.results });
  } catch (error) {
    console.error('Get NG users error:', error);
    return c.json({ error: 'Failed to get NG users' }, 500);
  }
});

/**
 * 檢查是否為 NG 用戶
 */
app.get('/api/ng-users/check/:trip/:targetTrip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const targetTrip = c.req.param('targetTrip');

    const stmt = c.env.DB.prepare('SELECT * FROM ng_users WHERE trip = ? AND ng_trip = ?');
    const result = await stmt.bind(trip, targetTrip).all();

    return c.json({
      isNg: result.results.length > 0,
      reason: result.results[0]?.reason || null
    });
  } catch (error) {
    console.error('Check NG user error:', error);
    return c.json({ error: 'Failed to check NG user' }, 500);
  }
});

/**
 * 刪除 NG 用戶
 */
app.delete('/api/ng-users/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const stmt = c.env.DB.prepare('DELETE FROM ng_users WHERE id = ?');
    await stmt.bind(id).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete NG user error:', error);
    return c.json({ error: 'Failed to delete NG user' }, 500);
  }
});

// ==================== 觀戰模式 ====================

/**
 * 加入觀戰
 */
app.post('/api/spectate/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const data = await c.req.json<{
      trip: string;
      handleName: string;
    }>();

    // 檢查觀戰人數限制
    const countStmt = c.env.DB.prepare('SELECT COUNT(*) as count FROM spectators WHERE room_no = ?');
    const countResult = await countStmt.bind(roomNo).all();
    const spectatorCount = (countResult.results[0] as { count?: number } | undefined)?.count || 0;

    // 獲取設定
    const settingStmt = c.env.DB.prepare("SELECT setting_value FROM game_settings WHERE setting_name = 'max_spectators'");
    const settingResult = await settingStmt.all();
    const maxSpectators = parseInt((settingResult.results[0] as { setting_value?: string } | undefined)?.setting_value || '10');

    if (spectatorCount >= maxSpectators) {
      return c.json({ error: 'Spectator limit reached' }, 403);
    }

    // 加入觀戰
    const stmt = c.env.DB.prepare(`
      INSERT INTO spectators (room_no, trip, handle_name, joined_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_no, trip) DO UPDATE SET
        handle_name = ?,
        joined_at = ?
    `);

    await stmt.bind(
      roomNo,
      data.trip,
      data.handleName,
      Date.now(),
      data.handleName,
      Date.now()
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Join spectate error:', error);
    return c.json({ error: 'Failed to join spectate' }, 500);
  }
});

/**
 * 離開觀戰
 */
app.delete('/api/spectate/:roomNo/:trip', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const trip = c.req.param('trip');

    const stmt = c.env.DB.prepare('DELETE FROM spectators WHERE room_no = ? AND trip = ?');
    await stmt.bind(roomNo, trip).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Leave spectate error:', error);
    return c.json({ error: 'Failed to leave spectate' }, 500);
  }
});

/**
 * 獲取觀戰列表
 */
app.get('/api/spectate/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const stmt = c.env.DB.prepare('SELECT * FROM spectators WHERE room_no = ? ORDER BY joined_at ASC');
    const result = await stmt.bind(roomNo).all();

    return c.json({ spectators: result.results });
  } catch (error) {
    console.error('Get spectators error:', error);
    return c.json({ error: 'Failed to get spectators' }, 500);
  }
});

// ==================== 遺書系統 ====================

/**
 * 儲存遺書（玩家死亡前留訊息）
 */
app.post('/api/wills', async (c) => {
  try {
    const data = await c.req.json<{
      roomNo: number;
      date: number;
      uname: string;
      handleName: string;
      will: string;
    }>();

    if (!data.roomNo || !data.uname || !data.will) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (data.will.length > 500) {
      return c.json({ error: 'Will too long (max 500 chars)' }, 400);
    }

    const safeWill = escapeHtml(data.will);

    const stmt = c.env.DB.prepare(`
      INSERT INTO wills (room_no, date, uname, handle_name, will, time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      data.roomNo,
      data.date,
      data.uname,
      data.handleName || data.uname,
      safeWill,
      Date.now()
    ).all();

    return c.json({ success: true, message: 'Will saved' });
  } catch (error) {
    console.error('Save will error:', error);
    return c.json({ error: 'Failed to save will' }, 500);
  }
});

/**
 * 獲取房間的所有遺書
 */
app.get('/api/wills/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const stmt = c.env.DB.prepare(
      'SELECT * FROM wills WHERE room_no = ? ORDER BY date ASC, time ASC'
    );
    const result = await stmt.bind(roomNo).all();

    return c.json({ wills: result.results });
  } catch (error) {
    console.error('Get wills error:', error);
    return c.json({ error: 'Failed to get wills' }, 500);
  }
});

/**
 * 獲取特定日期的遺書
 */
app.get('/api/wills/:roomNo/:date', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const date = c.req.param('date');
    const stmt = c.env.DB.prepare(
      'SELECT * FROM wills WHERE room_no = ? AND date = ? ORDER BY time ASC'
    );
    const result = await stmt.bind(roomNo, date).all();

    return c.json({ wills: result.results });
  } catch (error) {
    console.error('Get wills by date error:', error);
    return c.json({ error: 'Failed to get wills' }, 500);
  }
});

// ==================== 密語系統 ====================

/**
 * 傳送密語（夜晚特定角色可密語）
 */
app.post('/api/whispers', async (c) => {
  try {
    const data = await c.req.json<{
      roomNo: number;
      date: number;
      from: string;
      to: string;
      message: string;
      phase?: string;
    }>();

    if (!data.roomNo || !data.from || !data.to || !data.message) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (data.message.length > 300) {
      return c.json({ error: 'Message too long (max 300 chars)' }, 400);
    }

    // 取得房間玩家列表，用於權限檢查
    const playersResult = await c.env.DB.prepare(
      'SELECT * FROM players WHERE room_no = ?'
    ).bind(data.roomNo).all();

    const players = playersResult.results as any[];

    // 檢查密語權限（純函數，依據角色 + 階段 + 存活狀態）
    const phase = data.phase || (players.length > 0 ? (players[0] as any).day_night : 'day');
    const can = canWhisper(data.from, data.to, phase, players);
    if (!can) {
      return c.json({ error: 'Permission denied: cannot whisper at this time' }, 403);
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const safeMessage = escapeHtml(data.message);

    const stmt = c.env.DB.prepare(`
      INSERT INTO whispers (id, room_no, date, from_uname, to_uname, message, time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      id,
      data.roomNo,
      data.date,
      data.from,
      data.to,
      safeMessage,
      Date.now()
    ).all();

    return c.json({ success: true, id, message: 'Whisper sent' });
  } catch (error) {
    console.error('Send whisper error:', error);
    return c.json({ error: 'Failed to send whisper' }, 500);
  }
});

/**
 * 獲取房間的密語列表
 */
app.get('/api/whispers/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const date = c.req.query('date');
    const uname = c.req.query('uname'); // 只看特定玩家的密語

    let query = 'SELECT * FROM whispers WHERE room_no = ?';
    const params: any[] = [roomNo];

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    if (uname) {
      query += ' AND (from_uname = ? OR to_uname = ?)';
      params.push(uname, uname);
    }

    query += ' ORDER BY date ASC, time ASC';

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json({ whispers: result.results });
  } catch (error) {
    console.error('Get whispers error:', error);
    return c.json({ error: 'Failed to get whispers' }, 500);
  }
});

/**
 * 獲取玩家未讀密語數量
 */
app.get('/api/whispers/:roomNo/unread/:uname', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const uname = c.req.param('uname');
    const since = parseInt(c.req.query('since') || '0');

    const stmt = c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM whispers
      WHERE room_no = ? AND to_uname = ? AND time > ?
    `);
    const result = await stmt.bind(roomNo, uname, since).all();

    const count = (result.results[0] as { count?: number } | undefined)?.count || 0;

    return c.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread whispers error:', error);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

// ==================== 遊戲事件記錄 ====================

/**
 * 記錄遊戲事件
 */
app.post('/api/game-events', async (c) => {
  try {
    const data = await c.req.json<{
      roomNo: number;
      date: number;
      eventType: string;
      description: string;
      relatedUname?: string;
    }>();

    const stmt = c.env.DB.prepare(`
      INSERT INTO game_events (room_no, date, event_type, description, related_uname, time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      data.roomNo,
      data.date,
      data.eventType,
      data.description,
      data.relatedUname || '',
      Date.now()
    ).all();

    return c.json({ success: true });
  } catch (error) {
    console.error('Record game event error:', error);
    return c.json({ error: 'Failed to record event' }, 500);
  }
});

/**
 * 獲取遊戲事件
 */
app.get('/api/game-events/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');
    const eventType = c.req.query('type');

    let query = 'SELECT * FROM game_events WHERE room_no = ?';
    const params: any[] = [roomNo];

    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }

    query += ' ORDER BY date ASC, time ASC';

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return c.json({ events: result.results });
  } catch (error) {
    console.error('Get game events error:', error);
    return c.json({ error: 'Failed to get events' }, 500);
  }
});

// ==================== 戰局回放 ====================

/**
 * 獲取完整遊戲回放資料
 * GET /api/replay/:roomNo
 */
app.get('/api/replay/:roomNo', async (c) => {
  try {
    const roomNo = c.req.param('roomNo');

    // 1. 取得遊戲摘要
    const gameStmt = c.env.DB.prepare('SELECT * FROM game_logs WHERE room_no = ?');
    const gameResult = await gameStmt.bind(roomNo).all();

    if (gameResult.results.length === 0) {
      return c.json({ error: 'Game not found' }, 404);
    }

    // 2. 取得事件時間軸
    const eventsStmt = c.env.DB.prepare(
      'SELECT * FROM game_events WHERE room_no = ? ORDER BY date ASC, time ASC'
    );
    const eventsResult = await eventsStmt.bind(roomNo).all();

    // 3. 取得投票記錄
    const votesStmt = c.env.DB.prepare(
      'SELECT * FROM vote_history WHERE room_no = ? ORDER BY date ASC, time ASC'
    );
    const votesResult = await votesStmt.bind(roomNo).all();

    // 4. 取得遺書
    const willsStmt = c.env.DB.prepare(
      'SELECT * FROM wills WHERE room_no = ? ORDER BY date ASC, time ASC'
    );
    const willsResult = await willsStmt.bind(roomNo).all();

    return c.json({
      game: gameResult.results[0],
      events: eventsResult.results,
      votes: votesResult.results,
      wills: willsResult.results,
    });
  } catch (error) {
    console.error('Get replay error:', error);
    return c.json({ error: 'Failed to get replay data' }, 500);
  }
});

// ==================== 成就系統 ====================

/**
 * 成就定義（寫在程式碼中，不存 DB）
 */
const ACHIEVEMENT_DEFINITIONS: Record<string, { key: string; name: string; description: string; icon: string }> = {
  first_win: {
    key: 'first_win',
    name: '🏆 初次勝利',
    description: '贏得第一場遊戲',
    icon: '🏆'
  },
  wolf_master: {
    key: 'wolf_master',
    name: '🐺 狼王',
    description: '以狼人身分獲勝 5 次',
    icon: '🐺'
  },
  seer_expert: {
    key: 'seer_expert',
    name: '🔮 占卜大師',
    description: '以預言家身分獲勝 3 次',
    icon: '🔮'
  },
  hunter_master: {
    key: 'hunter_master',
    name: '🏹 獵人宗師',
    description: '以獵人身分獲勝 3 次',
    icon: '🏹'
  },
  survivor: {
    key: 'survivor',
    name: '🛡️ 生存專家',
    description: '存活 5 場遊戲',
    icon: '🛡️'
  },
  veteran: {
    key: 'veteran',
    name: '🎖️ 老兵',
    description: '遊玩 50 場遊戲',
    icon: '🎖️'
  },
  popular: {
    key: 'popular',
    name: '⭐ 人氣之星',
    description: '被觀戰 10 次',
    icon: '⭐'
  },
  bbs_active: {
    key: 'bbs_active',
    name: '📝 社群活躍',
    description: '在 BBS 發文 10 篇',
    icon: '📝'
  },
  streak_win: {
    key: 'streak_win',
    name: '🔥 連勝達人',
    description: '連續獲勝 3 場',
    icon: '🔥'
  },
  perfect_game: {
    key: 'perfect_game',
    name: '💎 完美對局',
    description: '在一場遊戲中存活並獲勝',
    icon: '💎'
  }
};

/**
 * 取得所有成就定義
 */
app.get('/api/achievements/definitions', (c) => {
  return c.json({
    achievements: Object.values(ACHIEVEMENT_DEFINITIONS)
  });
});

/**
 * 取得玩家成就列表
 */
app.get('/api/achievements/:trip', async (c) => {
  try {
    const trip = c.req.param('trip');
    const stmt = c.env.DB.prepare(
      'SELECT achievement_key, unlocked_at FROM achievements WHERE trip = ? ORDER BY unlocked_at ASC'
    );
    const result = await stmt.bind(trip).all();

    return c.json({
      trip,
      achievements: result.results,
      count: result.results.length,
      definitions: ACHIEVEMENT_DEFINITIONS
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    return c.json({ error: 'Failed to get achievements' }, 500);
  }
});

/**
 * 檢查並解鎖新成就
 * Body: { trip: string, stats?: {...} }
 */
app.post('/api/achievements/check', async (c) => {
  try {
    const data = await c.req.json<{
      trip: string;
      stats?: {
        human_wins?: number;
        wolf_wins?: number;
        fox_wins?: number;
        total_games?: number;
        survivor_count?: number;
        role_history?: string;
        watch_count?: number;
        bbs_post_count?: number;
        streak_wins?: number;
        perfect_games?: number;
      };
    }>();

    if (!data.trip) {
      return c.json({ error: 'trip is required' }, 400);
    }

    const stats = data.stats || {};
    const newlyUnlocked: string[] = [];

    // 取得已解鎖的成就
    const existingStmt = c.env.DB.prepare(
      'SELECT achievement_key FROM achievements WHERE trip = ?'
    );
    const existingResult = await existingStmt.bind(data.trip).all();
    const unlockedKeys = new Set(
      (existingResult.results as { achievement_key: string }[]).map(r => r.achievement_key)
    );

    // 解析 role_history
    let roleHistory: Record<string, number> = {};
    if (stats.role_history) {
      try {
        roleHistory = JSON.parse(stats.role_history) as Record<string, number>;
      } catch (e) {
        // ignore
      }
    }

    const totalWins = (stats.human_wins || 0) + (stats.wolf_wins || 0) + (stats.fox_wins || 0);

    // 檢查各成就
    const checks: [string, boolean][] = [
      ['first_win', totalWins >= 1],
      ['wolf_master', (stats.wolf_wins || 0) >= 5],
      ['seer_expert', (roleHistory['mage'] || 0) >= 3],
      ['hunter_master', (roleHistory['guard'] || 0) >= 3],
      ['survivor', (stats.survivor_count || 0) >= 5],
      ['veteran', (stats.total_games || 0) >= 50],
      ['popular', (stats.watch_count || 0) >= 10],
      ['bbs_active', (stats.bbs_post_count || 0) >= 10],
      ['streak_win', (stats.streak_wins || 0) >= 3],
      ['perfect_game', (stats.perfect_games || 0) >= 1],
    ];

    const now = Date.now();
    for (const [key, passed] of checks) {
      if (passed && !unlockedKeys.has(key)) {
        const insertStmt = c.env.DB.prepare(
          'INSERT OR IGNORE INTO achievements (trip, achievement_key, unlocked_at) VALUES (?, ?, ?)'
        );
        await insertStmt.bind(data.trip, key, now).all();
        newlyUnlocked.push(key);
      }
    }

    // 取得更新後的完整成就列表
    const updatedStmt = c.env.DB.prepare(
      'SELECT achievement_key, unlocked_at FROM achievements WHERE trip = ? ORDER BY unlocked_at ASC'
    );
    const updatedResult = await updatedStmt.bind(data.trip).all();

    return c.json({
      success: true,
      trip: data.trip,
      newlyUnlocked,
      achievements: updatedResult.results,
      count: updatedResult.results.length
    });
  } catch (error) {
    console.error('Check achievements error:', error);
    return c.json({ error: 'Failed to check achievements' }, 500);
  }
});

export default app;
