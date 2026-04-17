/**
 * Durable Object - 完整房間系統
 * 整合所有遊戲系統
 */

// @ts-ignore - cloudflare:workers is a special module in Wrangler
import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Env, Player, RoomData, Message, Role } from '../types';
import { createRoom, addPlayer, removePlayer, startGame, endGame, getPublicRoomInfo } from '../utils/room-manager';
import { checkSilence, advanceSilenceTime, shouldTriggerSuddenDeath, DEFAULT_TIME_CONFIG, isRealTimeExpired } from '../utils/time-progression';
import { assignRoles, checkVictory, canSpeak, getRoleTeam, getVictoryMessage, createDummyBoyPlayer, getLoverChainVictims, getBetrayerCollapseVictims } from '../utils/role-system';
import { createVoteData, addVote, getVoteResult, executeVote, isVoteComplete, calculateWeightedVotes, resolveWeightedVoteResult, filterVoteDisplay, resolveVoteDisplayMode, canVoteTarget, getVotedUsers, getDayVoteParticipants } from '../utils/vote-system';
import { createNightState, wolfKill, seerDivine, fosiDivine, catResurrect, guardTarget, processNightResult, getNightSummary, isNightActionsComplete, canWolfKillTarget } from '../utils/night-action';
import { buildStartGameVoteState } from '../utils/start-game';
import { createSessionManager, type SessionValue } from '../utils/session-manager';
import { sanitizePlayersForViewer } from '../utils/player-visibility';
import { buildRoleConfig } from '../utils/role-config';
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

  // 時間/清理機制常數
  private static readonly GAME_TICK_INTERVAL_MS = 1000;                  // 遊戲中每秒 tick
  private static readonly CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000;     // 非遊戲中每 5 分鐘檢查
  private static readonly ENDED_ROOM_TTL_MS = 30 * 60 * 1000;            // 結束後 30 分鐘清理
  private static readonly INACTIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;     // 無活動 2 小時清理

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

    // 遊戲進行中：使用 tick 驅動 realTime / silence / sudden death grace
    if (this.roomData.status === 'playing' && (this.roomData.dayNight === 'day' || this.roomData.dayNight === 'night')) {
      await this.advanceGameTime(0);
    }

    await this.scheduleCleanupCheck();
  }

  /**
   * 排程下一次檢查（遊戲中以高頻 tick，其他狀態維持低頻 cleanup 檢查）
   */
  private async scheduleCleanupCheck() {
    try {
      const interval = (this.roomData.status === 'playing' && (this.roomData.dayNight === 'day' || this.roomData.dayNight === 'night'))
        ? WerewolfRoom.GAME_TICK_INTERVAL_MS
        : WerewolfRoom.CLEANUP_CHECK_INTERVAL_MS;
      await this.storage.setAlarm(Date.now() + interval);
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
           SELECT id, room_no, date, event_type, description, NULL as actor, related_uname as target, time, strftime('%s','now')
           FROM game_events WHERE room_no = ?`
        ).bind(roomNo),
        this.env.DB.prepare(
          `INSERT INTO vote_history_archive (id, room_no, date, round, voter, candidate, time, archived_at)
           SELECT id, room_no, date, NULL as round, voter_uname as voter, target_uname as candidate, time, strftime('%s','now')
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
      this.pushPlayersUpdate();

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
        roomOptions: this.roomData.roomOptions || {},
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
      gmTrip?: string;
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

    // gmTrip：指定某個 Trip 為 GM（legacy manager_trip 對齊）
    if (data.gmTrip) {
      (this.roomData as any).gmTrip = data.gmTrip;
    }

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
      const gmEnabled = this.roomData.roomOptions?.gmEnabled === true;
      const gmTrip = ((this.roomData as any).gmTrip as string | undefined)?.trim();
      const isDesignatedGM = !!(
        gmEnabled &&
        gmTrip &&
        (session.trip || '').trim() === gmTrip
      );

      const newPlayer: Player = {
        userNo: this.roomData.players.size + 1,
        uname: session.uname,
        handleName: session.handleName || session.uname,
        trip: session.trip || '',
        iconNo: session.iconNo || 1,
        sex: session.sex || 'male',
        wishRole: (session.wishRole as Role | 'none' | undefined) || 'none',
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

      // legacy parity: 指定 GM 可在滿房時以 maxUser+1 席加入
      let joined = false;
      if (isDesignatedGM && this.roomData.players.size >= this.roomData.maxUser) {
        newPlayer.userNo = this.roomData.maxUser + 1;
        this.roomData.players.set(newPlayer.uname, newPlayer);
        this.roomData.lastUpdated = Date.now();
        joined = true;
      } else {
        joined = addPlayer(this.roomData, newPlayer);
      }

      if (!joined) {
        server.close(1008, 'Room is full');
        return new Response(null, { status: 101, webSocket: client as any });
      }

      await this.saveState();
      player = newPlayer;
    }

    // 保存連線
    this.sessions.set(session.uname, server as WebSocket);

    // 發送初始資料
    server.send(JSON.stringify({
      type: 'connected',
      data: {
        room: {
          ...getPublicRoomInfo(this.roomData),
          roomOptions: this.roomData.roomOptions || {},
          players: this.getVisiblePlayersFor(session.uname),
        },
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
      case 'objection':
        await this.handleObjection(uname);
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

    const now = Date.now();
    this.roomData.lastUpdated = now;
    this.roomData.uptime = now;
    (this.roomData as any)._lastMessageTimeMs = now;
    (this.roomData as any)._lastSilenceTickMs = now;

    const comoutlEnabled = !!this.roomData.roomOptions?.comoutl;
    const isCommon = player.role === 'common';
    const isLover = player.role === 'lovers';

    // 共生者/戀人夜晚對話：comoutl 控制其他玩家是否能看到「悄悄話」提示
    if ((isCommon || isLover) && this.roomData.dayNight === 'night' && !comoutlEnabled) {
      // comoutl 關閉：共生者夜晚對話僅限共生者/戀人/GM 可見
      const recipients: string[] = [];
      for (const [name, p] of this.roomData.players) {
        if (p.role === 'common' || p.role === 'lovers' || p.role === 'GM') {
          recipients.push(name);
        }
      }
      if (recipients.length === 0) return;

      const message: Message = {
        id: `${Date.now()}-${Math.random()}`,
        roomNo: this.roomData.roomNo,
        date: this.roomData.date,
        location: 'night common',
        uname,
        handleName: player.handleName,
        sentence: text,
        fontType: fontType as any,
        time: Date.now()
      };

      try {
        // @ts-ignore
        await this.env.DB.prepare(
          'INSERT INTO talk (room_no, date, location, uname, handle_name, sentence, font_type, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          this.roomData.roomNo, this.roomData.date, 'night common',
          uname, player.handleName, text, fontType, Math.floor(Date.now() / 1000)
        ).run();
      } catch (e) {
        console.error('DB error:', e);
      }

      const data = JSON.stringify({ type: 'message', data: message });
      for (const r of recipients) {
        const ws = this.sessions.get(r);
        if (ws) {
          try { ws.send(data); } catch (_e) { this.sessions.delete(r); }
        }
      }
      await this.advanceGameTime(1);
      return;
    }

    if ((isCommon || isLover) && this.roomData.dayNight === 'night' && comoutlEnabled) {
      // comoutl 開啟：共生者/戀人看到完整內容，其他玩家看到「悄悄話...」
      const message: Message = {
        id: `${Date.now()}-${Math.random()}`,
        roomNo: this.roomData.roomNo,
        date: this.roomData.date,
        location: 'night common',
        uname,
        handleName: player.handleName,
        sentence: text,
        fontType: fontType as any,
        time: Date.now()
      };

      try {
        // @ts-ignore
        await this.env.DB.prepare(
          'INSERT INTO talk (room_no, date, location, uname, handle_name, sentence, font_type, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          this.roomData.roomNo, this.roomData.date, 'night common',
          uname, player.handleName, text, fontType, Math.floor(Date.now() / 1000)
        ).run();
      } catch (e) {
        console.error('DB error:', e);
      }

      // 發送完整訊息給共生者/戀人/GM
      const fullData = JSON.stringify({ type: 'message', data: message });
      // 發送「悄悄話...」提示給其他存活玩家
      const whisperData = JSON.stringify({
        type: 'night_whisper',
        data: { role: isCommon ? 'common' : 'lovers' }
      });

      for (const [name, p] of this.roomData.players) {
        const ws = this.sessions.get(name);
        if (!ws) continue;
        try {
          if (p.role === 'common' || p.role === 'lovers' || p.role === 'GM') {
            ws.send(fullData);
          } else if (p.live === 'live') {
            ws.send(whisperData);
          }
        } catch (_e) {
          this.sessions.delete(name);
        }
      }
      await this.advanceGameTime(1);
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

    const voteMeEnabled = !!this.roomData.roomOptions?.voteMe;
    if (!canVoteTarget(this.roomData.players, uname, targetUname, voteMeEnabled)) {
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

      // 廣播投票更新（依 voteDisplay/openVote 模式過濾）
      const voteDisplayMode = resolveVoteDisplayMode(
        this.roomData.roomOptions?.voteDisplay,
        this.roomData.roomOptions?.openVote
      );
      const displayInfo = filterVoteDisplay(this.voteData, voteDisplayMode);

      const showVoteProgress = this.roomData.roomOptions?.votedisplay === true;
      this.broadcast({
        type: 'vote_update',
        data: {
          uname,
          target: targetUname,
          voteCounts: displayInfo.showResults ? displayInfo.voteCounts : [],
          voterMap: displayInfo.voterMap ?? undefined,
          showResults: displayInfo.showResults,
          votedUsers: showVoteProgress ? getVotedUsers(this.voteData, ['dummy_boy']) : undefined,
        }
      });

      // 檢查投票是否完成（legacy parity：排除 GM）
      const voteParticipants = getDayVoteParticipants(this.roomData.players);
      if (isVoteComplete(this.voteData, voteParticipants)) {
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
          const validWolfTarget = canWolfKillTarget(
            this.roomData.players,
            uname,
            target,
            this.roomData.date,
            this.roomData.roomOptions?.dummyBoy === true,
          );
          if (!validWolfTarget) {
            return;
          }
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
      case 'fosi_divine':
        if (target) {
          const result = fosiDivine(this.nightState, this.roomData.players, uname, target);
          if (result) {
            const ws = this.sessions.get(uname);
            if (ws) {
              ws.send(JSON.stringify({
                type: 'divine_result',
                data: { target, result, source: 'fosi' }
              }));
            }
          }
        }
        break;
      case 'cat_resurrect':
        if (target) {
          catResurrect(this.nightState, this.roomData.players, uname, target);
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
   * 開始遊戲（legacy parity：等待中先投 GAMESTART，同步 votedisplay 進度）
   */
  private async handleStartGame(uname: string) {
    if (this.roomData.status !== 'waiting') {
      return;
    }

    const waitingPlayers = Array.from(this.roomData.players.values())
      .filter(p => p.live === 'live' && p.uname !== 'dummy_boy');
    if (!waitingPlayers.some(p => p.uname === uname)) {
      return;
    }

    const waitingUsers = waitingPlayers.map(p => p.uname);
    const voters = this.getStartGameVoters();
    voters.add(uname);

    const startVoteState = buildStartGameVoteState(Array.from(voters), waitingUsers);
    this.setStartGameVoters(new Set(startVoteState.votedUsers));

    const showStartVoteProgress = this.roomData.roomOptions?.votedisplay === true;
    if (showStartVoteProgress) {
      this.broadcast({
        type: 'start_game_vote_update',
        data: {
          votedUsers: startVoteState.votedUsers,
          votedCount: startVoteState.votedCount,
          totalRequired: startVoteState.totalRequired,
        }
      });
    }

    await this.saveState();

    if (!startVoteState.ready) {
      return;
    }

    await this.startGameNow();
  }

  private getStartGameVoters(): Set<string> {
    const arr = ((this.roomData as any)._startGameVoters as string[] | undefined) || [];
    return new Set(arr);
  }

  private setStartGameVoters(voters: Set<string>) {
    (this.roomData as any)._startGameVoters = Array.from(voters);
  }

  private clearStartGameVoters() {
    delete (this.roomData as any)._startGameVoters;
  }

  private async startGameNow() {
    const players = Array.from(this.roomData.players.values());

    // 隨機分配角色（wishRole 啟用時，優先滿足玩家希望角色）
    const roleConfig = this.parseRoleConfig(this.roomData.optionRole);
    assignRoles(players, roleConfig, {
      wishRoleEnabled: this.roomData.roomOptions?.wishRole === true,
    });

    // legacy parity: 只有同時啟用 as_gm(gmEnabled) + 指定 gm:trip，才會指派 GM
    const gmEnabled = this.roomData.roomOptions?.gmEnabled === true;
    const gmTrip = ((this.roomData as any).gmTrip as string | undefined)?.trim();
    if (gmEnabled && gmTrip) {
      const gmPlayer = players.find(p => (p.trip || '').trim() === gmTrip);
      if (gmPlayer) {
        gmPlayer.role = 'GM';
      }
    }

    const success = startGame(this.roomData);
    if (!success) {
      return;
    }

    this.clearStartGameVoters();

    // custDummy / dummyBoy: 啟用啞巴男時建立啞巴男玩家
    if (this.roomData.roomOptions?.dummyBoy) {
      const custDummy = !!this.roomData.roomOptions?.custDummy;
      const dummyPlayer = createDummyBoyPlayer(
        this.roomData.roomNo,
        custDummy,
        this.roomData.roomOptions?.dummyCustomLastWords,
        this.roomData.roomOptions?.dummyCustomName,
      );
      this.roomData.players.set('dummy_boy', dummyPlayer);
    }

    // istrip: 如果啟用，驗證所有玩家都有 trip（在 startGame 時檢查）
    if (this.roomData.roomOptions?.istrip) {
      const noTripPlayers = Array.from(this.roomData.players.values())
        .filter(p => p.uname !== 'dummy_boy' && !p.trip);
      if (noTripPlayers.length > 0) {
        console.warn(`[Room ${this.roomData.roomNo}] istrip enabled but ${noTripPlayers.length} players have no trip`);
      }
    }

    if (this.roomData.roomOptions?.realTime) {
      (this.roomData as any)._phaseStartTimeMs = Date.now();
    }
    delete (this.roomData as any)._dayTimeoutAtMs;
    (this.roomData as any)._isSilence = false;
    (this.roomData as any)._lastMessageTimeMs = Date.now();
    delete (this.roomData as any)._lastSilenceTickMs;

    this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);
    this.maybeRunDummyBoyAI('day');

    for (const [playerUname, ws] of this.sessions) {
      const player = this.roomData.players.get(playerUname);
      if (player && ws) {
        ws.send(JSON.stringify({
          type: 'game_start',
          data: {
            role: player.role,
            roomOptions: this.roomData.roomOptions || {},
            players: this.getVisiblePlayersFor(playerUname),
          }
        }));
      }
    }

    await this.saveState();

    try {
      const { StatsManager } = await import('../utils/stats-manager');
      const statsManager = new StatsManager(this.env.KV);
      await statsManager.recordGameStart();
      await statsManager.updateActivePlayerCount(this.roomData.players.size);
    } catch (e) {
      console.error('Stats update error:', e);
    }

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
    this.pushPlayersUpdate();

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
   * - realTime: 由實際秒數到期驅動
   * - 非 realTime: 由發言單位 + silence 加速驅動
   * - day timeout: 進入 sudden-death grace window（預設 120 秒）後才結算突然死
   */
  private async advanceGameTime(units: number) {
    if (this.roomData.status !== 'playing' || (this.roomData.dayNight !== 'day' && this.roomData.dayNight !== 'night')) {
      return;
    }

    const now = Date.now();
    let changed = false;

    const realTimeEnabled = !!this.roomData.roomOptions?.realTime;
    const silenceModeEnabled = !!this.roomData.roomOptions?.silenceMode;

    // 非 realTime 且啟用 silence 時，由 alarm tick 補推進度
    if (!realTimeEnabled && silenceModeEnabled) {
      const lastMessageTimeMs = ((this.roomData as any)._lastMessageTimeMs as number | undefined)
        || this.roomData.lastUpdated
        || this.roomData.uptime
        || now;

      const state = {
        date: this.roomData.date,
        dayNight: this.roomData.dayNight,
        timeSpent: this.roomData.timeSpent || 0,
        lastMessageTime: lastMessageTimeMs,
        isSilence: !!(this.roomData as any)._isSilence,
        phaseStartTimeMs: (this.roomData as any)._phaseStartTimeMs || this.roomData.uptime || now,
      };

      if (checkSilence(state, now, DEFAULT_TIME_CONFIG)) {
        const lastTickMs = ((this.roomData as any)._lastSilenceTickMs as number | undefined) || lastMessageTimeMs;
        const silenceUnits = advanceSilenceTime(state, now - lastTickMs, DEFAULT_TIME_CONFIG);
        if (silenceUnits > 0) {
          units += silenceUnits;
          changed = true;
        }
        (this.roomData as any)._lastSilenceTickMs = now;
      }

      (this.roomData as any)._isSilence = state.isSilence;
    }

    let expired = false;
    if (realTimeEnabled) {
      const timeState = {
        dayNight: this.roomData.dayNight,
        phaseStartTimeMs: (this.roomData as any)._phaseStartTimeMs || this.roomData.uptime || now,
      };
      const timeConfig = {
        ...DEFAULT_TIME_CONFIG,
        realTimeDayLimitSec: this.roomData.roomOptions?.realTimeDayLimitSec || this.roomData.roomOptions?.timeLimit || 300,
        realTimeNightLimitSec: this.roomData.roomOptions?.realTimeNightLimitSec || Math.floor((this.roomData.roomOptions?.timeLimit || 300) * 0.5),
      };
      expired = isRealTimeExpired(timeState, timeConfig);
    } else {
      if (units > 0) {
        this.roomData.timeSpent = (this.roomData.timeSpent || 0) + units;
        changed = true;
      }
      const limit = this.roomData.dayNight === 'day'
        ? DEFAULT_TIME_CONFIG.dayLimit
        : DEFAULT_TIME_CONFIG.nightLimit;
      expired = (this.roomData.timeSpent || 0) >= limit;
    }

    if (expired) {
      if (this.roomData.dayNight === 'day') {
        const dayTimeoutAtMs = (this.roomData as any)._dayTimeoutAtMs as number | undefined;
        if (!dayTimeoutAtMs) {
          (this.roomData as any)._dayTimeoutAtMs = now;
          changed = true;
          this.broadcast({
            type: 'system',
            data: { message: '⏰ 白天時間到，120 秒內未投票者將突然死亡' }
          });
        }

        if (shouldTriggerSuddenDeath('day', (this.roomData as any)._dayTimeoutAtMs, now)) {
          await this.transitionPhase();
          return;
        }
      } else {
        await this.transitionPhase();
        return;
      }
    }

    if (changed) {
      await this.saveState();
    }
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
   * 異議系統（legacy objection 核心）
   */
  private async handleObjection(uname: string) {
    if (this.roomData.status !== 'playing' || this.roomData.dayNight === 'night') {
      return;
    }

    const player = this.roomData.players.get(uname);
    if (!player || player.live !== 'live') {
      return;
    }

    const MAX_OBJECTION = 2;
    const objectionMap = ((this.roomData as any)._objectionCounts || {}) as Record<string, number>;
    const current = objectionMap[uname] || 0;
    if (current >= MAX_OBJECTION) {
      const ws = this.sessions.get(uname);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'system',
          data: { message: `異議次數已達上限（${MAX_OBJECTION}）` }
        }));
      }
      return;
    }

    objectionMap[uname] = current + 1;
    (this.roomData as any)._objectionCounts = objectionMap;

    this.broadcast({
      type: 'system',
      data: { message: `❗ ${player.handleName} 提出異議！` }
    });

    this.broadcast({
      type: 'objection_update',
      data: {
        uname,
        count: objectionMap[uname],
        left: Math.max(0, MAX_OBJECTION - objectionMap[uname]),
      }
    });

    await this.saveState();
  }

  /**
   * 套用戀人連帶死亡（殉情）
   */
  private applyLoversChainDeath(initialDead: Player[]): Player[] {
    const chainVictims = getLoverChainVictims(
      this.roomData.players,
      initialDead.map(p => p.uname)
    );

    if (chainVictims.length === 0) {
      return [];
    }

    const now = Date.now();
    for (const p of chainVictims) {
      p.live = 'dead';
      (p as any).death = now;
    }

    this.broadcast({
      type: 'system',
      data: { message: `💔 戀人殉情：${chainVictims.map(p => p.handleName).join('、')}` }
    });

    return chainVictims;
  }

  /**
   * 日間毒系（poison/cat）被處決時，反噴一名存活玩家（不含自身/dummy/GM）
   */
  private applyDayPoisonRetaliation(deadPlayers: Player[]): Player[] {
    const hasPoisonTrigger = deadPlayers.some(
      p => p.role === 'poison' || p.role === 'cat'
    );
    if (!hasPoisonTrigger) {
      return [];
    }

    const excluded = new Set(deadPlayers.map(p => p.uname));
    const candidates = Array.from(this.roomData.players.values()).filter(
      p => p.live === 'live' &&
        !excluded.has(p.uname) &&
        p.uname !== 'dummy_boy' &&
        p.role !== 'GM'
    );

    if (candidates.length === 0) {
      return [];
    }

    const idx = Math.floor(Math.random() * candidates.length);
    const victim = candidates[idx];
    if (!victim || victim.live !== 'live') {
      return [];
    }

    victim.live = 'dead';
    (victim as any).death = Date.now();

    this.broadcast({
      type: 'system',
      data: { message: `☠️ 毒系反噴：${victim.handleName}` }
    });

    return [victim];
  }

  /**
   * 妖狐全滅時，背德者連帶死亡
   */
  private applyBetrayerCollapseOnFoxExtinction(): Player[] {
    const victims = getBetrayerCollapseVictims(this.roomData.players);
    if (victims.length === 0) {
      return [];
    }

    const now = Date.now();
    for (const p of victims) {
      p.live = 'dead';
      (p as any).death = now;
    }

    this.broadcast({
      type: 'system',
      data: { message: `🦊 妖狐全滅，背德者殉滅：${victims.map(p => p.handleName).join('、')}` }
    });

    return victims;
  }

  /**
   * 日間超時後的突然死（core）：未投票存活者直接死亡
   */
  private async applySuddenDeathForNoVote() {
    if (!this.voteData || this.roomData.dayNight !== 'day') {
      return;
    }

    const votedUsers = new Set(getVotedUsers(this.voteData));
    const suddenDead = Array.from(this.roomData.players.values())
      .filter(p => p.live === 'live')
      .filter(p => p.uname !== 'dummy_boy')
      .filter(p => p.role !== 'GM')
      .filter(p => !votedUsers.has(p.uname));

    if (suddenDead.length === 0) {
      return;
    }

    const now = Date.now();
    for (const p of suddenDead) {
      p.live = 'dead';
      (p as any).death = now;
    }

    const loversChain = this.applyLoversChainDeath(suddenDead);
    const betrayerCollapse = this.applyBetrayerCollapseOnFoxExtinction();
    const collapseLoversChain = this.applyLoversChainDeath(betrayerCollapse);
    const allDead = [...suddenDead, ...loversChain, ...betrayerCollapse, ...collapseLoversChain];

    this.broadcast({
      type: 'system',
      data: { message: `⚠️ 未投票者突然死：${suddenDead.map(p => p.handleName).join('、')}` }
    });
    this.broadcast({
      type: 'players_died',
      data: allDead.map(p => ({ uname: p.uname, handleName: p.handleName }))
    });
    this.pushPlayersUpdate();
  }

  /**
   * dummy_boy 簡易 AI（發言 + 白天自動投票）
   */
  private maybeRunDummyBoyAI(phase: 'day' | 'night') {
    const dummy = this.roomData.players.get('dummy_boy');
    if (!dummy || dummy.live !== 'live') {
      return;
    }

    const linesDay = ['我只是個替身…', '今天也要努力活著。', '大家冷靜投票喔。'];
    const linesNight = ['夜深了…', '我先睡一下。', '晚安，各位。'];
    const sentence = phase === 'day'
      ? linesDay[Math.floor(Math.random() * linesDay.length)]
      : linesNight[Math.floor(Math.random() * linesNight.length)];

    const msg: Message = {
      id: `${Date.now()}-${Math.random()}`,
      roomNo: this.roomData.roomNo,
      date: this.roomData.date,
      location: this.roomData.dayNight,
      uname: dummy.uname,
      handleName: dummy.handleName,
      sentence,
      fontType: 'normal',
      time: Date.now(),
    };
    this.broadcast({ type: 'message', data: msg });

    if (phase !== 'day' || !this.voteData || this.voteData.votes.has('dummy_boy')) {
      return;
    }

    const voteCandidates = Array.from(this.roomData.players.values())
      .filter(p => p.live === 'live')
      .filter(p => p.uname !== 'dummy_boy')
      .filter(p => p.role !== 'GM');

    if (voteCandidates.length === 0) {
      return;
    }

    const target = voteCandidates[Math.floor(Math.random() * voteCandidates.length)];
    if (!target) {
      return;
    }

    const success = addVote(this.voteData, 'dummy_boy', target.uname);
    if (!success) {
      return;
    }

    const voteDisplayMode = resolveVoteDisplayMode(
      this.roomData.roomOptions?.voteDisplay,
      this.roomData.roomOptions?.openVote
    );
    const displayInfo = filterVoteDisplay(this.voteData, voteDisplayMode);
    const showVoteProgress = this.roomData.roomOptions?.votedisplay === true;

    this.broadcast({
      type: 'vote_update',
      data: {
        uname: 'dummy_boy',
        target: target.uname,
        voteCounts: displayInfo.showResults ? displayInfo.voteCounts : [],
        voterMap: displayInfo.voterMap ?? undefined,
        showResults: displayInfo.showResults,
        votedUsers: showVoteProgress ? getVotedUsers(this.voteData, ['dummy_boy']) : undefined,
      }
    });
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
    // 即時制：記錄新階段的開始時間
    if (this.roomData.roomOptions?.realTime) {
      (this.roomData as any)._phaseStartTimeMs = Date.now();
    }

    delete (this.roomData as any)._dayTimeoutAtMs;
    (this.roomData as any)._isSilence = false;
    delete (this.roomData as any)._lastSilenceTickMs;

    if (this.roomData.dayNight === 'day') {
      // 白天超時：先處理突然死，再結算投票
      await this.applySuddenDeathForNoVote();
      if (this.voteData) {
        await this.processVoteResult();
        return;
      }

      // 無投票資料時才直接進夜晚
      this.roomData.dayNight = 'night';
      this.roomData.timeSpent = 0;
      (this.roomData as any)._lastMessageTimeMs = Date.now();
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
      (this.roomData as any)._revoteCount = 0;
      (this.roomData as any)._lastMessageTimeMs = Date.now();

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
        const loversChain = this.applyLoversChainDeath(dead);
        const betrayerCollapse = this.applyBetrayerCollapseOnFoxExtinction();
        const collapseLoversChain = this.applyLoversChainDeath(betrayerCollapse);
        const allDead = [...dead, ...loversChain, ...betrayerCollapse, ...collapseLoversChain];
        if (allDead.length > 0) {
          this.broadcast({
            type: 'players_died',
            data: allDead.map(p => ({ uname: p.uname, handleName: p.handleName }))
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
   * voteDisplay 控制投票資訊的廣播內容
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
      const REVOTE_DRAW_LIMIT = 10;
      const revoteCount = ((this.roomData as any)._revoteCount || 0) + 1;
      (this.roomData as any)._revoteCount = revoteCount;

      if (revoteCount >= REVOTE_DRAW_LIMIT) {
        this.broadcast({
          type: 'vote_tie',
          data: {
            message: `投票連續平手 ${REVOTE_DRAW_LIMIT} 次，判定平局。`
          }
        });
        await this.endGame('draw');
        return;
      }

      // 平手處理 → 重新投票
      this.broadcast({
        type: 'vote_tie',
        data: {
          message: `投票平手！需要重新投票...（${revoteCount}/${REVOTE_DRAW_LIMIT}）`
        }
      });

      // 建立新的投票資料讓玩家重新投票
      this.voteData = createVoteData(this.roomData.roomNo, this.roomData.date);
      await this.saveState();
      return;
    }

    // 有明確處決結果時，重置日內平票累積
    (this.roomData as any)._revoteCount = 0;

    // voteDisplay/openVote: 根據模式過濾投票結果廣播
    const voteDisplayMode = resolveVoteDisplayMode(
      this.roomData.roomOptions?.voteDisplay,
      this.roomData.roomOptions?.openVote
    );
    const displayInfo = filterVoteDisplay(voteData, voteDisplayMode);

    const loversChain = this.applyLoversChainDeath(result.executed);
    const poisonRetaliation = this.applyDayPoisonRetaliation([...result.executed, ...loversChain]);
    const retaliationLoversChain = this.applyLoversChainDeath(poisonRetaliation);
    const betrayerCollapse = this.applyBetrayerCollapseOnFoxExtinction();
    const collapseLoversChain = this.applyLoversChainDeath(betrayerCollapse);
    const executedPlayers = [
      ...result.executed,
      ...loversChain,
      ...poisonRetaliation,
      ...retaliationLoversChain,
      ...betrayerCollapse,
      ...collapseLoversChain,
    ];

    if (executedPlayers.length > 0) {
      this.broadcast({
        type: 'players_executed',
        data: executedPlayers.map(p => ({ uname: p.uname, handleName: p.handleName })),
        // 附加 voteDisplay 資訊
        voteDisplay: displayInfo.showResults ? {
          voteCounts: displayInfo.voteCounts,
          voterMap: displayInfo.voterMap,
        } : undefined,
      });
      this.pushPlayersUpdate();
    }

    // 記錄處決事件
    for (const p of executedPlayers) {
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
    await this.enterNightPhase();
  }

  /**
   * 進入夜晚階段（共用邏輯）
   */
  private async enterNightPhase() {
    // 即時制：記錄夜晚開始時間
    if (this.roomData.roomOptions?.realTime) {
      (this.roomData as any)._phaseStartTimeMs = Date.now();
    }

    this.roomData.dayNight = 'night';
    this.roomData.timeSpent = 0;
    delete (this.roomData as any)._dayTimeoutAtMs;
    (this.roomData as any)._isSilence = false;
    (this.roomData as any)._lastMessageTimeMs = Date.now();
    delete (this.roomData as any)._lastSilenceTickMs;
    this.nightState = createNightState(this.roomData.roomNo, this.roomData.date);
    this.broadcast({
      type: 'phase_change',
      data: {
        phase: 'night',
        message: '夜幕降臨，請關閉燈光...'
      }
    });
    this.maybeRunDummyBoyAI('night');

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
    const loversChain = this.applyLoversChainDeath(dead);
    const betrayerCollapse = this.applyBetrayerCollapseOnFoxExtinction();
    const collapseLoversChain = this.applyLoversChainDeath(betrayerCollapse);
    const allDead = [...dead, ...loversChain, ...betrayerCollapse, ...collapseLoversChain];

    if (allDead.length > 0) {
      this.broadcast({
        type: 'players_died',
        data: allDead.map(p => ({ uname: p.uname, handleName: p.handleName }))
      });
      this.pushPlayersUpdate();

      // 記錄死亡事件到 D1
      for (const p of allDead) {
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
    (this.roomData as any)._revoteCount = 0;

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
    this.maybeRunDummyBoyAI('day');
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

      const winnerLabelMap: Record<string, string> = {
        human: '村民',
        wolf: '狼人',
        fox: '妖狐',
        betr: '背德者',
        lovers: '戀人',
        draw: '平局',
      };
      const winnerLabel = winnerLabelMap[winner] || winner;

      // @ts-ignore
      await this.env.DB.prepare(`
        INSERT INTO game_logs (room_no, room_name, winner, total_days, player_count, roles, death_order, key_events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_no) DO UPDATE SET
          winner = ?, total_days = ?, death_order = ?, key_events = ?
      `).bind(
        this.roomData.roomNo, this.roomData.roomName, winner,
        this.roomData.date, players.length, roles, deathOrder || '',
        `${winnerLabel}陣營勝利`, Date.now(),
        winner, this.roomData.date, deathOrder || '',
        `${winnerLabel}陣營勝利`
      ).run();

      // 更新每位玩家的 trip_scores
      const winnerTeam: 'human' | 'wolf' | 'fox' | null =
        (winner.includes('wolf') || winner === 'mad') ? 'wolf'
          : (winner.includes('fox') || winner === 'betr') ? 'fox'
            : (winner === 'human' || winner === 'lovers') ? 'human'
              : null;

      const playerCount = players.length;
      const is22p = playerCount === 22;
      const is30p = playerCount === 30;

      for (const player of players) {
        const trip = player.trip;
        if (!trip) continue;

        const playerTeam = getRoleTeam(player.role);
        const playerWon = winnerTeam !== null && playerTeam === winnerTeam;
        const survived = player.live === 'live';
        const winScore = winnerTeam === 'wolf' ? 15 : winnerTeam === 'fox' ? 20 : winnerTeam === 'human' ? 10 : 0;

        // @ts-ignore
        await this.env.DB.prepare(`
          INSERT INTO trip_scores (
            trip, score, games_played, human_wins, wolf_wins, fox_wins,
            total_games, survivor_count, games_22p, wins_22p, games_30p, wins_30p,
            role_history, last_played
          )
          VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}', ?)
          ON CONFLICT(trip) DO UPDATE SET
            games_played = games_played + 1,
            total_games = total_games + 1,
            score = score + ?,
            human_wins = human_wins + ?,
            wolf_wins = wolf_wins + ?,
            fox_wins = fox_wins + ?,
            survivor_count = survivor_count + ?,
            games_22p = games_22p + ?,
            wins_22p = wins_22p + ?,
            games_30p = games_30p + ?,
            wins_30p = wins_30p + ?,
            last_played = ?
        `).bind(
          trip, Date.now(),
          (playerWon ? winScore : 0) + (survived ? 5 : 0),
          (winnerTeam === 'human' && playerWon) ? 1 : 0,
          (winnerTeam === 'wolf' && playerWon) ? 1 : 0,
          (winnerTeam === 'fox' && playerWon) ? 1 : 0,
          survived ? 1 : 0,
          is22p ? 1 : 0,
          (is22p && playerWon) ? 1 : 0,
          is30p ? 1 : 0,
          (is30p && playerWon) ? 1 : 0,
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

  private getVisiblePlayersFor(viewerUname: string) {
    return sanitizePlayersForViewer(this.roomData.players, viewerUname, {
      roomStatus: this.roomData.status,
      dellookEnabled: (this.roomData.roomOptions?.dellook ?? 0) === 1,
    });
  }

  private pushPlayersUpdate() {
    for (const [viewerUname, ws] of this.sessions) {
      try {
        ws.send(JSON.stringify({
          type: 'players_update',
          data: {
            players: this.getVisiblePlayersFor(viewerUname),
          },
        }));
      } catch {
        this.sessions.delete(viewerUname);
      }
    }
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
    const baseRoles = this.getRoleTable(this.roomData.maxUser || 22);
    return buildRoleConfig(
      baseRoles,
      config,
      this.roomData.maxUser || 22,
      this.roomData.roomOptions
    );
  }
}
