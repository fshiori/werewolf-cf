import { publicPlayers } from "./game";
import type { GameState, PlayerRole, RoomMember, ServerMessage } from "./types";
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

export function buildWolfChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "wolf_chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildGameStateMessage(state: GameState): ServerMessage {
  return {
    type: "game_state",
    phase: state.phase,
    day: state.day,
    hostId: state.hostId,
    players: publicPlayers(state.players).map((player) => ({ ...player, nickname: escapeHtml(player.nickname) })),
    votes: state.votes,
    winner: state.winner,
    phaseEndsAt: state.phaseEndsAt,
    log: state.log.map(escapeHtml)
  };
}

export function buildRoleMessage(role: PlayerRole, wolves: RoomMember[]): ServerMessage {
  return {
    type: "role",
    role,
    wolves: wolves.map((wolf) => ({ playerId: wolf.playerId, nickname: escapeHtml(wolf.nickname) }))
  };
}

export function buildErrorMessage(message: string): ServerMessage {
  return { type: "error", message };
}
