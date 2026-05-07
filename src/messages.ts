import { channelRestrictionsForState, publicPlayers } from "./game";
import type { ChildFoxDivinationResult, DivinationResult, GameState, MediumReading, PlayerRole, RoomMember, ServerMessage } from "./types";
import { escapeHtml } from "./validation";

function publicMembers(members: RoomMember[]): RoomMember[] {
  return members.map((member) => ({
    ...member,
    nickname: escapeHtml(member.nickname)
  }));
}

export function buildJoinedMessage(roomId: string, playerId: string, members: RoomMember[]): ServerMessage {
  return { type: "joined", roomId, playerId, members: publicMembers(members) };
}

export function buildPresenceMessage(members: RoomMember[]): ServerMessage {
  return { type: "presence", members: publicMembers(members) };
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

export function buildSelfTalkMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "self_talk",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildRevealedRolesMessage(state: GameState): ServerMessage {
  return {
    type: "revealed_roles",
    roles: Object.fromEntries(state.players.map((player) => [player.playerId, player.role]))
  };
}

export function buildGmChatMessage(playerId: string, nickname: string, text: string): ServerMessage {
  return {
    type: "gm_chat",
    playerId,
    nickname: escapeHtml(nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildGmWhisperMessage(playerId: string, nickname: string, target: RoomMember, text: string): ServerMessage {
  return {
    type: "gm_whisper",
    playerId,
    nickname: escapeHtml(nickname),
    targetPlayerId: target.playerId,
    targetNickname: escapeHtml(target.nickname),
    text: escapeHtml(text),
    sentAt: new Date().toISOString()
  };
}

export function buildObjectionMessage(playerId: string, nickname: string, remaining: number): ServerMessage {
  return {
    type: "objection",
    playerId,
    nickname: escapeHtml(nickname),
    remaining,
    sentAt: new Date().toISOString()
  };
}

export function buildLobbyStartVoteMessage(playerId: string, nickname: string, votedPlayerIds: string[], required: number, ready: boolean): ServerMessage {
  return {
    type: "lobby_start_vote",
    playerId,
    nickname: escapeHtml(nickname),
    votedPlayerIds,
    required,
    ready,
    sentAt: new Date().toISOString()
  };
}

export function buildLobbyKickVoteMessage(
  playerId: string,
  nickname: string,
  targetPlayerId: string,
  targetNickname: string,
  votedPlayerIds: string[],
  required: number,
  ready: boolean
): ServerMessage {
  return {
    type: "lobby_kick_vote",
    playerId,
    nickname: escapeHtml(nickname),
    targetPlayerId,
    targetNickname: escapeHtml(targetNickname),
    votedPlayerIds,
    required,
    ready,
    sentAt: new Date().toISOString()
  };
}

function nightActionActorIds(state: GameState): string[] {
  const actorIds = new Set([
    ...Object.keys(state.nightKills ?? {}),
    ...Object.keys(state.divinations ?? {}),
    ...Object.keys(state.guards ?? {}),
    ...Object.keys(state.catRevives ?? {})
  ]);
  return state.players.filter((player) => actorIds.has(player.playerId)).map((player) => player.playerId);
}

function votedPlayerIdsForState(state: GameState): string[] {
  if (!state.voteStatus) {
    return [];
  }
  if (state.phase === "night") {
    return nightActionActorIds(state);
  }
  return Object.keys(state.votes);
}

export function buildGameStateMessage(state: GameState): ServerMessage {
  const currentPlayerIds = new Set(state.players.map((player) => player.playerId));
  return {
    type: "game_state",
    phase: state.phase,
    day: state.day,
    hostId: state.hostId,
    revoteCount: state.revoteCount ?? 0,
    commonTalkVisible: state.commonTalkVisible,
    channelRestrictions: channelRestrictionsForState(state),
    players: publicPlayers(state.players).map((player) => ({ ...player, nickname: escapeHtml(player.nickname) })),
    votes: state.openVote ? state.votes : {},
    votedPlayerIds: votedPlayerIdsForState(state),
    lobbyStartVotedPlayerIds: state.phase === "lobby" ? state.players.filter((player) => state.lobbyStartVotes?.[player.playerId]).map((player) => player.playerId) : undefined,
    lobbyKickVoteTargets:
      state.phase === "lobby"
        ? Object.entries(state.lobbyKickVotes ?? {})
            .filter(([targetPlayerId]) => currentPlayerIds.has(targetPlayerId))
            .map(([targetPlayerId, votedPlayerIds]) => ({
              targetPlayerId,
              votedPlayerIds: votedPlayerIds.filter((playerId) => currentPlayerIds.has(playerId))
            }))
            .filter((target) => target.votedPlayerIds.length > 0)
        : undefined,
    objectionCounts: Object.fromEntries(
      Object.entries(state.objectionCounts ?? {}).filter(([playerId]) => currentPlayerIds.has(playerId))
    ),
    winner: state.winner,
    phaseEndsAt: state.phaseEndsAt,
    suddenDeathWarningAt: state.suddenDeathWarningAt,
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
  action: "vote" | "night_kill" | "guard" | "child_fox_divine" | "cat_revive" | "kick_player" | "leave_room" | "gm_set_common_voice" | "gm_set_channel_restrictions",
  targetPlayerId: string
): ServerMessage {
  return { type: "action_ack", action, targetPlayerId };
}

export function buildErrorMessage(message: string): ServerMessage {
  return { type: "error", message: escapeHtml(message) };
}
