import {
  advancePhaseByAlarm,
  canJoinRoomState,
  canStartGame,
  canUseCommonChannel,
  canUseDeadChannel,
  canUseFoxChannel,
  canUseLoversChannel,
  canUsePublicChat,
  canUseWerewolfChannel,
  castCatRevive,
  castChildFoxDivination,
  castDayVote,
  castDivination,
  castGuard,
  castNightKill,
  commonsForPlayer,
  createLobbyState,
  foxesForPlayer,
  loversForPlayer,
  mediumReadingForPlayer,
  playerStatUpdates,
  setLastWords,
  startGame,
  upsertLobbyPlayer,
  wolvesForPlayer
} from "./game";
import {
  buildActionAckMessage,
  buildChatMessage,
  buildChildFoxResultMessage,
  buildCommonChatMessage,
  buildDeadChatMessage,
  buildDivinationResultMessage,
  buildErrorMessage,
  buildFoxChatMessage,
  buildGameStateMessage,
  buildJoinedMessage,
  buildLastWordsAckMessage,
  buildLoversChatMessage,
  buildMediumResultMessage,
  buildPresenceMessage,
  buildRoleMessage,
  buildWolfChatMessage
} from "./messages";
import type { GameState, RoomMember, RoomOptions } from "./types";
import {
  parseClientMessage,
  validateChatText,
  validateLastWordsText,
  validateNickname,
  validatePlayerId,
  validateRoomId
} from "./validation";

type ConnectionState = {
  playerId: string;
  nickname: string;
};

export class RoomDurableObject {
  private readonly roomId: string;
  private readonly sockets = new Map<WebSocket, ConnectionState>();
  private gameState?: GameState;

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.roomId = this.state.id.name ?? "";
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    validateRoomId(this.roomId);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.handleSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSocket(socket: WebSocket): void {
    socket.accept();
    socket.addEventListener("message", (event) => {
      void this.onMessage(socket, event);
    });
    socket.addEventListener("close", () => this.onClose(socket));
    socket.addEventListener("error", () => this.onClose(socket));
  }

  async alarm(): Promise<void> {
    const game = await this.loadGameState();
    const next = advancePhaseByAlarm(game);
    await this.saveGameState(next);
    await this.syncRoomStatus(next);
    this.broadcastGameState(next);
    this.sendMediumResults(next);
  }

  private async onMessage(socket: WebSocket, event: MessageEvent): Promise<void> {
    try {
      if (typeof event.data !== "string") {
        throw new Error("Invalid message");
      }

      const message = parseClientMessage(event.data);
      if (message.type === "join") {
        if (this.sockets.has(socket)) {
          throw new Error("Socket already joined");
        }
        const playerId = validatePlayerId(message.playerId);
        const nickname = validateNickname(message.nickname);
        const loadedGame = await this.loadGameState();
        if (!canJoinRoomState(loadedGame, playerId)) {
          throw new Error("Game already started");
        }
        this.sockets.set(socket, { playerId, nickname });
        const game = upsertLobbyPlayer(loadedGame, { playerId, nickname });
        await this.saveGameState(game);
        await this.persistJoin(playerId, nickname);
        this.send(socket, buildJoinedMessage(this.roomId, playerId, this.members()));
        this.broadcast(buildPresenceMessage(this.members()));
        this.broadcastGameState(game);
        this.sendRole(socket, game, playerId);
        this.sendMediumResult(socket, game, playerId);
        return;
      }

      const member = this.sockets.get(socket);
      if (!member) {
        throw new Error("Join required");
      }

      if (message.type === "chat") {
        if (!canUsePublicChat(await this.loadGameState(), member.playerId)) {
          throw new Error("Only living players can chat during the game");
        }
        const text = validateChatText(message.text);
        this.broadcast(buildChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "wolf_chat") {
        const game = await this.loadGameState();
        if (!canUseWerewolfChannel(game, member.playerId)) {
          throw new Error("Werewolf channel is only available to living werewolves at night");
        }
        const text = validateChatText(message.text);
        this.broadcastWerewolf(game, buildWolfChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "fox_chat") {
        const game = await this.loadGameState();
        if (!canUseFoxChannel(game, member.playerId)) {
          throw new Error("Fox channel is only available to living foxes at night");
        }
        const text = validateChatText(message.text);
        this.broadcastFox(game, buildFoxChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "common_chat") {
        const game = await this.loadGameState();
        if (!canUseCommonChannel(game, member.playerId)) {
          throw new Error("Common channel is only available to living common partners at night");
        }
        const text = validateChatText(message.text);
        this.broadcastCommon(game, buildCommonChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "lovers_chat") {
        const game = await this.loadGameState();
        if (!canUseLoversChannel(game, member.playerId)) {
          throw new Error("Lovers channel is only available to living lovers at night");
        }
        const text = validateChatText(message.text);
        this.broadcastLovers(game, buildLoversChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "dead_chat") {
        const game = await this.loadGameState();
        if (!canUseDeadChannel(game, member.playerId)) {
          throw new Error("Dead channel is only available to dead players during the game");
        }
        const text = validateChatText(message.text);
        this.broadcastDead(game, buildDeadChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "start_game") {
        const loadedGame = await this.loadGameState();
        if (!canStartGame(loadedGame, member.playerId)) {
          throw new Error("Only the room host can start the game");
        }
        const next = startGame(loadedGame, Date.now(), Math.random, await this.loadRoomOptions());
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        await this.persistRoomEvent(member.playerId, "game_started", { day: next.day, players: next.players.length });
        this.broadcastGameState(next);
        this.sendRoles(next);
        return;
      }

      if (message.type === "set_last_words") {
        if (!(await this.loadRoomOptions()).lastWords) {
          throw new Error("Last words are not enabled in this room");
        }
        const text = validateLastWordsText(message.text);
        const next = setLastWords(await this.loadGameState(), member.playerId, text);
        await this.saveGameState(next);
        this.send(socket, buildLastWordsAckMessage());
        return;
      }

      if (message.type === "vote") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const next = castDayVote(await this.loadGameState(), member.playerId, targetPlayerId);
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        this.send(socket, buildActionAckMessage("vote", targetPlayerId));
        this.broadcastGameState(next);
        return;
      }

      if (message.type === "divine") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const result = castDivination(await this.loadGameState(), member.playerId, targetPlayerId);
        await this.saveGameState(result.state);
        this.send(socket, buildDivinationResultMessage(targetPlayerId, result.targetNickname, result.result));
        return;
      }

      if (message.type === "child_fox_divine") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const result = castChildFoxDivination(await this.loadGameState(), member.playerId, targetPlayerId, Math.random);
        await this.saveGameState(result.state);
        this.send(socket, buildChildFoxResultMessage(targetPlayerId, result.targetNickname, result.result));
        this.send(socket, buildActionAckMessage("child_fox_divine", targetPlayerId));
        return;
      }

      if (message.type === "guard") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const next = castGuard(await this.loadGameState(), member.playerId, targetPlayerId);
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        this.send(socket, buildActionAckMessage("guard", targetPlayerId));
        this.broadcastGameState(next);
        this.sendMediumResults(next);
        return;
      }

      if (message.type === "cat_revive") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const next = castCatRevive(await this.loadGameState(), member.playerId, targetPlayerId);
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        this.send(socket, buildActionAckMessage("cat_revive", targetPlayerId));
        this.broadcastGameState(next);
        this.sendMediumResults(next);
        return;
      }

      const targetPlayerId = validatePlayerId(message.targetPlayerId);
      const next = castNightKill(await this.loadGameState(), member.playerId, targetPlayerId);
      await this.saveGameState(next);
      await this.syncRoomStatus(next);
      this.send(socket, buildActionAckMessage("night_kill", targetPlayerId));
      this.broadcastGameState(next);
      this.sendMediumResults(next);
    } catch (error) {
      this.send(socket, buildErrorMessage(error instanceof Error ? error.message : "Unknown error"));
    }
  }

  private onClose(socket: WebSocket): void {
    const hadSocket = this.sockets.delete(socket);
    if (hadSocket) {
      this.broadcast(buildPresenceMessage(this.members()));
    }
  }

  private members(): RoomMember[] {
    return Array.from(this.sockets.values()).map((member) => ({
      playerId: member.playerId,
      nickname: member.nickname
    }));
  }

  private send(socket: WebSocket, message: unknown): void {
    socket.send(JSON.stringify(message));
  }

  private broadcast(message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.sockets.keys()) {
      socket.send(encoded);
    }
  }

  private broadcastWerewolf(gameState: GameState, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const [socket, member] of this.sockets) {
      if (canUseWerewolfChannel(gameState, member.playerId)) {
        socket.send(encoded);
      }
    }
  }

  private broadcastFox(gameState: GameState, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const [socket, member] of this.sockets) {
      if (canUseFoxChannel(gameState, member.playerId)) {
        socket.send(encoded);
      }
    }
  }

  private broadcastCommon(gameState: GameState, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const [socket, member] of this.sockets) {
      if (canUseCommonChannel(gameState, member.playerId)) {
        socket.send(encoded);
      }
    }
  }

  private broadcastLovers(gameState: GameState, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const [socket, member] of this.sockets) {
      if (canUseLoversChannel(gameState, member.playerId)) {
        socket.send(encoded);
      }
    }
  }

  private broadcastDead(gameState: GameState, message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const [socket, member] of this.sockets) {
      if (canUseDeadChannel(gameState, member.playerId)) {
        socket.send(encoded);
      }
    }
  }

  private async loadGameState(): Promise<GameState> {
    if (this.gameState) {
      return this.gameState;
    }
    this.gameState = (await this.state.storage.get<GameState>("gameState")) ?? createLobbyState(this.roomId);
    return this.gameState;
  }

  private async saveGameState(gameState: GameState): Promise<void> {
    this.gameState = gameState;
    await this.state.storage.put("gameState", gameState);
    if (gameState.phaseEndsAt) {
      await this.state.storage.setAlarm(new Date(gameState.phaseEndsAt));
    } else {
      await this.state.storage.deleteAlarm();
    }
  }

  private broadcastGameState(gameState: GameState): void {
    this.broadcast(buildGameStateMessage(gameState));
  }

  private sendRoles(gameState: GameState): void {
    for (const [socket, member] of this.sockets) {
      this.sendRole(socket, gameState, member.playerId);
    }
  }

  private sendRole(socket: WebSocket, gameState: GameState, playerId: string): void {
    const player = gameState.players.find((candidate) => candidate.playerId === playerId);
    if (!player || gameState.phase === "lobby") {
      return;
    }
    this.send(
      socket,
      buildRoleMessage(
        player.role,
        wolvesForPlayer(gameState, player.playerId),
        commonsForPlayer(gameState, player.playerId),
        loversForPlayer(gameState, player.playerId),
        foxesForPlayer(gameState, player.playerId),
        player.authority === true
      )
    );
  }

  private sendMediumResults(gameState: GameState): void {
    for (const [socket, member] of this.sockets) {
      this.sendMediumResult(socket, gameState, member.playerId);
    }
  }

  private sendMediumResult(socket: WebSocket, gameState: GameState, playerId: string): void {
    const reading = mediumReadingForPlayer(gameState, playerId);
    if (!reading) {
      return;
    }
    this.send(socket, buildMediumResultMessage(reading));
  }

  private async syncRoomStatus(gameState: GameState): Promise<void> {
    if (gameState.phase === "day" && gameState.day === 1) {
      await this.env.DB.prepare("UPDATE rooms SET status = 'playing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(this.roomId).run();
    }
    if (gameState.phase === "ended") {
      if (await this.state.storage.get<boolean>("gameFinalized")) {
        return;
      }
      const statStatements = playerStatUpdates(gameState).map((stat) =>
        this.env.DB.prepare(
          "INSERT INTO player_stats (player_id, games_played, wins, losses, updated_at) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(player_id) DO UPDATE SET games_played = games_played + 1, wins = wins + excluded.wins, losses = losses + excluded.losses, updated_at = CURRENT_TIMESTAMP"
        ).bind(stat.playerId, stat.won ? 1 : 0, stat.won ? 0 : 1)
      );
      await this.env.DB.batch([
        this.env.DB.prepare("UPDATE rooms SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(this.roomId),
        this.env.DB.prepare("INSERT INTO game_records (room_id, result_json) VALUES (?, ?)").bind(
          this.roomId,
          JSON.stringify({ winner: gameState.winner, day: gameState.day, players: gameState.players })
        ),
        this.env.DB.prepare("INSERT INTO room_events (room_id, event_type, payload_json) VALUES (?, 'game_ended', ?)").bind(
          this.roomId,
          JSON.stringify({ winner: gameState.winner, day: gameState.day, players: gameState.players.length })
        ),
        ...statStatements
      ]);
      await this.state.storage.put("gameFinalized", true);
    }
  }

  private async persistJoin(playerId: string, nickname: string): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        "INSERT INTO players (id, nickname, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, last_seen_at = CURRENT_TIMESTAMP"
      ).bind(playerId, nickname),
      this.env.DB.prepare("INSERT INTO room_events (room_id, player_id, event_type) VALUES (?, ?, 'player_joined')").bind(
        this.roomId,
        playerId
      )
    ]);
  }

  private async persistRoomEvent(playerId: string | null, eventType: string, payload: unknown): Promise<void> {
    await this.env.DB.prepare("INSERT INTO room_events (room_id, player_id, event_type, payload_json) VALUES (?, ?, ?, ?)")
      .bind(this.roomId, playerId, eventType, JSON.stringify(payload))
      .run();
  }

  private async loadRoomOptions(): Promise<RoomOptions> {
    const row = await this.env.DB.prepare("SELECT option_role FROM rooms WHERE id = ? LIMIT 1")
      .bind(this.roomId)
      .first<{ option_role: string }>();
    const roles = new Set((row?.option_role ?? "").split(/\s+/).filter(Boolean));
    return {
      poison: roles.has("poison"),
      bigWolf: roles.has("wfbig"),
      authority: roles.has("authority"),
      decider: roles.has("decide"),
      lovers: roles.has("lovers"),
      betrayer: roles.has("betr"),
      childFox: roles.has("fosi"),
      twoFoxes: roles.has("foxs"),
      cat: roles.has("cat"),
      lastWords: roles.has("will"),
      openVote: roles.has("open_vote")
    };
  }
}
