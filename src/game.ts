import type {
  DivinationResult,
  GamePlayer,
  GameState,
  GameWinner,
  ChildFoxDivinationResult,
  MediumReading,
  PlayerStatUpdate,
  PublicGamePlayer,
  RoomMember,
  RoomOptions
} from "./types";

export const DAY_MS = 180_000;
export const NIGHT_MS = 90_000;
export const MAX_REVOTES = 1;
const REFERENCE_ROLE_DECKS: Record<number, GamePlayer["role"][]> = {
  8: ["villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer"],
  9: ["villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium"],
  10: ["villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman"],
  11: ["villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman", "guard"],
  12: ["villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman", "guard"],
  13: ["villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  14: ["villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  15: ["villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common", "fox"],
  16: ["villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common", "fox"],
  17: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common", "fox"],
  18: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common", "fox"],
  19: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common", "fox"],
  20: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  21: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  22: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  23: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  24: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "common", "common"],
  25: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "guard", "common", "common"],
  26: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "guard", "common", "common"],
  27: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "medium", "madman", "guard", "guard", "common", "common", "common"],
  28: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "seer", "medium", "madman", "guard", "guard", "common", "common", "common"],
  29: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "seer", "medium", "medium", "madman", "guard", "guard", "common", "common", "common"],
  30: ["villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "villager", "fox", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "werewolf", "seer", "seer", "medium", "medium", "madman", "guard", "guard", "common", "common", "common"]
};

export function createLobbyState(roomId: string): GameState {
  return {
    roomId,
    phase: "lobby",
    day: 0,
    players: [],
    votes: {},
    revoteCount: 0,
    nightKills: {},
    divinations: {},
    guards: {},
    catRevives: {},
    lastWords: {},
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

export function isWerewolfRole(role: GamePlayer["role"]): boolean {
  return role === "werewolf" || role === "big_wolf";
}

export function canUseWerewolfChannel(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return state.phase === "night" && player?.alive === true && isWerewolfRole(player.role);
}

export function canUseFoxChannel(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return state.phase === "night" && player?.alive === true && player.role === "fox";
}

export function canUseCommonChannel(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return state.phase === "night" && player?.alive === true && player.role === "common";
}

export function canUseLoversChannel(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return state.phase === "night" && player?.alive === true && player.lover === true;
}

export function canUsePublicChat(state: GameState, playerId: string): boolean {
  if (state.phase === "lobby" || state.phase === "ended") {
    return true;
  }
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return player?.alive === true;
}

export function canStartGame(state: GameState, playerId: string): boolean {
  if (state.phase !== "lobby") {
    return false;
  }
  return (state.hostId ?? state.players[0]?.playerId) === playerId;
}

export function startGame(
  state: GameState,
  now = Date.now(),
  random = Math.random,
  options: RoomOptions = {
    poison: false,
    bigWolf: false,
    authority: false,
    decider: false,
    lovers: false,
    betrayer: false,
    childFox: false,
    twoFoxes: false,
    cat: false,
    lastWords: false
  }
): GameState {
  if (state.phase !== "lobby") {
    throw new Error("Game already started");
  }
  if (state.players.length < 3) {
    throw new Error("At least 3 players are required");
  }

  const referenceRoleDeck = REFERENCE_ROLE_DECKS[state.players.length];
  if (referenceRoleDeck) {
    return startGameWithPlayers(
      state,
      applyRoomOptions(
        state.players.map((player, index) => ({ ...player, role: referenceRoleDeck[index], alive: true })),
        options
      ),
      now
    );
  }

  const wolfCount = Math.max(1, Math.floor(state.players.length / 4));
  const firstWolfIndex = Math.floor(random() * state.players.length);
  const wolfIds = new Set(
    Array.from({ length: wolfCount }, (_, offset) => state.players[(firstWolfIndex + offset) % state.players.length].playerId)
  );
  const seerId = state.players.find((player) => !wolfIds.has(player.playerId))?.playerId;
  const mediumId = state.players.find((player) => !wolfIds.has(player.playerId) && player.playerId !== seerId)?.playerId;
  const madmanId = state.players.find(
    (player) => !wolfIds.has(player.playerId) && player.playerId !== seerId && player.playerId !== mediumId
  )?.playerId;
  const guardId = state.players.find(
    (player) =>
      !wolfIds.has(player.playerId) && player.playerId !== seerId && player.playerId !== mediumId && player.playerId !== madmanId
  )?.playerId;
  const commonIds = new Set(
    state.players.length >= 13
      ? state.players
          .filter(
            (player) =>
              !wolfIds.has(player.playerId) &&
              player.playerId !== seerId &&
              player.playerId !== mediumId &&
              player.playerId !== madmanId &&
              player.playerId !== guardId
          )
          .slice(0, 2)
          .map((player) => player.playerId)
      : []
  );
  const foxId = state.players.length >= 15
    ? state.players.find(
        (player) =>
          !wolfIds.has(player.playerId) &&
          player.playerId !== seerId &&
          player.playerId !== mediumId &&
          player.playerId !== madmanId &&
          player.playerId !== guardId &&
          !commonIds.has(player.playerId)
      )?.playerId
    : undefined;
  const players = state.players.map((player) => {
    let role: GamePlayer["role"] = "villager";
    if (wolfIds.has(player.playerId)) {
      role = "werewolf";
    } else if (state.players.length >= 4 && player.playerId === seerId) {
      role = "seer";
    } else if (state.players.length >= 5 && player.playerId === mediumId) {
      role = "medium";
    } else if (state.players.length >= 6 && player.playerId === madmanId) {
      role = "madman";
    } else if (state.players.length >= 7 && player.playerId === guardId) {
      role = "guard";
    } else if (commonIds.has(player.playerId)) {
      role = "common";
    } else if (player.playerId === foxId) {
      role = "fox";
    }
    return { ...player, role, alive: true };
  });

  return startGameWithPlayers(state, applyRoomOptions(players, options), now);
}

function applyRoomOptions(players: GamePlayer[], options: RoomOptions): GamePlayer[] {
  let nextPlayers = players;
  if (options.lovers && nextPlayers.length >= 13) {
    const loverIndexes = nextPlayers
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !isWerewolfRole(player.role) && player.role !== "fox")
      .slice(0, 2)
      .map(({ index }) => index);
    if (loverIndexes.length === 2) {
      nextPlayers = nextPlayers.map((player, index) => (loverIndexes.includes(index) ? { ...player, lover: true } : player));
    }
  }
  if (options.authority && nextPlayers.length >= 16) {
    const authorityIndex = nextPlayers.findIndex((player) => player.role === "villager");
    if (authorityIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === authorityIndex ? { ...player, authority: true } : player));
    }
  }
  if (options.decider && nextPlayers.length >= 16) {
    const deciderIndex = nextPlayers.findIndex((player) => player.role === "villager" && !player.authority);
    if (deciderIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === deciderIndex ? { ...player, decider: true } : player));
    }
  }
  if (options.bigWolf && nextPlayers.length >= 20) {
    const wolfIndex = nextPlayers.findIndex((player) => player.role === "werewolf");
    if (wolfIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === wolfIndex ? { ...player, role: "big_wolf" } : player));
    }
  }
  if (options.betrayer && nextPlayers.length >= 20) {
    const betrayerIndex = nextPlayers.findIndex((player) => player.role === "villager");
    if (betrayerIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === betrayerIndex ? { ...player, role: "betrayer" } : player));
    }
  }
  if (options.childFox && nextPlayers.length >= 20) {
    const childFoxIndex = nextPlayers.findIndex((player) => player.role === "villager");
    if (childFoxIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === childFoxIndex ? { ...player, role: "child_fox" } : player));
    }
  }
  if (options.twoFoxes && nextPlayers.length >= 20) {
    const foxIndex = nextPlayers.findIndex((player) => player.role === "villager");
    if (foxIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === foxIndex ? { ...player, role: "fox" } : player));
    }
  }
  if (options.cat && nextPlayers.length >= 20) {
    const catIndex = nextPlayers.findIndex((player) => player.role === "villager");
    if (catIndex !== -1) {
      nextPlayers = nextPlayers.map((player, index) => (index === catIndex ? { ...player, role: "cat" } : player));
    }
  }
  if (!options.poison || nextPlayers.length < 20) {
    return nextPlayers;
  }
  const villagerIndexes = nextPlayers
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.role === "villager")
    .map(({ index }) => index);
  if (villagerIndexes.length < 2) {
    return nextPlayers;
  }
  return nextPlayers.map((player, index) => {
    if (index === villagerIndexes[0]) {
      return { ...player, role: "poison" };
    }
    if (index === villagerIndexes[1]) {
      return { ...player, role: "werewolf" };
    }
    return player;
  });
}

function startGameWithPlayers(state: GameState, players: GamePlayer[], now: number): GameState {
  return {
    ...state,
    phase: "day",
    day: 1,
    players,
    votes: {},
    revoteCount: 0,
    nightKills: {},
    divinations: {},
    guards: {},
    catRevives: {},
    lastWords: state.lastWords ?? {},
    mediumReading: undefined,
    phaseEndsAt: new Date(now + DAY_MS).toISOString(),
    log: [...state.log, "遊戲開始。", "第 1 日白天開始。"]
  };
}

export function setLastWords(state: GameState, playerId: string, text: string): GameState {
  if (state.phase === "lobby" || state.phase === "ended") {
    throw new Error("Last words are only available during active games");
  }
  assertLivingPlayer(state, playerId);
  return {
    ...state,
    lastWords: {
      ...(state.lastWords ?? {}),
      [playerId]: text
    }
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

export function castNightKill(state: GameState, actorId: string, targetId: string, now = Date.now(), random = Math.random): GameState {
  if (state.phase !== "night") {
    throw new Error("Night actions are only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (!isWerewolfRole(actor.role)) {
    throw new Error("Only werewolves can perform night kills");
  }
  const target = assertLivingPlayer(state, targetId);
  if (isWerewolfRole(target.role)) {
    throw new Error("Werewolves cannot target each other");
  }

  const next = { ...state, nightKills: { ...state.nightKills, [actorId]: targetId } };
  if (areNightActionsComplete(next)) {
    return resolveNight(next, now, random);
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
  const divinedPlayers = target.role === "fox"
    ? applyLinkedDeaths(state.players.map((player) => (player.playerId === targetId ? { ...player, alive: false } : player)))
    : state.players;
  const nextState = target.role === "fox"
    ? {
        ...state,
        players: divinedPlayers,
        log: [...state.log, `${target.nickname} 被占卜後死亡。`, ...lastWordsForNewDeaths(state.players, divinedPlayers, state.lastWords ?? {})]
      }
    : state;
  const clearedState = clearActionsForDeadPlayers(nextState);
  return {
    state: {
      ...clearedState,
      divinations: { ...clearedState.divinations, [actorId]: targetId }
    },
    targetNickname: target.nickname,
    result: isWerewolfRole(target.role) ? "werewolf" : "human"
  };
}

export function castChildFoxDivination(
  state: GameState,
  actorId: string,
  targetId: string,
  random = Math.random
): { state: GameState; targetNickname: string; result: ChildFoxDivinationResult } {
  if (state.phase !== "night") {
    throw new Error("Child fox divination is only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (actor.role !== "child_fox") {
    throw new Error("Only child foxes can divine players");
  }
  const divinations = state.divinations ?? {};
  if (divinations[actorId]) {
    throw new Error("Child fox divination is already used tonight");
  }
  if (actorId === targetId) {
    throw new Error("Child foxes cannot divine themselves");
  }
  const target = assertLivingPlayer(state, targetId);
  const failed = random() < 0.6;
  const result = failed ? "failed" : isWerewolfRole(target.role) ? "werewolf" : "human";
  const nextState = {
    ...state,
    divinations: { ...divinations, [actorId]: targetId }
  };
  return { state: nextState, targetNickname: target.nickname, result };
}

export function castGuard(state: GameState, actorId: string, targetId: string, now = Date.now()): GameState {
  if (state.phase !== "night") {
    throw new Error("Guarding is only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (actor.role !== "guard") {
    throw new Error("Only guards can protect players");
  }
  const guards = state.guards ?? {};
  if (guards[actorId]) {
    throw new Error("Guard action is already used tonight");
  }
  const target = assertLivingPlayer(state, targetId);
  const next = { ...state, guards: { ...guards, [actorId]: target.playerId } };
  if (areNightActionsComplete(next)) {
    return resolveNight(next, now);
  }
  return next;
}

export function castCatRevive(state: GameState, actorId: string, targetId: string, now = Date.now(), random = Math.random): GameState {
  if (state.phase !== "night") {
    throw new Error("Cat revival is only available at night");
  }
  const actor = assertLivingPlayer(state, actorId);
  if (actor.role !== "cat") {
    throw new Error("Only cats can revive players");
  }
  if (state.day === 1) {
    throw new Error("Cats cannot revive on the first night");
  }
  const catRevives = state.catRevives ?? {};
  if (catRevives[actorId]) {
    throw new Error("Cat revival is already used tonight");
  }
  if (actorId === targetId) {
    throw new Error("Cats cannot revive themselves");
  }
  const target = state.players.find((candidate) => candidate.playerId === targetId);
  if (!target || target.alive) {
    throw new Error("Dead player is required");
  }

  const next = { ...state, catRevives: { ...catRevives, [actorId]: targetId } };
  if (areNightActionsComplete(next)) {
    return resolveNight(next, now, random);
  }
  return next;
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
  if (!player || !isWerewolfRole(player.role)) {
    return [];
  }
  return state.players
    .filter((candidate) => isWerewolfRole(candidate.role))
    .map(({ playerId: wolfId, nickname }) => ({ playerId: wolfId, nickname }));
}

export function commonsForPlayer(state: GameState, playerId: string): RoomMember[] {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || player.role !== "common") {
    return [];
  }
  return state.players
    .filter((candidate) => candidate.role === "common")
    .map(({ playerId: commonId, nickname }) => ({ playerId: commonId, nickname }));
}

export function loversForPlayer(state: GameState, playerId: string): RoomMember[] {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player?.lover) {
    return [];
  }
  return state.players
    .filter((candidate) => candidate.lover)
    .map(({ playerId: loverId, nickname }) => ({ playerId: loverId, nickname }));
}

export function foxesForPlayer(state: GameState, playerId: string): RoomMember[] {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || (player.role !== "fox" && player.role !== "betrayer" && player.role !== "child_fox")) {
    return [];
  }
  return state.players
    .filter((candidate) => candidate.role === "fox")
    .map(({ playerId: foxId, nickname }) => ({ playerId: foxId, nickname }));
}

export function mediumReadingForPlayer(state: GameState, playerId: string): MediumReading | undefined {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (state.phase !== "day" || !state.mediumReading || !player?.alive || player.role !== "medium") {
    return undefined;
  }
  return state.mediumReading;
}

export function playerStatUpdates(state: GameState): PlayerStatUpdate[] {
  if (state.phase !== "ended" || !state.winner) {
    return [];
  }
  return state.players.map((player) => ({
    playerId: player.playerId,
    won:
      player.lover
        ? state.winner === "lovers"
        : player.role === "fox" || player.role === "betrayer" || player.role === "child_fox"
        ? state.winner === "foxes"
        : isWerewolfRole(player.role) || player.role === "madman"
          ? state.winner === "werewolves"
          : state.winner === "villagers"
  }));
}

function resolveDay(state: GameState, now = Date.now()): GameState {
  const executedId = pickTopTarget(state);
  const revoteCount = state.revoteCount ?? 0;
  if (!executedId && Object.keys(state.votes).length > 0 && revoteCount < MAX_REVOTES) {
    return {
      ...state,
      votes: {},
      revoteCount: revoteCount + 1,
      phaseEndsAt: new Date(now + DAY_MS).toISOString(),
      log: [...state.log, "投票結果平手，重新投票。"]
    };
  }

  const executed = executedId ? state.players.find((player) => player.playerId === executedId) : undefined;
  let players = executedId
    ? state.players.map((player) => (player.playerId === executedId ? { ...player, alive: false } : player))
    : state.players;
  const poisonTarget = executed?.role === "poison" || executed?.role === "cat"
    ? firstLivingPlayer(players, (player) => player.playerId !== executed.playerId)
    : undefined;
  if (poisonTarget) {
    players = players.map((player) => (player.playerId === poisonTarget.playerId ? { ...player, alive: false } : player));
  }
  players = applyLinkedDeaths(players);
  const mediumReading: MediumReading | undefined = executed
    ? {
        day: state.day,
        targetPlayerId: executed.playerId,
        targetNickname: executed.nickname,
        result: isWerewolfRole(executed.role) ? "werewolf" : "human"
      }
    : undefined;
  const log = [
    ...state.log,
    executed ? `${executed.nickname} 被投票處決。` : "白天沒有共識，無人被處決。",
    ...(poisonTarget ? [`${poisonTarget.nickname} 被${executed?.role === "cat" ? "貓又" : "埋毒者"}牽連死亡。`] : []),
    ...lastWordsForNewDeaths(state.players, players, state.lastWords ?? {})
  ];
  return withWinOrNextNight({ ...clearActionsForDeadPlayers({ ...state, players }), votes: {}, revoteCount: 0, mediumReading, log }, now);
}

function resolveNight(state: GameState, now = Date.now(), random = Math.random): GameState {
  const killedId = pickTopActionTarget(state.nightKills);
  const protectedIds = new Set(Object.values(state.guards ?? {}));
  const protectedKill = killedId ? protectedIds.has(killedId) : false;
  const attacked = killedId ? state.players.find((player) => player.playerId === killedId) : undefined;
  const foxAttack = attacked?.role === "fox";
  const catSurvivesAttack = attacked?.role === "cat" && !protectedKill && random() >= 0.9;
  let players = killedId && !protectedKill && !foxAttack && !catSurvivesAttack
    ? state.players.map((player) => (player.playerId === killedId ? { ...player, alive: false } : player))
    : state.players;
  const killed = killedId && !protectedKill && !foxAttack && !catSurvivesAttack ? attacked : undefined;
  const poisonWolf = killed?.role === "poison" || killed?.role === "cat" ? firstLivingPlayer(players, (player) => isWerewolfRole(player.role)) : undefined;
  if (poisonWolf) {
    players = players.map((player) => (player.playerId === poisonWolf.playerId ? { ...player, alive: false } : player));
  }
  const catRevived = catSurvivesAttack ? undefined : pickCatRevival(state, players, random);
  if (catRevived) {
    players = players.map((player) => (player.playerId === catRevived.playerId ? { ...player, alive: true } : player));
  }
  players = applyLinkedDeaths(players);
  const log = [
    ...state.log,
    killed ? `${killed.nickname} 在夜晚死亡。` : foxAttack ? "妖狐被襲擊但沒有死亡。" : catSurvivesAttack ? "貓又被襲擊但沒有死亡。" : "夜晚平安過去。",
    ...(poisonWolf ? [`${poisonWolf.nickname} 被${killed?.role === "cat" ? "貓又" : "埋毒者"}牽連死亡。`] : []),
    ...(catRevived ? [`${catRevived.nickname} 被貓又復活。`] : []),
    ...lastWordsForNewDeaths(state.players, players, state.lastWords ?? {})
  ];
  return withWinOrNextDay({ ...clearActionsForDeadPlayers({ ...state, players }), nightKills: {}, divinations: {}, guards: {}, catRevives: {}, log }, now);
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
    revoteCount: 0,
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
    revoteCount: 0,
    nightKills: {},
    divinations: {},
    guards: {},
    catRevives: {},
    mediumReading: undefined,
    log: [
      ...state.log,
      winner === "villagers" ? "村民勝利。" : winner === "werewolves" ? "狼人勝利。" : winner === "foxes" ? "妖狐勝利。" : "戀人勝利。"
    ]
  };
}

function getWinner(state: GameState): GameWinner | undefined {
  const wolves = livingWerewolves(state).length;
  const foxes = livingFoxes(state).length;
  const villagers = livingPlayers(state).filter((player) => !isWerewolfRole(player.role) && player.role !== "fox" && player.role !== "child_fox").length;
  if (wolves === 0) {
    return livingLovers(state).length >= 2 ? "lovers" : foxes > 0 ? "foxes" : "villagers";
  }
  if (wolves >= villagers) {
    return livingLovers(state).length >= 2 ? "lovers" : foxes > 0 ? "foxes" : "werewolves";
  }
  return undefined;
}

function livingPlayers(state: GameState): GamePlayer[] {
  return state.players.filter((player) => player.alive);
}

function firstLivingPlayer(players: GamePlayer[], predicate: (player: GamePlayer) => boolean): GamePlayer | undefined {
  return players.find((player) => player.alive && predicate(player));
}

function livingWerewolves(state: GameState): GamePlayer[] {
  return livingPlayers(state).filter((player) => isWerewolfRole(player.role));
}

function livingFoxes(state: GameState): GamePlayer[] {
  return livingPlayers(state).filter((player) => player.role === "fox" || player.role === "child_fox");
}

function livingLovers(state: GameState): GamePlayer[] {
  return livingPlayers(state).filter((player) => player.lover);
}

function killLoversAfterDeaths(players: GamePlayer[]): GamePlayer[] {
  const lovers = players.filter((player) => player.lover);
  if (lovers.length < 2 || lovers.every((player) => player.alive)) {
    return players;
  }
  return players.map((player) => (player.lover ? { ...player, alive: false } : player));
}

function killBetrayersAfterFoxDeaths(players: GamePlayer[]): GamePlayer[] {
  const foxes = players.filter((player) => player.role === "fox");
  if (foxes.length === 0 || foxes.some((player) => player.alive)) {
    return players;
  }
  return players.map((player) => (player.role === "betrayer" ? { ...player, alive: false } : player));
}

function applyLinkedDeaths(players: GamePlayer[]): GamePlayer[] {
  let nextPlayers = players;
  while (true) {
    const before = nextPlayers.map((player) => `${player.playerId}:${player.alive ? "1" : "0"}`).join("|");
    nextPlayers = killBetrayersAfterFoxDeaths(killLoversAfterDeaths(nextPlayers));
    const after = nextPlayers.map((player) => `${player.playerId}:${player.alive ? "1" : "0"}`).join("|");
    if (before === after) {
      return nextPlayers;
    }
  }
}

function lastWordsForNewDeaths(before: GamePlayer[], after: GamePlayer[], lastWords: Record<string, string>): string[] {
  return after
    .filter((player) => before.some((candidate) => candidate.playerId === player.playerId && candidate.alive) && !player.alive)
    .flatMap((player) => {
      const text = lastWords[player.playerId]?.trim();
      return text ? [`${player.nickname} 的遺言：${text}`] : [];
    });
}

function livingGuards(state: GameState): GamePlayer[] {
  return livingPlayers(state).filter((player) => player.role === "guard");
}

function pickCatRevival(state: GameState, players: GamePlayer[], random: () => number): GamePlayer | undefined {
  for (const [actorId, targetId] of Object.entries(state.catRevives ?? {})) {
    const actor = players.find((player) => player.playerId === actorId);
    const target = players.find((player) => player.playerId === targetId);
    if (actor?.alive && actor.role === "cat" && target && !target.alive && random() >= 0.9) {
      return target;
    }
  }
  return undefined;
}

function areNightActionsComplete(state: GameState): boolean {
  return (
    Object.keys(state.nightKills).length >= livingWerewolves(state).length &&
    Object.keys(state.guards ?? {}).length >= livingGuards(state).length
  );
}

function assertLivingPlayer(state: GameState, playerId: string): GamePlayer {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player || !player.alive) {
    throw new Error("Living player is required");
  }
  return player;
}

function clearActionsForDeadPlayers(state: GameState): GameState {
  const livingIds = new Set(livingPlayers(state).map((player) => player.playerId));
  return {
    ...state,
    votes: keepLivingActorActions(state.votes, livingIds),
    nightKills: keepLivingActorActions(state.nightKills, livingIds),
    divinations: keepLivingActorActions(state.divinations, livingIds),
    guards: keepLivingActorActions(state.guards ?? {}, livingIds),
    catRevives: keepLivingActorActions(state.catRevives ?? {}, livingIds)
  };
}

function keepLivingActorActions(actions: Record<string, string>, livingIds: Set<string>): Record<string, string> {
  return Object.fromEntries(Object.entries(actions).filter(([actorId]) => livingIds.has(actorId)));
}

function pickTopTarget(state: GameState): string | undefined {
  const counts = new Map<string, number>();
  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = state.players.find((player) => player.playerId === voterId);
    counts.set(targetId, (counts.get(targetId) ?? 0) + (voter?.authority ? 2 : 1));
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
  if (!tied) {
    return topTarget;
  }
  const tiedTargets = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count === topCount)
      .map(([targetId]) => targetId)
  );
  const decider = state.players.find((player) => player.alive && player.decider);
  const deciderTarget = decider ? state.votes[decider.playerId] : undefined;
  return deciderTarget && tiedTargets.has(deciderTarget) ? deciderTarget : undefined;
}

function pickTopActionTarget(actions: Record<string, string>): string | undefined {
  const counts = new Map<string, number>();
  for (const targetId of Object.values(actions)) {
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
