/**
 * Durable Object - 房間系統
 * 每個房間是一個獨立的 Durable Object，管理 WebSocket 連線和遊戲狀態
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env, Player, RoomData, Message, GamePhase, RoomStatus } from '../types';

export class Room extends WorkerEntrypoint<Env> {
  private sessions: Map<string, WebSocket> = new Map();
  private roomData: RoomData;
  private storage = this.ctx.storage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.roomData = {
      roomNo: 0,
      roomName: '',
      roomComment: '',
      maxUser: 16,
      gameOption: '',
      optionRole: '',
      status: 'waiting',
      date: 1,
      dayNight: 'beforegame',
      players: new Map(),
      messages: [],
      timeSpent: 0,
      uptime: Date.now(),
      lastUpdated: Date.now(),
      dellook: 0
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // 處理 WebSocket 升級
    if (path === '/ws') {
      return this.handleWebSocket(req);
    }

    // API 路由
    switch (req.method) {
      case 'GET':
        if (path === '/info') {
          return Response.json(this.getPublicInfo());
        }
        break;
      case 'POST':
        if (path === '/init') {
          return this.initialize(req);
        }
        break;
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  /**
   * 初始化房間
   */
  private async initialize(req: Request): Promise<Response> {
    const data = await req.json<{
      roomNo: number;
      roomName: string;
      roomComment: string;
      maxUser: number;
      gameOption: string;
      optionRole: string;
    }>();

    this.roomData = {
      ...this.roomData,
      ...data,
      status: 'waiting',
      date: 1,
      dayNight: 'beforegame',
      players: new Map(),
      messages: [],
      timeSpent: 0,
      uptime: Date.now(),
      lastUpdated: Date.now()
    };

    await this.saveState();

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

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // 從 URL 獲取 session token
    const url = new URL(req.url);
    const sessionToken = url.searchParams.get('session');

    if (!sessionToken) {
      server.close(1008, 'No session token');
      return new Response(null, { status: 101, webSocket: client });
    }

    // 驗證 session 並獲取用戶資訊
    const player = await this.validateSession(sessionToken);
    if (!player) {
      server.close(1008, 'Invalid session');
      return new Response(null, { status: 101, webSocket: client });
    }

    // 保存連線
    this.sessions.set(player.uname, server);

    // 發送初始資料
    server.send(JSON.stringify({
      type: 'connected',
      data: {
        room: this.getPublicInfo(),
        player: this.getPlayerInfo(player.uname)
      }
    }));

    // 監聽訊息
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleClientMessage(player.uname, data);
      } catch (e) {
        console.error('Message parse error:', e);
      }
    });

    // 處理斷線
    server.addEventListener('close', async () => {
      this.sessions.delete(player.uname);
      await this.handlePlayerDisconnect(player.uname);
    });

    // 處理錯誤
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * 驗證 Session
   */
  private async validateSession(token: string): Promise<Player | null> {
    // 從 KV 驗證
    const sessionData = await this.env.KV.get(`session:${token}`, 'json');
    if (!sessionData) return null;

    const session = sessionData as { uname: string; roomNo: number };
    if (session.roomNo !== this.roomData.roomNo) return null;

    const player = this.roomData.players.get(session.uname);
    if (!player) return null;

    return player;
  }

  /**
   * 處理客戶端訊息
   */
  private async handleClientMessage(uname: string, data: any) {
    const player = this.roomData.players.get(uname);
    if (!player || player.live !== 'live') {
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
      case 'game_start':
        await this.startGame();
        break;
    }
  }

  /**
   * 處理發言
   */
  private async handleSay(uname: string, text: string, fontType: string) {
    const player = this.roomData.players.get(uname);
    if (!player || player.live !== 'live') return;

    // 檢查是否可以說話
    if (this.roomData.status !== 'playing') return;

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

    // 存入 D1（持久化）
    try {
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
      console.error('Database error:', e);
    }

    // 加入記憶體
    this.roomData.messages.push(message);

    // 廣播給所有人
    this.broadcast({
      type: 'message',
      data: message
    });

    // 更新時間（原版邏輯）
    await this.advanceTime(1);

    // 更新房間更新時間
    this.roomData.lastUpdated = Date.now();
    await this.saveState();
  }

  /**
   * 處理投票
   */
  private async handleVote(uname: string, targetUname: string) {
    // TODO: 實作投票邏輯
    this.broadcast({
      type: 'system',
      data: {
        message: `${uname} 投票給 ${targetUname}`
      }
    });
  }

  /**
   * 處理夜晚行動
   */
  private async handleNightAction(uname: string, action: string, targetUname?: string) {
    const player = this.roomData.players.get(uname);
    if (!player) return;

    // TODO: 實作各種角色的夜晚行動
    this.broadcast({
      type: 'night_action',
      data: {
        action,
        uname,
        target: targetUname
      }
    });
  }

  /**
   * 開始遊戲
   */
  private async startGame() {
    if (this.roomData.status !== 'waiting') return;

    this.roomData.status = 'playing';
    this.roomData.dayNight = 'day';
    this.roomData.date = 1;
    this.roomData.timeSpent = 0;

    await this.saveState();

    this.broadcast({
      type: 'phase_change',
      data: {
        phase: 'day',
        date: 1,
        message: '遊戲開始！天亮了，請開始討論。'
      }
    });
  }

  /**
   * 時間流逝系統
   */
  private async advanceTime(units: number) {
    // 原版邏輯：白天 48 單位 = 12 小時，夜晚 24 單位 = 6 小時
    const limit = this.roomData.dayNight === 'day' ? 48 : 24;
    this.roomData.timeSpent += units;

    // 廣播時間更新
    this.broadcast({
      type: 'time_update',
      data: {
        spent: this.roomData.timeSpent,
        limit,
        phase: this.roomData.dayNight
      }
    });

    // 檢查是否需要切換階段
    if (this.roomData.timeSpent >= limit) {
      await this.transitionPhase();
    }

    await this.saveState();
  }

  /**
   * 階段轉換
   */
  private async transitionPhase() {
    if (this.roomData.dayNight === 'day') {
      // 白天 → 夜晚
      this.roomData.dayNight = 'night';
      this.roomData.timeSpent = 0;

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'night',
          message: '夜幕降临，请关闭灯光...'
        }
      });

      // 10 秒後處理夜晚結果
      setTimeout(() => this.processNightResult(), 10000);
    } else {
      // 夜晚 → 白天
      this.roomData.dayNight = 'day';
      this.roomData.date++;
      this.roomData.timeSpent = 0;

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'day',
          date: this.roomData.date,
          message: '天亮了...'
        }
      });

      // 處理夜晚結果
      await this.processNightResult();
    }

    await this.saveState();
  }

  /**
   * 處理夜晚結果
   */
  private async processNightResult() {
    // TODO: 實作夜晚行動處理（狼人殺人、預言家占卜等）
    this.broadcast({
      type: 'system',
      data: {
        message: '昨晚是平安夜...'
      }
    });

    // 檢查勝負
    const victory = this.checkVictory();
    if (victory) {
      await this.endGame(victory);
    }
  }

  /**
   * 檢查勝負
   */
  private checkVictory(): string | null {
    const players = Array.from(this.roomData.players.values()).filter(p => p.live === 'live');
    const wolves = players.filter(p => p.role.includes('wolf') || p.role === 'mad').length;
    const villagers = players.filter(p => !p.role.includes('wolf') && p.role !== 'mad').length;

    if (wolves === 0) return 'human';
    if (wolves >= villagers) return 'wolf';

    return null;
  }

  /**
   * 遊戲結束
   */
  private async endGame(winner: string) {
    this.roomData.status = 'ended';
    this.roomData.victoryRole = winner;

    await this.saveState();

    this.broadcast({
      type: 'game_over',
      data: {
        winner,
        message: winner === 'human' ? '村民陣營勝利！' : '狼人陣營勝利！'
      }
    });
  }

  /**
   * 處理玩家斷線
   */
  private async handlePlayerDisconnect(uname: string) {
    const player = this.roomData.players.get(uname);
    if (!player) return;

    this.broadcast({
      type: 'user_left',
      data: {
        uname,
        handleName: player.handleName
      }
    });
  }

  /**
   * 廣播訊息給房間內所有人
   */
  private broadcast(message: any) {
    const data = JSON.stringify(message);

    for (const [uname, ws] of this.sessions) {
      try {
        ws.send(data);
      } catch (e) {
        console.error(`Failed to send to ${uname}:`, e);
        this.sessions.delete(uname);
      }
    }
  }

  /**
   * 獲取公開的房間資訊
   */
  private getPublicInfo() {
    return {
      roomNo: this.roomData.roomNo,
      roomName: this.roomData.roomName,
      roomComment: this.roomData.roomComment,
      maxUser: this.roomData.maxUser,
      status: this.roomData.status,
      date: this.roomData.date,
      dayNight: this.roomData.dayNight,
      playerCount: this.roomData.players.size,
      lastUpdated: this.roomData.lastUpdated
    };
  }

  /**
   * 獲取玩家資訊
   */
  private getPlayerInfo(uname: string) {
    const player = this.roomData.players.get(uname);
    if (!player) return null;

    return {
      userNo: player.userNo,
      handleName: player.handleName,
      role: player.role,
      live: player.live,
      iconNo: player.iconNo
    };
  }

  /**
   * 保存狀態到存儲
   */
  private async saveState() {
    await this.storage.put('room', {
      ...this.roomData,
      players: Array.from(this.roomData.players.entries())
    });

    await this.storage.put('uptime', Date.now());
  }
}
