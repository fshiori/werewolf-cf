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
import { assignRoles, checkVictory, canSpeak, getRoleTeam } from '../utils/role-system';
import { createVoteData, addVote, getVoteResult, executeVote, isVoteComplete } from '../utils/vote-system';
import { createNightState, wolfKill, seerDivine, processNightResult, getNightSummary, isNightActionsComplete } from '../utils/night-action';
import { createSessionManager, type SessionValue } from '../utils/session-manager';

export class WerewolfRoom extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  private sessionManager: any;
  private roomData: RoomData;
  private voteData?: any;
  private nightState?: any;
  // @ts-ignore - ctx is a DurableObject property
  private storage = this.ctx.storage;

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

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/ws') {
      return this.handleWebSocket(req);
    }

    if (path === '/info') {
      return Response.json(getPublicRoomInfo(this.roomData));
    }

    if (path === '/init' && req.method === 'POST') {
      return this.initialize(req);
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
    };

    this.roomData = createRoom({
      roomNo: data.roomNo,
      roomName: data.roomName,
      roomComment: data.roomComment,
      maxUser: data.maxUser || 16,
      gameOption: data.gameOption || '',
      optionRole: data.optionRole || ''
    });

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
      case 'start_game':
        await this.handleStartGame(uname);
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

    // 隨機分配角色
    const players = Array.from(this.roomData.players.values());
    const roleConfig = this.parseRoleConfig(this.roomData.optionRole);
    assignRoles(players, roleConfig);

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
  }

  /**
   * 推進遊戲時間
   */
  private async advanceGameTime(units: number) {
    const shouldTransition = advanceTime(
      { ...this.roomData } as any,
      units,
      DEFAULT_TIME_CONFIG
    );

    if (shouldTransition) {
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
      this.nightState = createNightState(this.roomData.roomNo, this.roomData.date);

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'night',
          message: '夜幕降临，请关闭灯光...'
        }
      });
    } else {
      // 夜晚 → 白天
      this.roomData.dayNight = 'day';
      this.roomData.date++;

      const summary = this.nightState ? getNightSummary(this.nightState) : '昨晚是平安夜';

      this.broadcast({
        type: 'phase_change',
        data: {
          phase: 'day',
          date: this.roomData.date,
          message: `天亮了...${summary}`
        }
      });

      // 處理夜晚結果
      if (this.nightState) {
        const dead = processNightResult(this.nightState, this.roomData.players);
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
   */
  private async processVoteResult() {
    if (!this.voteData) {
      return;
    }

    const executed = executeVote(this.voteData, this.roomData.players);

    if (executed.length > 0) {
      this.broadcast({
        type: 'players_executed',
        data: executed.map(p => ({ uname: p.uname, handleName: p.handleName }))
      });
    }

    // 檢查勝負
    const victory = checkVictory(Array.from(this.roomData.players.values()));
    if (victory) {
      await this.endGame(victory);
      return;
    }

    // 投票結束 → 進入夜晚
    this.roomData.dayNight = 'night';
    this.nightState = createNightState(this.roomData.roomNo, this.roomData.date);
    this.broadcast({
      type: 'phase_change',
      data: {
        phase: 'night',
        message: '夜幕降临，请关闭灯光...'
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

    const dead = processNightResult(this.nightState, this.roomData.players);

    if (dead.length > 0) {
      this.broadcast({
        type: 'players_died',
        data: dead.map(p => ({ uname: p.uname, handleName: p.handleName }))
      });
    }

    // 轉換到白天
    await this.transitionPhase();
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
        message: winner === 'human' ? '村民陣營勝利！' : '狼人陣營勝利！'
      }
    });

    await this.saveState();
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
    }

    // 確保 human 至少為 0
    if (roleConfig.human === undefined) {
      roleConfig.human = 0;
    }

    return roleConfig as Record<Role, number>;
  }
}
