import { buildChatMessage, buildErrorMessage, buildJoinedMessage, buildPresenceMessage } from "./messages";
import type { RoomMember } from "./types";
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

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.roomId = this.state.id.name ?? "";
    void this.env;
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
    socket.addEventListener("message", (event) => this.onMessage(socket, event));
    socket.addEventListener("close", () => this.onClose(socket));
    socket.addEventListener("error", () => this.onClose(socket));
  }

  private onMessage(socket: WebSocket, event: MessageEvent): void {
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
        this.sockets.set(socket, { playerId, nickname });
        this.send(socket, buildJoinedMessage(this.roomId, playerId, this.members()));
        this.broadcast(buildPresenceMessage(this.members()));
        return;
      }

      const member = this.sockets.get(socket);
      if (!member) {
        throw new Error("Join required");
      }

      const text = validateChatText(message.text);
      this.broadcast(buildChatMessage(member.playerId, member.nickname, text));
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
}
