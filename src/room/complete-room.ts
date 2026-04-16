/**
 * Durable Object - 完整房間系統
 * 整合所有遊戲系統
 */

// @ts-ignore - cloudflare:workers is a special module in Wrangler
import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Env, Player, RoomData, Message, Role } from '../types';
import { createRoom, addPlayer, removePlayer, startGame, endGame, getPublicRoomInfo } from '../utils/room-manager';
import { advanceTime, checkSilence, transitionPhase, DEFAULT_TIME_CONFIG } from '../utils/time-progression';
import { assignRoles, checkVictory, canSpeak, getRoleTeam, getVictoryMessage } from '../utils/role-system';
import { createVoteData, addVote, getVoteResult, executeVote, isVoteComplete, calculateWeightedVotes, resolveWeightedVoteResult } from '../utils/vote-system';
import { createNightState, wolfKill, seerDivine, guardTarget, processNightResult, getNightSummary, isNightActionsComplete } from '../utils/night-action';
import { createSessionManager, type SessionValue } from '../utils/session-manager';
import {
  isGM,
  canUseHeavenChat,
  isValidGMAction,
  executeGMAction,
  createHeavenMessage,
  createGMWhisper,
  getHeavenRecipients
} from '../utils/gm-system';

export class WerewolfRoom extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  private sessionManager: any;
  private roomData: RoomData;
  private voteData?: any;
  private nightState?: any;
  private _pendingNightSummary?: string;
  // @ts-ignore - ctx is a DurableObject property
  private storage = this.ctx.storage;

  // 清理機制時間常數
  private static readonly CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000;  // 每 5 分鐘檢查
  private static readonly ENDED_ROOM_TTL_MS = 30 * 60 * 1000;           // 結束後 30 分鐘清理
  private static readonly INACTIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;    // 無活動 2 小時清理

  // @ts-ignore - env is a DurableObject property
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sessionManager = createSessionManager(env.KV);

    // 初始化房間資料
    this.roomData = createRoom({
      roomNo: 0,
      roomName: '',
      maxUser: 16
    });

    // 載入持久化狀態
    this.loadState();
  }

  private async loadState() {
    try {
      const saved = await this.storage.get<RoomData>('room');
      if (saved) {
        this.roomData = {
          ...saved,
          players: new Map(Object.entries(saved.players))
        };
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }

  /**
   * Durable Object alarm handler — 定期檢查是否需要清理房間
   * 由 Cloudflare Workers 自動呼叫，無需外部觸發
   */
  async alarm() {
    const now = Date.now();
    const lastActive = this.roomData.lastUpdated || this.roomData.uptime || now;
    const inactiveMs = now - lastActive;

    let shouldCleanup = false;

    if (this.roomData.status === 'ended' && inactiveMs > WerewolfRoom.ENDED_ROOM_TTL_MS) {
      // 遊戲結束超過 30 分鐘 → 清理
      shouldCleanup = true;
    } else if (
      (this.roomData.status === 'waiting' || this.roomData.status === 'playing') &&
      this.sessions.size === 0 &&
      inactiveMs > WerewolfRoom.INACTIVE_ROOM_TTL_MS
    ) {
      // 等待中或遊戲中，但 0 人連線超過 2 小時 → 清理（殘留房間）
      shouldCleanup = true;
    }

    if (shouldCleanup) {
      console.log(`[Room ${this.roomData.roomNo}] Cleanup triggered: status=${this.roomData.status}, inactive=${Math.round(inactiveMs / 60000)}min`);
      await this.cleanupRoom();
      return;
    }

    // 否則重新設定 alarm 繼續監控
    await this.storage.setAlarm(now + WerewolfRoom.CLEANUP_CHECK_INTERVAL_MS);
  }

  /**
   * 排程下一次清理檢查
   */
  private async scheduleCleanupCheck() {
    try {
      await this.storage.setAlarm(Date.now() + WerewolfRoom.CLEANUP_CHECK_INTERVAL_MS);
    } catch (e) {
      console.error('Failed to schedule cleanup check:', e);
    }
  }

  /**
   * 清理房間（由 alarm 或外部 /cleanup 觸發）
   */
  private async cleanupRoom() {
    const roomNo = this.roomData.roomNo;

    // 0. 歸檔回放資料（talk/game_events/vote_history）到 archive 表
    try {
      // @ts-ignore
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO talk_archive (id, room_no, date, location, uname, handle_name, sentence, font_type, time, spend_time, archived_at)
           SELECT id, room_no, date, location, uname, handle_name, sentence, font_type, time, spend_time, strftime('%s','now')
           FROM talk WHERE room_no = ?`
        ).bind(roomNo),
        this.env.DB.prepare(
          `INSERT INTO game_events_archive (id, room_no, date, event_type, description, actor, target, time, archived_at)
           SELECT id, room_no, date, event_type, description, actor, target, time, strftime('%s','now')
           FROM game_events WHERE room_no = ?`
        ).bind(roomNo),
        this.env.DB.prepare(
          `INSERT INTO vote_history_archive (id, room_no, date, round, voter, candidate, time, archived_at)
           SELECT id, room_no, date, round, voter, candidate, time, strftime('%s','now')
           FROM vote_history WHERE room_no = ?`
        ).bind(roomNo),
      ]);
      console.log(`[Room ${roomNo}] Replay data archived`);
    } catch (e) {
      console.warn(`[Room ${roomNo}] Archive failed (non-critical):`, e);
    }

    // 1. 清理 D1 資料（game_logs 保留作歷史記錄）
    try {
      // @ts-ignore
      await this.env.DB.batch([
        this.env.DB.prepare('DELETE FROM talk WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM vote_history WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM game_events WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM user_entry WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM wills WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM whispers WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM spectators WHERE room_no = ?').bind(roomNo),
        this.env.DB.prepare('DELETE FROM room WHERE room_no = ?').bind(roomNo),
      ]);
      console.log(`[Room ${roomNo}] D1 cleanup completed`);
    } catch (e) {
      console.error(`[Room ${roomNo}] D1 cleanup error:`, e);
    }

    // 2. 清理 KV 統計
    try {
      const { StatsManager } = await import('../utils/stats-manager');
      // @ts-ignore
      const statsManager = new StatsManager(this.env.KV);
      await statsManager.deleteRoomStats(roomNo);
    } catch (e) {
      console.error(`[Room ${roomNo}] KV stats cleanup error:`, e);
    }

    // 3. 關閉所有 WebSocket
    for (const [, ws] of this.sessions) {
      try { ws.close(1001, 'Room cleaned up'); } catch {}
    }
    this.sessions.clear();

    // 4. 清理 DO storage
    await this.storage.deleteAll();
    // 5. 刪除 alarm
    await this.storage.deleteAlarm();

    console.log(`[Room ${roomNo}] Cleanup completed`);
  }

  /**
   * 外部清理請求處理（管理員或 Cron Trigger 使用）
   */
  private async handleCleanup(): Promise<Response> {
    try {
      await this.cleanupRoom();
      return Response.json({ success: true, roomNo: this.roomData.roomNo });
    } catch (e) {
      console.error('Cleanup handler error:', e);
      return Response.json({ error: 'Cleanup failed' }, 500);
    }
  }

  /**
   * 管理員踢出玩家（由 admin.ts 呼叫，無房長/狀態限制）
   */
  private async handleAdminKick(req: Request): Promise<Response> {
    try {
      const { uname, reason } = await req.json() as { uname: string; reason?: string };

      if (!uname) {
        return Response.json({ error: 'Username required' }, { status: 400 });
      }

      if (!this.roomData) {
        return Response.json({ error: 'Room not initialized' }, { status: 404 });
      }

      const targetPlayer = this.roomData.players.get(uname);
      if (!targetPlayer) {
        return Response.json({ error: 'Player not found' }, { status: 404 });
      }

      // 移除玩家
      removePlayer(this.roomData, uname);

      // 關閉目標玩家的 WebSocket
      const targetWs = this.sessions.get(uname);
      if (targetWs) {
        try { targetWs.close(4001, reason || 'Kicked by admin'); } catch {}
        this.sessions.delete(uname);
      }

      // 廣播系統訊息
      this.broadcast({
        type: 'system',
        data: {
          message: `玩家 ${targetPlayer.handleName} 已被管理員移出${reason ? `（${reason}）` : ''}`,
          players: Array.from(this.roomData.players.values()).map(p => ({
            userNo: p.userNo,
            uname: p.uname,
            handleName: p.handleName,
            trip: p.trip,
            iconNo: p.iconNo,
            live: p.live
          }))
        }
      });

      await this.saveState();
      return Response.json({ success: true, kicked: uname });
    } catch (e) {
      console.error('Admin kick handler error:', e);
      return Response.json({ error: 'Kick failed' }, 500);
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/ws') {
      return this.handleWebSocket(req);
    }

    if (path === '/info') {
      const info = getPublicRoomInfo(this.roomData);
      // 加入 typed options 與私人房間標記（不洩漏 passwordHash）
      return Response.json({
        ...info,
        isPrivate: !!this.roomData.isPrivate,
        timeLimit: this.roomData.timeLimit ?? 60,
        silenceMode: !!this.roomData.silenceMode,
      });
    }

    if (path === '/init' && req.method === 'POST') {
      return this.initialize(req);
    }

    if (path === '/cleanup' && req.method === 'POST') {
      return this.handleCleanup();
    }

    if (path === '/kick' && req.method === 'POST') {
      return this.handleAdminKick(req);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  /**
   * 初始化房間
   */
  private async initialize(req: Request): Promise<Response> {
    const data = await req.json() as {
      roomNo: number;
      roomName: string;
      roomComment: string;
      maxUser?: number;
      gameOption?: string;
      optionRole?: string;
      isPrivate?: boolean;
      passwordHash?: string;
      roomOptions?: any;
    };

    this.roomData = createRoom({
      roomNo: data.roomNo,
      roomName: data.roomName,
      roomComment: data.roomComment,
      maxUser: data.maxUser || 16,
      gameOption: data.gameOption || '',
      optionRole: data.optionRole || ''
    });

    // 儲存私人房間與 typed options 到 roomData
    this.roomData.isPrivate = !!data.isPrivate;
    this.roomData.passwordHash = data.passwordHash || '';
    this.roomData.timeLimit = data.roomOptions?.timeLimit;
    this.roomData.silenceMode = data.roomOptions?.silenceMode;

    // 儲存完整的 roomOptions（含 gmEnabled 等所有選項）
    this.roomData.roomOptions = data.roomOptions;

    await this.saveState();

    // 新房間也排程清理檢查（防止無人加入時殘留）
    await this.scheduleCleanupCheck();

    return Response.json({ success: true });
  }

  /**
   * 處理 WebSocket 連線
   */
  private async handleWebSocket(req: Request): Promise<Response> {
    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // @ts-ignore - WebSocketPair is a Cloudflare-specific API
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // @ts-ignore - server is a WebSocket
    server.accept();

    const url = new URL(req.url);
    const sessionToken = url.searchParams.get('session');

    if (!sessionToken) {
      // @ts-ignore - server is a WebSocket
      server.close(1008, 'No session token');
      // @ts-ignore - webSocket is a Cloudflare Response option
      return new Response(null, { status: 101, webSocket: client });
    }

    // 驗證 Session
    const session = await this.sessionManager.validate(sessionToken);
    if (!session || session.roomNo !== this.roomData.roomNo) {
      // @ts-ignore - server is a WebSocket
      server.close(1008, 'Invalid session');
      // @ts-ignore - webSocket is a Cloudflare Response option
      return new Response(null, { status: 101, webSocket: client });
    }

    // 嘗試加入玩家到房間（如果尚未加入）
    let player = this.roomData.players.get(session.uname);
    if (!player) {
      const newPlayer: Player = {
        userNo: this.roomData.players.size + 1,
        uname: session.uname,
        handleName: session.handleName || session.uname,
        trip: (session as any).trip || '',
        iconNo: (session as any).iconNo || 1,
        sex: (session as any).sex || 'male',
        role: 'human',
        live: 'live',
        score: 0,
        sessionId: sessionToken,
        ipAddress: req.headers.get('CF-Connecting-IP') || undefined,
      };
      // 第一個加入的玩家成為房長
      if (!this.roomData.host) {
        this.roomData.host = session.uname;
      }
      addPlayer(this.roomData, newPlayer);
      await this.saveState();
      player = newPlayer;
    }

    // 保存連線
    this.sessions.set(session.uname, server as WebSocket);

    // 發送初始資料
    server.send(JSON.stringify({
      type: 'connected',
      data: {
        room: getPublicRoomInfo(this.roomData),
        player: this.roomData.players.get(session.uname)
      }
    }));

    // 監聽訊息
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleClientMessage(session.uname, data);
      } catch (e) {
        console.error('Message error:', e);
      }
    });

    // 處理斷線
    server.addEventListener('close', async () => {
      this.sessions.delete(session.uname);
      await this.handlePlayerDisconnect(session.uname);
    });

    // @ts-ignore - webSocket is a Cloudflare Response option
    return new Response(null, {
      status: 101,
      // @ts-ignore
      webSocket: client
    });
  }

  /**
   * 處理客戶端訊息
   */
  private async handleClientMessage(uname: string, data: any) {
    const player = this.roomData.players.get(uname);
    const playerIsGM = isGM(player);

    // GM can act even when dead, and dead players can use heaven_chat
    if (!player || (!playerIsGM && player.live !== 'live')) {
      // Allow heaven_chat from dead players
      if (data?.type === 'heaven_chat' && player) {
        await this.handleHeavenChat(uname, data.text);
      }
      return;
    }

    switch (data.type) {
      case 'say':
        await this.handleSay(uname, data.text, data.fontType || 'normal');
        break;
      case 'vote':
        await this.handleVote(uname, data.target);
        break;
      case 'night_action':
        await this.handleNightAction(uname, data.action, data.target);
        break;
      case 'skip_night':
        await this.handleNightAction(uname, 'skip');
        break;
      case 'start_game':
        await this.handleStartGame(uname);
        break;
      case 'kick_player':
        await this.handleKickPlayer(uname, data.target);
        break;
      case 'force_end':
        await this.handleForceEnd(uname);
        break;
      case 'gm_action':
        if (playerIsGM) {
          await this.handleGMAction(uname, data.action, data.target, data.message, data.role);
        }
        break;
      case 'gm_whisper':
        if (playerIsGM) {
          await this.handleGMWhisper(uname, data.target, data.text);
        }
        break;
      case 'heaven_chat':
        if (player.live === 'dead' || playerIsGM) {
          await this.handleHeavenChat(uname, data.text);
        }
        break;
    }
  }

  /**
   * 處理發言
   */
  private async handleSay(uname: string, text: string, fontType: string) {
    const player = this.roomData.players.get(uname);
    // @ts-ignore - dayNight may be 'beforegame' which is handled at runtime
    if (!player || !canSpeak(player, this.roomData.dayNight)) {
      return;
    }

    // 建立訊息
    const message: Message = {
      id: `${Date.now()}-${Math.random()}`,
      roomNo: this.roomData.roomNo,
      date: this.roomData.date,
      location: this.roomData.dayNight,
      uname,
      handleName: player.handleName,
      sentence: text,
      fontType: fontType as any,
      time: Date.now()
    };

    // 存入 D1
    try {
      // @ts-ignore - env is a DurableObject property
      await this.env.DB.prepare(
        'INSERT INTO talk (room_no, date, location, uname, handle_name, sentence, font_type, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        this.roomData.roomNo,
        this.roomData.date,
        this.roomData.dayNight,
        uname,
        player.handleName,
        text,
        fontType,
        Math.floor(Date.now() / 1000)
      ).run();
    } catch (e) {
      console.error('DB error:', e);
    }

    // 廣播
    this.broadcast({
      type: 'message',
      data: message
    });

    // 時間流逝
    await this.advanceGameTime(1);
  }

  /**
   * 處理投票
   */
  private async handleVote(uname: string, targetUname: string) {
    if (this.roomData.dayNight !== 'day' || !this.voteData) {
      return;
    }

    const player = this.roomData.players.get(uname);
    if (!player || player.live !== 'live') {
      return;
    }

    // 加入投票
    const success = addVote(this.voteData, uname, targetUname);

    if (success) {
      // 記錄投票到 D1
      try {
        // @ts-ignore
        await this.env.DB.prepare(`
          INSERT INTO vote_history (room_no, date, voter_uname, target_uname, vote_type, time)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          this.roomData.roomNo, this.roomData.date, uname, targetUname, 'normal', Date.now()
        ).run();
      } catch (e) {
        console.error('Vote history error:', e);
      }

      // 廣播投票更新
      this.broadcast({
        type: 'vote_update',
        data: {
          uname,
          target: targetUname,
          voteCounts: Array.from(this.voteData.voteCounts.entries())
        }
      });

      // 檢查投票是否完成
      const alivePlayers = Array.from(this.roomData.players.values()).filter(p => p.live === 'live');
      if (isVoteComplete(this.voteData, alivePlayers)) {
        await this.processVoteResult();
      }
    }
  }

  /**
   * 處理夜晚行動
   */
  private async handleNightAction(uname: string, action: string, target?: string) {
    if (this.roomData.dayNight !== 'night' || !this.nightState) {
      return;
    }

    const player = this.roomData.players.get(uname);
    if (!player) {
      return;
    }

    // 根據角色處理行動
    switch (action) {
      case 'wolf_kill':
        if (target) {
          wolfKill(this.nightState, this.roomData.players, [target]);
        }
        break;
      case 'seer_divine':
        if (target) {
          const result = seerDivine(this.nightState, this.roomData.players, uname, target);
          if (result) {
            // 發送占卜結果給預言家
            const ws = this.sessions.get(uname);
            if (ws) {
              ws.send(JSON.stringify({
                type: 'divine_result',
                data: { target, result }
              }));
            }
          }
        }
        break;
      case 'guard_protect':
        if (target) {
          guardTarget(this.nightState, this.roomData.players, uname, target);
        }
        break;
      case 'skip':
        // 記錄跳過行動
        this.nightState.actions.push({ type: 'skip' as any, actor: uname });
        break;
    }

    // 檢查是否完成所有行動
    if (isNightActionsComplete(this.nightState, this.roomData.players)) {
      await this.processNightResult();
    }
  }

  /**
   * 開始遊戲
   */
  private async handleStartGame(uname: string) {
    if (this.roomData.status !== 'waiting') {
      return;
    }

    const players = Array.from(this.roomData.players.values());

    // 隨機分配角色
    const roleConfig = this.parseRoleConfig(this.roomData.optionRole);
    assignRoles(players, roleConfig);

    // GM 啟用：將房長的角色覆蓋為 GM
    const gmEnabled = this.roomData.roomOptions?.gmEnabled === true;
    if (gmEnabled) {
      const hostUname = this.roomData.host || players[0]?.uname;
      const hostPlayer = hostUname ? this.roomData.players.get(hostUname) : undefined;
      if (hostPlayer) {
        hostPlayer.role = 'GM';
      }
    }

    // 開始遊戲
    const success = startGame(this.roomData);
    if (!success) {
      return;
    }

    // 初始化投票資料（遊戲從白天開始，需要投票資料）
    this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);

    // 通知所有玩家
    for (const [playerUname, ws] of this.sessions) {
      const player = this.roomData.players.get(playerUname);
      if (player && ws) {
        ws.send(JSON.stringify({
          type: 'game_start',
          data: {
            role: player.role,
            players: Array.from(this.roomData.players.values()).map(p => ({
              userNo: p.userNo,
              handleName: p.handleName,
              trip: p.trip,
              iconNo: p.iconNo,
              live: p.live
            }))
          }
        }));
      }
    }

    await this.saveState();

    // 更新 KV 統計
    try {
      const { StatsManager } = await import('../utils/stats-manager');
      const statsManager = new StatsManager(this.env.KV);
      await statsManager.recordGameStart();
      await statsManager.updateActivePlayerCount(this.roomData.players.size);
    } catch (e) {
      console.error('Stats update error:', e);
    }

    // 記錄遊戲開始事件
    try {
      // @ts-ignore
      await this.env.DB.prepare(`
        INSERT INTO game_events (room_no, date, event_type, description, time)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        this.roomData.roomNo, this.roomData.date, 'game_start',
        `遊戲開始，${this.roomData.players.size} 名玩家`, Date.now()
      ).run();
    } catch (e) {
      console.error('Game event error:', e);
    }
  }

  /**
   * 房長踢出玩家（僅限等待中狀態）
   */
  private async handleKickPlayer(uname: string, targetUname: string) {
    // 權限檢查：只有房長可以踢人
    if (this.roomData.host !== uname) {
      return;
    }
    // 狀態檢查：只有等待中可以踢人
    if (this.roomData.status !== 'waiting') {
      return;
    }
    // 不能踢自己
    if (uname === targetUname) {
      return;
    }
    // 目標玩家必須存在
    const targetPlayer = this.roomData.players.get(targetUname);
    if (!targetPlayer) {
      return;
    }

    // 移除玩家
    removePlayer(this.roomData, targetUname);

    // 關閉目標玩家的 WebSocket
    const targetWs = this.sessions.get(targetUname);
    if (targetWs) {
      try { targetWs.close(4000, '被房長踢出'); } catch {}
      this.sessions.delete(targetUname);
    }

    // 廣播踢人事件
    this.broadcast({
      type: 'player_left',
      data: {
        uname: targetUname,
        handleName: targetPlayer.handleName,
        kicked: true,
        players: Array.from(this.roomData.players.values()).map(p => ({
          userNo: p.userNo,
          uname: p.uname,
          handleName: p.handleName,
          trip: p.trip,
          iconNo: p.iconNo,
          live: p.live
        }))
      }
    });

    await this.saveState();
  }

  /**
   * 房長強制結束遊戲（僅限遊戲中狀態）
   */
  private async handleForceEnd(uname: string) {
    // 權限檢查：只有房長可以強制結束
    if (this.roomData.host !== uname) {
      return;
    }
    // 狀態檢查：只有遊戲中可以強制結束
    if (this.roomData.status !== 'playing') {
      return;
    }

    // 以平局結束遊戲
    await this.endGame('draw');
  }

  /**
   * 推進遊戲時間
   */
  private async advanceGameTime(units: number) {
    this.roomData.timeSpent = (this.roomData.timeSpent || 0) + units;
    const limit = this.roomData.dayNight === 'day'
      ? DEFAULT_TIME_CONFIG.dayLimit
      : DEFAULT_TIME_CONFIG.nightLimit;

    if (this.roomData.timeSpent >= limit) {
      await this.transitionPhase();
    }

    await this.saveState();
  }

  /**
   * 處理 GM 行動
   */
  private async handleGMAction(
    gmUname: string,
    action: string,
    target?: string,
    message?: string,
    extraRole?: string
  ) {
    if (!isValidGMAction(action)) {
      return;
    }

    const result = executeGMAction(
      this.roomData,
      gmUname,
      action,
      target,
      message,
      extraRole as any
    );

    if (result.success && result.broadcastMessage) {
      // GM 廣播訊息（GM_CHANNEL, GM_KILL, GM_RESU）→ 所有玩家
      this.broadcast({
        type: 'message',
        data: result.broadcastMessage
      });
    }

    // 發送操作結果回覆給 GM
    const gmWs = this.sessions.get(gmUname);
    if (gmWs) {
      gmWs.send(JSON.stringify({
        type: 'gm_result',
        data: {
          action,
          success: result.success,
          message: result.resultMessage
        }
      }));
    }

    // GM_KILL/GM_RESU 後檢查勝負
    if (result.success && (action === 'GM_KILL' || action === 'GM_RESU')) {
      const victory = checkVictory(Array.from(this.roomData.players.values()));
      if (victory) {
        await this.endGame(victory);
        return;
      }
    }

    await this.saveState();
  }

  /**
   * 處理 GM 私訊（GM → 玩家）
   */
  private async handleGMWhisper(gmUname: string, targetUname: string, text: string) {
    const whisper = createGMWhisper(this.roomData, gmUname, targetUname, text);
    if (!whisper) {
      return;
    }

    // 發送訊息給目標玩家
    const targetWs = this.sessions.get(targetUname);
    if (targetWs) {
      targetWs.send(JSON.stringify({
        type: 'message',
        data: whisper.targetMessage
      }));
    }

    // 發送回執給 GM
    const gmWs = this.sessions.get(gmUname);
    if (gmWs) {
      gmWs.send(JSON.stringify({
        type: 'message',
        data: whisper.gmMessage
      }));
    }
  }

  /**
   * 處理天國聊天（只有死亡玩家 + GM 可以看到）
   */
  private async handleHeavenChat(uname: string, text: string) {
    const heavenMsg = createHeavenMessage(this.roomData, uname, text);
    if (!heavenMsg) {
      return;
    }

    const recipients = getHeavenRecipients(this.roomData.players);

    this.broadcastTo(
      {
        type: 'message',
        data: heavenMsg
      },
      recipients
    );
  }

  /**
   * 廣播訊息給特定玩家
   */
  private broadcastTo(message: any, recipients: string[]) {
    const data = JSON.stringify(message);

    for (const uname of recipients) {
      const ws = this.sessions.get(uname);
      if (ws) {
        try {
          ws.send(data);
        } catch (e) {
          this.sessions.delete(uname);
        }
      }
    }
  }

  /**
   * 階段轉換
   */
  private async transitionPhase() {
    if (this.roomData.dayNight === 'day') {
      // 白天 → 夜晚
      this.roomData.dayNight = 'night';
      this.roomData.timeSpent = 0;
      this.nightState = createNightState(this.roomData.roomNo, this.roomData.date);

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'night',
          message: '夜幕降臨，請關閉燈光...'
        }
      });
    } else {
      // 夜晚 → 白天
      // 如果 nightState 已被 processNightResult() 清除，跳過（已被處理）
      if (!this.nightState && !this._pendingNightSummary) {
        return;
      }

      // 保存 nightState 引用並立即清除，防止 async 交錯
      const nightState = this.nightState;
      this.nightState = null;

      this.roomData.dayNight = 'day';
      this.roomData.timeSpent = 0;
      this.roomData.date++;

      const summary = nightState ? getNightSummary(nightState) : '昨晚是平安夜';

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'day',
          date: this.roomData.date,
          message: `天亮了...${summary}`
        }
      });

      // 處理夜晚結果
      if (nightState) {
        const dead = processNightResult(nightState, this.roomData.players);
        if (dead.length > 0) {
          this.broadcast({
            type: 'players_died',
            data: dead.map(p => ({ uname: p.uname, handleName: p.handleName }))
          });
        }
      }

      // 檢查勝負
      const victory = checkVictory(Array.from(this.roomData.players.values()));
      if (victory) {
        await this.endGame(victory);
        return;
      }

      // 建立投票資料
      this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);
    }

    await this.saveState();
  }

  /**
   * 處理投票結果
   * 使用加權投票（authority x2），並處理平手/decide 邏輯
   */
  private async processVoteResult() {
    if (!this.voteData) {
      return;
    }

    // 立即清除 voteData 防止 async 交錯導致重複處理
    const voteData = this.voteData;
    this.voteData = null;

    // 使用加權投票解析結果（含 authority x2 + decide 平手處理）
    const result = resolveWeightedVoteResult(voteData, this.roomData.players);

    if (result.revote) {
      // 平手且無 decide 玩家 → 重新投票
      this.broadcast({
        type: 'vote_tie',
        data: {
          message: '投票平手！需要重新投票...'
        }
      });

      // 建立新的投票資料讓玩家重新投票
      this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);
      await this.saveState();
      return;
    }

    if (result.executed.length > 0) {
      this.broadcast({
        type: 'players_executed',
        data: result.executed.map(p => ({ uname: p.uname, handleName: p.handleName }))
      });
    }

    // 記錄處決事件
    for (const p of result.executed) {
      try {
        // @ts-ignore
        await this.env.DB.prepare(`
          INSERT INTO game_events (room_no, date, event_type, description, related_uname, time)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          this.roomData.roomNo, this.roomData.date, 'execution',
          `${p.handleName} 被投票處決`, p.uname, Date.now()
        ).run();
      } catch (e) {
        console.error('Execution event error:', e);
      }
    }

    // 檢查勝負
    const victory = checkVictory(Array.from(this.roomData.players.values()));
    if (victory) {
      await this.endGame(victory);
      return;
    }

    // 投票結束 → 進入夜晚
    this.roomData.dayNight = 'night';
    this.roomData.timeSpent = 0;
    this.nightState = createNightState(this.roomData.roomNo, this.roomData.date);
    this.broadcast({
      type: 'phase_change',
      data: {
        phase: 'night',
        message: '夜幕降臨，請關閉燈光...'
      }
    });

    await this.saveState();
  }

  /**
   * 處理夜晚結果
   */
  private async processNightResult() {
    if (!this.nightState) {
      return;
    }

    // 立即清除 nightState 防止 async 交錯導致重複處理
    const nightState = this.nightState;
    this.nightState = null;

    // 先計算夜晚摘要（transitionPhase 需要）
    this._pendingNightSummary = getNightSummary(nightState);

    // 處理死亡
    const dead = processNightResult(nightState, this.roomData.players);

    if (dead.length > 0) {
      this.broadcast({
        type: 'players_died',
        data: dead.map(p => ({ uname: p.uname, handleName: p.handleName }))
      });

      // 記錄死亡事件到 D1
      for (const p of dead) {
        try {
          // @ts-ignore
          await this.env.DB.prepare(`
            INSERT INTO game_events (room_no, date, event_type, description, related_uname, time)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            this.roomData.roomNo, this.roomData.date, 'night_death',
            `${p.handleName} 在夜晚被殺害`, p.uname, Date.now()
          ).run();
        } catch (e) {
          console.error('Death event error:', e);
        }
      }
    }

    // 轉換到白天（不再在 transitionPhase 中處理夜晚結果，避免重複）
    this.roomData.dayNight = 'day';
    this.roomData.timeSpent = 0;
    this.roomData.date++;

    this.broadcast({
      type: 'phase_change',
      data: {
        phase: 'day',
        date: this.roomData.date,
        message: `天亮了...${this._pendingNightSummary || '昨晚是平安夜'}`
      }
    });

    // 檢查勝負
    const victory = checkVictory(Array.from(this.roomData.players.values()));
    if (victory) {
      await this.endGame(victory);
      return;
    }

    // 建立投票資料
    this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);
    this._pendingNightSummary = null;

    await this.saveState();
  }

  /**
   * 遊戲結束
   */
  private async endGame(winner: string) {
    endGame(this.roomData, winner);

    this.broadcast({
      type: 'game_over',
      data: {
        winner,
        message: getVictoryMessage(winner)
      }
    });

    // 寫入遊戲記錄到 D1
    try {
      const players = Array.from(this.roomData.players.values());
      const roles = players.map(p => `${p.uname}:${p.role}`).join(',');
      const deathOrder = players
        .filter(p => p.live !== 'live')
        .sort((a: any, b: any) => (a.deathDay || 0) - (b.deathDay || 0))
        .map(p => p.uname)
        .join(',');

      // @ts-ignore
      await this.env.DB.prepare(`
        INSERT INTO game_logs (room_no, room_name, winner, total_days, player_count, roles, death_order, key_events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_no) DO UPDATE SET
          winner = ?, total_days = ?, death_order = ?, key_events = ?
      `).bind(
        this.roomData.roomNo, this.roomData.roomName, winner,
        this.roomData.date, players.length, roles, deathOrder || '',
        `${winner === 'human' ? '村民' : '狼人'}陣營勝利`, Date.now(),
        winner, this.roomData.date, deathOrder || '',
        `${winner === 'human' ? '村民' : '狼人'}陣營勝利`
      ).run();

      // 更新每位玩家的 trip_scores
      const isWolfWin = winner.includes('wolf') || winner === 'mad';
      for (const player of players) {
        const trip = player.trip;
        if (!trip) continue;

        const playerTeam = getRoleTeam(player.role);
        const winTeam = getRoleTeam(winner);
        const playerWon = playerTeam === winTeam;
        const survived = player.live === 'live';

        // @ts-ignore
        await this.env.DB.prepare(`
          INSERT INTO trip_scores (trip, score, games_played, human_wins, wolf_wins, fox_wins, total_games, survivor_count, role_history, last_played)
          VALUES (?, 0, 0, 0, 0, 0, 0, 0, '{}', ?)
          ON CONFLICT(trip) DO UPDATE SET
            games_played = games_played + 1,
            total_games = total_games + 1,
            score = score + ?,
            human_wins = human_wins + ?,
            wolf_wins = wolf_wins + ?,
            survivor_count = survivor_count + ?,
            last_played = ?
        `).bind(
          trip, Date.now(),
          (playerWon ? (isWolfWin ? 15 : 10) : 0) + (survived ? 5 : 0),
          (!isWolfWin && playerWon) ? 1 : 0,
          (isWolfWin && playerWon) ? 1 : 0,
          survived ? 1 : 0,
          Date.now()
        ).run();
      }
    } catch (e) {
      console.error('Game log save error:', e);
    }

    // 更新 KV 統計
    try {
      const { StatsManager } = await import('../utils/stats-manager');
      const statsManager = new StatsManager(this.env.KV);
      const duration = Date.now() - (this.roomData.uptime || Date.now());
      await statsManager.recordGameEnd(winner, duration);
      await statsManager.updateActivePlayerCount(0);
    } catch (e) {
      console.error('Stats update error:', e);
    }

    await this.saveState();

    // 遊戲結束後排程清理（30 分鐘後）
    await this.scheduleCleanupCheck();
  }

  /**
   * 處理玩家斷線
   */
  private async handlePlayerDisconnect(uname: string) {
    this.broadcast({
      type: 'user_left',
      data: { uname }
    });
  }

  /**
   * 廣播訊息
   */
  private broadcast(message: any) {
    const data = JSON.stringify(message);

    for (const [uname, ws] of this.sessions) {
      try {
        ws.send(data);
      } catch (e) {
        this.sessions.delete(uname);
      }
    }
  }

  /**
   * 儲存狀態
   */
  private async saveState() {
    await this.storage.put('room', {
      ...this.roomData,
      players: Object.fromEntries(this.roomData.players)
    });

    // 同步房間到 D1
    try {
      // @ts-ignore
      await this.env.DB.prepare(`
        INSERT INTO room (room_no, room_name, room_comment, max_user, game_option, option_role, status, date, day_night, victory_role, uptime, last_updated, is_private, password_hash, time_limit, silence_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_no) DO UPDATE SET
          room_name = ?, room_comment = ?, status = ?, date = ?, day_night = ?,
          victory_role = ?, last_updated = ?,
          is_private = ?, password_hash = ?, time_limit = ?, silence_mode = ?
      `).bind(
        this.roomData.roomNo, this.roomData.roomName, this.roomData.roomComment || '',
        this.roomData.maxUser, this.roomData.gameOption || '', this.roomData.optionRole || '',
        this.roomData.status, this.roomData.date, this.roomData.dayNight,
        this.roomData.victoryRole || null, this.roomData.uptime || Date.now(), Date.now(),
        this.roomData.isPrivate ? 1 : 0, this.roomData.passwordHash || null,
        this.roomData.roomOptions?.timeLimit || 300, this.roomData.roomOptions?.silenceMode ? 1 : 0,
        this.roomData.roomName, this.roomData.roomComment || '', this.roomData.status,
        this.roomData.date, this.roomData.dayNight, this.roomData.victoryRole || null, Date.now(),
        this.roomData.isPrivate ? 1 : 0, this.roomData.passwordHash || null,
        this.roomData.roomOptions?.timeLimit || 300, this.roomData.roomOptions?.silenceMode ? 1 : 0
      ).run();

      // 同步玩家到 D1
      for (const [uname, player] of this.roomData.players) {
        // @ts-ignore
        await this.env.DB.prepare(`
          INSERT INTO user_entry (room_no, user_no, uname, handle_name, trip, icon_no, sex, role, live, session_id, ip_address, score)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(room_no, user_no) DO UPDATE SET
            handle_name = ?, trip = ?, icon_no = ?, sex = ?, role = ?, live = ?,
            session_id = ?, ip_address = ?, score = ?
        `).bind(
          this.roomData.roomNo, player.userNo, uname, player.handleName,
          player.trip || '', player.iconNo || 1, player.sex || 'male',
          player.role || 'human', player.live || 'live', player.sessionId || '',
          player.ipAddress || '', player.score || 0,
          player.handleName, player.trip || '', player.iconNo || 1, player.sex || 'male',
          player.role || 'human', player.live || 'live', player.sessionId || '',
          player.ipAddress || '', player.score || 0
        ).run();
      }
    } catch (e) {
      console.error('D1 sync error:', e);
    }
  }

  /**
   * 角色分配表（依原版 DIAM setting.php 的 $role_list）
   * 根據人數自動分配基本角色
   */
  private static readonly ROLE_TABLE: Record<number, Role[]> = {
    8:  ['human','human','human','human','human','wolf','wolf','mage'],
    9:  ['human','human','human','human','human','wolf','wolf','mage','necromancer'],
    10: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad'],
    11: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard'],
    12: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard'],
    13: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common'],
    14: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common'],
    15: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    16: ['human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    17: ['human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    18: ['human','human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    19: ['human','human','human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    20: ['human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
    22: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
    30: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','wolf','mage','mage','necromancer','necromancer','mad','guard','guard','common','common','common'],
  };

  /**
   * 取得角色分配表（找最接近的人數）
   */
  private getRoleTable(count: number): Role[] {
    const keys = Object.keys(WerewolfRoom.ROLE_TABLE).map(Number).sort((a, b) => a - b);
    for (const k of keys) {
      if (count <= k) return WerewolfRoom.ROLE_TABLE[k];
    }
    return WerewolfRoom.ROLE_TABLE[30];
  }

  /**
   * 解析角色配置
   * 格式: "lovers decide authority wfbig poison foxs" （空格分隔的選項）
   * 基本角色依人數自動分配，額外選項覆蓋上去
   */
  private parseRoleConfig(config: string): Record<Role, number> {
    // 從人數取得基本角色表
    const baseRoles = this.getRoleTable(this.roomData.maxUser || 22);
    const roleConfig: Partial<Record<Role, number>> = {};

    // 計算基本角色數量
    for (const role of baseRoles) {
      roleConfig[role] = (roleConfig[role] || 0) + 1;
    }

    // 解析額外選項
    if (config && config.trim()) {
      const options = config.trim().split(/\s+/);

      // 處理妖狐選項（替換基本表的 fox 或取消）
      const foxs = options.find(o => o === 'foxs' || o === 'betr' || o === 'fosi');
      const poison = options.find(o => o === 'poison' || o === 'cat');

      if (foxs) {
        // 使用妖狐選項時取消基本表的 fox
        if (roleConfig.fox) {
          roleConfig.fox = 0;
        }
        // 埋毒與妖狐互斥
        if (poison) {
          // 移除埋毒選項
          const pi = options.indexOf(poison);
          if (pi >= 0) options.splice(pi, 1);
        }

        if (foxs === 'betr') {
          roleConfig.betr = 1;
        } else if (foxs === 'foxs') {
          roleConfig.fox = 2; // 雙狐
        } else if (foxs === 'fosi') {
          roleConfig.fosi = 1;
        }
      } else if (poison) {
        // 妖狐沒有選，但埋毒有選 → 取消基本表的 fox
        if (roleConfig.fox) {
          roleConfig.fox = 0;
        }
        if (poison === 'poison') {
          roleConfig.poison = 1;
        } else if (poison === 'cat') {
          roleConfig.cat = 1;
        }
      }

      // 戀人：共有者變戀人（可兼任）
      if (options.includes('lovers') && roleConfig.common) {
        roleConfig.lovers = roleConfig.common;
      }

      // 大狼：狼群隨機一隻取代為大狼
      if (options.includes('wfbig') && (roleConfig.wolf || 0) > 0) {
        roleConfig.wfbig = 1;
        // 減少一隻狼
        roleConfig.wolf = Math.max(1, (roleConfig.wolf || 0) - 1);
      }

      // 決定者：16 人以上可用，平手時若在平手者中則直接被處決
      if (options.includes('decide') && this.roomData.maxUser >= 16) {
        if (!roleConfig.decide) {
          // 決定者佔用一個人類名額
          if ((roleConfig.human || 0) > 0) {
            roleConfig.human = (roleConfig.human || 0) - 1;
          }
          roleConfig.decide = 1;
        }
      }

      // GM 令牌：透過 optionRole 的 'gm' 令牌也能啟用 GM（等同 gmEnabled）
      if (options.includes('gm')) {
        this.roomData.roomOptions = this.roomData.roomOptions || {};
        (this.roomData.roomOptions as any).gmEnabled = true;
      }
    }

    // 權力者：16 人以上自動啟用（PHP parity），投票權重 x2
    // 即使 config 為空也要檢查（authority 在 base role table 中不會出現，需額外加入）
    if (this.roomData.maxUser >= 16 && !roleConfig.authority) {
      // 權力者佔用一個人類名額
      if ((roleConfig.human || 0) > 0) {
        roleConfig.human = (roleConfig.human || 0) - 1;
      }
      roleConfig.authority = 1;
    }

    // 確保 human 至少為 0
    if (roleConfig.human === undefined) {
      roleConfig.human = 0;
    }

    return roleConfig as Record<Role, number>;
  }
}
