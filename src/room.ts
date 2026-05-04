import {
  advancePhaseByAlarm,
  canJoinRoomState,
  castDayVote,
  castNightKill,
  createLobbyState,
  startGame,
  upsertLobbyPlayer,
  wolvesForPlayer
} from "./game";
import {
  buildChatMessage,
  buildErrorMessage,
  buildGameStateMessage,
  buildJoinedMessage,
  buildPresenceMessage,
  buildRoleMessage
} from "./messages";
import type { GameState, RoomMember } from "./types";
import {
  parseClientMessage,
  validateChatText,
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
        this.send(socket, buildJoinedMessage(this.roomId, playerId, this.members()));
        this.broadcast(buildPresenceMessage(this.members()));
        this.broadcastGameState(game);
        this.sendRole(socket, game, playerId);
        return;
      }

      const member = this.sockets.get(socket);
      if (!member) {
        throw new Error("Join required");
      }

      if (message.type === "chat") {
        const text = validateChatText(message.text);
        this.broadcast(buildChatMessage(member.playerId, member.nickname, text));
        return;
      }

      if (message.type === "start_game") {
        const next = startGame(await this.loadGameState());
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        this.broadcastGameState(next);
        this.sendRoles(next);
        return;
      }

      if (message.type === "vote") {
        const targetPlayerId = validatePlayerId(message.targetPlayerId);
        const next = castDayVote(await this.loadGameState(), member.playerId, targetPlayerId);
        await this.saveGameState(next);
        await this.syncRoomStatus(next);
        this.broadcastGameState(next);
        return;
      }

      const targetPlayerId = validatePlayerId(message.targetPlayerId);
      const next = castNightKill(await this.loadGameState(), member.playerId, targetPlayerId);
      await this.saveGameState(next);
      await this.syncRoomStatus(next);
      this.broadcastGameState(next);
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
    this.send(socket, buildRoleMessage(player.role, wolvesForPlayer(gameState, player.playerId)));
  }

  private async syncRoomStatus(gameState: GameState): Promise<void> {
    if (gameState.phase === "day" && gameState.day === 1) {
      await this.env.DB.prepare("UPDATE rooms SET status = 'playing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(this.roomId).run();
    }
    if (gameState.phase === "ended") {
      await this.env.DB.batch([
        this.env.DB.prepare("UPDATE rooms SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(this.roomId),
        this.env.DB.prepare("INSERT INTO game_records (room_id, result_json) VALUES (?, ?)").bind(
          this.roomId,
          JSON.stringify({ winner: gameState.winner, day: gameState.day, players: gameState.players })
        )
      ]);
    }
  }
}
