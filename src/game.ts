import type { DivinationResult, GamePlayer, GameState, GameWinner, MediumReading, PublicGamePlayer, RoomMember } from "./types";

export const DAY_MS = 180_000;
export const NIGHT_MS = 90_000;

export function createLobbyState(roomId: string): GameState {
  return {
    roomId,
    phase: "lobby",
    day: 0,
    players: [],
    votes: {},
    nightKills: {},
    divinations: {},
    log: ["等待玩家加入。"]
  };
}

export function publicPlayers(players: GamePlayer[]): PublicGamePlayer[] {
  return players.map(({ playerId, nickname, alive }) => ({ playerId, nickname, alive }));
}

export function upsertLobbyPlayer(state: GameState, member: RoomMember): GameState {
  if (state.phase !== "lobby") {
    return state;
  }

  const existing = state.players.find((player) => player.playerId === member.playerId);
  if (existing) {
    return {
      ...state,
      hostId: state.hostId ?? state.players[0]?.playerId,
      players: state.players.map((player) =>
        player.playerId === member.playerId ? { ...player, nickname: member.nickname } : player
      )
    };
  }

  return {
    ...state,
    hostId: state.hostId ?? member.playerId,
    players: [...state.players, { ...member, role: "villager", alive: true }]
  };
}

export function canJoinRoomState(state: GameState, playerId: string): boolean {
  return state.phase === "lobby" || state.players.some((player) => player.playerId === playerId);
}

export function canUseWerewolfChannel(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return state.phase === "night" && player?.alive === true && player.role === "werewolf";
}

export function canStartGame(state: GameState, playerId: string): boolean {
  if (state.phase !== "lobby") {
    return false;
  }
  return (state.hostId ?? state.players[0]?.playerId) === playerId;
}

export function startGame(state: GameState, now = Date.now(), random = Math.random): GameState {
  if (state.phase !== "lobby") {
    throw new Error("Game already started");
  }
  if (state.players.length < 3) {
    throw new Error("At least 3 players are required");
  }

  const wolfCount = Math.max(1, Math.floor(state.players.length / 4));
  const firstWolfIndex = Math.floor(random() * state.players.length);
  const wolfIds = new Set(
    Array.from({ length: wolfCount }, (_, offset) => state.players[(firstWolfIndex + offset) % state.players.length].playerId)
  );
  const seerId = state.players.find((player) => !wolfIds.has(player.playerId))?.playerId;
  const mediumId = state.players.find((player) => !wolfIds.has(player.playerId) && player.playerId !== seerId)?.playerId;
  const players = state.players.map((player) => {
    let role: GamePlayer["role"] = "villager";
    if (wolfIds.has(player.playerId)) {
      role = "werewolf";
    } else if (state.players.length >= 4 && player.playerId === seerId) {
      role = "seer";
    } else if (state.players.length >= 5 && player.playerId === mediumId) {
      role = "medium";
    }
    return { ...player, role, alive: true };
  });

  return {
    ...state,
    phase: "day",
    day: 1,
    players,
    votes: {},
    nightKills: {},
    divinations: {},
    mediumReading: undefined,
    phaseEndsAt: new Date(now + DAY_MS).toISOString(),
    log: [...state.log, "遊戲開始。", "第 1 日白天開始。"]
  };
}

export function castDayVote(state: GameState, voterId: string, targetId: string): GameState {
  if (state.phase !== "day") {
    throw new Error("Voting is only available during the day");
  }
  assertLivingPlayer(state, voterId);
  assertLivingPlayer(state, targetId);

  const next = { ...state, votes: { ...state.votes, [voterId]: targetId } };
  if (Object.keys(next.votes).length >= livingPlayers(next).length) {
    return resolveDay(next);
  }
  return next;
}

export function castNightKill(state: GameState, actorId: string, targetId: string, now = Date.now()): GameState {
  if (state.phase !== "night") {
    throw new Error("Night actions are only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (actor.role !== "werewolf") {
    throw new Error("Only werewolves can perform night kills");
  }
  const target = assertLivingPlayer(state, targetId);
  if (target.role === "werewolf") {
    throw new Error("Werewolves cannot target each other");
  }

  const next = { ...state, nightKills: { ...state.nightKills, [actorId]: targetId } };
  if (Object.keys(next.nightKills).length >= livingWerewolves(next).length) {
    return resolveNight(next, now);
  }
  return next;
}

export function castDivination(
  state: GameState,
  actorId: string,
  targetId: string
): { state: GameState; targetNickname: string; result: DivinationResult } {
  if (state.phase !== "night") {
    throw new Error("Divination is only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (actor.role !== "seer") {
    throw new Error("Only seers can divine players");
  }
  const divinations = state.divinations ?? {};
  if (divinations[actorId]) {
    throw new Error("Divination is already used tonight");
  }
  if (actorId === targetId) {
    throw new Error("Seers cannot divine themselves");
  }
  const target = assertLivingPlayer(state, targetId);
  return {
    state: { ...state, divinations: { ...divinations, [actorId]: targetId } },
    targetNickname: target.nickname,
    result: target.role === "werewolf" ? "werewolf" : "human"
  };
}

export function advancePhaseByAlarm(state: GameState, now = Date.now()): GameState {
  if (state.phase === "day") {
    return resolveDay(state, now);
  }
  if (state.phase === "night") {
    return resolveNight(state, now);
  }
  return state;
}

export function wolvesForPlayer(state: GameState, playerId: string): RoomMember[] {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || player.role !== "werewolf") {
    return [];
  }
  return state.players
    .filter((candidate) => candidate.role === "werewolf")
    .map(({ playerId: wolfId, nickname }) => ({ playerId: wolfId, nickname }));
}

export function mediumReadingForPlayer(state: GameState, playerId: string): MediumReading | undefined {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (state.phase !== "day" || !state.mediumReading || !player?.alive || player.role !== "medium") {
    return undefined;
  }
  return state.mediumReading;
}

function resolveDay(state: GameState, now = Date.now()): GameState {
  const executedId = pickTopTarget(state.votes);
  const players = executedId
    ? state.players.map((player) => (player.playerId === executedId ? { ...player, alive: false } : player))
    : state.players;
  const executed = executedId ? state.players.find((player) => player.playerId === executedId) : undefined;
  const mediumReading: MediumReading | undefined = executed
    ? {
        day: state.day,
        targetPlayerId: executed.playerId,
        targetNickname: executed.nickname,
        result: executed.role === "werewolf" ? "werewolf" : "human"
      }
    : undefined;
  const log = [...state.log, executed ? `${executed.nickname} 被投票處決。` : "白天沒有共識，無人被處決。"];
  return withWinOrNextNight({ ...state, players, votes: {}, mediumReading, log }, now);
}

function resolveNight(state: GameState, now = Date.now()): GameState {
  const killedId = pickTopTarget(state.nightKills);
  const players = killedId
    ? state.players.map((player) => (player.playerId === killedId ? { ...player, alive: false } : player))
    : state.players;
  const killed = killedId ? state.players.find((player) => player.playerId === killedId) : undefined;
  const log = [...state.log, killed ? `${killed.nickname} 在夜晚死亡。` : "夜晚平安過去。"];
  return withWinOrNextDay({ ...state, players, nightKills: {}, divinations: {}, log }, now);
}

function withWinOrNextNight(state: GameState, now: number): GameState {
  const winner = getWinner(state);
  if (winner) {
    return endGame(state, winner);
  }
  return {
    ...state,
    phase: "night",
    phaseEndsAt: new Date(now + NIGHT_MS).toISOString(),
    log: [...state.log, `第 ${state.day} 日夜晚開始。`]
  };
}

function withWinOrNextDay(state: GameState, now: number): GameState {
  const winner = getWinner(state);
  if (winner) {
    return endGame(state, winner);
  }
  const day = state.day + 1;
  return {
    ...state,
    phase: "day",
    day,
    phaseEndsAt: new Date(now + DAY_MS).toISOString(),
    log: [...state.log, `第 ${day} 日白天開始。`]
  };
}

function endGame(state: GameState, winner: GameWinner): GameState {
  return {
    ...state,
    phase: "ended",
    winner,
    phaseEndsAt: undefined,
    votes: {},
    nightKills: {},
    divinations: {},
    mediumReading: undefined,
    log: [...state.log, winner === "villagers" ? "村民勝利。" : "狼人勝利。"]
  };
}

function getWinner(state: GameState): GameWinner | undefined {
  const wolves = livingWerewolves(state).length;
  const villagers = livingPlayers(state).filter((player) => player.role !== "werewolf").length;
  if (wolves === 0) {
    return "villagers";
  }
  if (wolves >= villagers) {
    return "werewolves";
  }
  return undefined;
}

function livingPlayers(state: GameState): GamePlayer[] {
  return state.players.filter((player) => player.alive);
}

function livingWerewolves(state: GameState): GamePlayer[] {
  return livingPlayers(state).filter((player) => player.role === "werewolf");
}

function assertLivingPlayer(state: GameState, playerId: string): GamePlayer {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || !player.alive) {
    throw new Error("Living player is required");
  }
  return player;
}

function pickTopTarget(votes: Record<string, string>): string | undefined {
  const counts = new Map<string, number>();
  for (const targetId of Object.values(votes)) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }
  let topTarget: string | undefined;
  let topCount = 0;
  let tied = false;
  for (const [targetId, count] of counts) {
    if (count > topCount) {
      topTarget = targetId;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }
  return tied ? undefined : topTarget;
}
