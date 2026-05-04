import { publicPlayers } from "./game";
import type { ChildFoxDivinationResult, DivinationResult, GameState, MediumReading, PlayerRole, RoomMember, ServerMessage } from "./types";
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

export function buildFoxChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "fox_chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildCommonChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "common_chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildLoversChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "lovers_chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildDeadChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "dead_chat",
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
    revoteCount: state.revoteCount ?? 0,
    players: publicPlayers(state.players).map((player) => ({ ...player, nickname: escapeHtml(player.nickname) })),
    votes: state.votes,
    winner: state.winner,
    phaseEndsAt: state.phaseEndsAt,
    log: state.log.map(escapeHtml)
  };
}

export function buildRoleMessage(
  role: PlayerRole,
  wolves: RoomMember[],
  commons: RoomMember[] = [],
  lovers: RoomMember[] = [],
  foxes: RoomMember[] = [],
  authority = false
): ServerMessage {
  return {
    type: "role",
    role,
    wolves: wolves.map((wolf) => ({ playerId: wolf.playerId, nickname: escapeHtml(wolf.nickname) })),
    commons: commons.map((common) => ({ playerId: common.playerId, nickname: escapeHtml(common.nickname) })),
    lovers: lovers.map((lover) => ({ playerId: lover.playerId, nickname: escapeHtml(lover.nickname) })),
    foxes: foxes.map((fox) => ({ playerId: fox.playerId, nickname: escapeHtml(fox.nickname) })),
    authority
  };
}

export function buildDivinationResultMessage(
  targetPlayerId: string,
  targetNickname: string,
  result: DivinationResult
): ServerMessage {
  return {
    type: "divination_result",
    targetPlayerId,
    targetNickname: escapeHtml(targetNickname),
    result
  };
}

export function buildChildFoxResultMessage(
  targetPlayerId: string,
  targetNickname: string,
  result: ChildFoxDivinationResult
): ServerMessage {
  return {
    type: "child_fox_result",
    targetPlayerId,
    targetNickname: escapeHtml(targetNickname),
    result
  };
}

export function buildMediumResultMessage(reading: MediumReading): ServerMessage {
  return {
    type: "medium_result",
    day: reading.day,
    targetPlayerId: reading.targetPlayerId,
    targetNickname: escapeHtml(reading.targetNickname),
    result: reading.result
  };
}

export function buildLastWordsAckMessage(): ServerMessage {
  return { type: "last_words_ack" };
}

export function buildActionAckMessage(
  action: "vote" | "night_kill" | "guard" | "child_fox_divine" | "cat_revive",
  targetPlayerId: string
): ServerMessage {
  return { type: "action_ack", action, targetPlayerId };
}

export function buildErrorMessage(message: string): ServerMessage {
  return { type: "error", message };
}
