import type { RoomMember, ServerMessage } from "./types";
import { escapeHtml } from "./validation";

export function buildJoinedMessage(roomId: string, playerId: string, members: RoomMember[]): ServerMessage {
  return { type: "joined", roomId, playerId, members };
}

export function buildPresenceMessage(members: RoomMember[]): ServerMessage {
  return { type: "presence", members };
}

export function buildChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildErrorMessage(message: string): ServerMessage {
  return { type: "error", message };
}
