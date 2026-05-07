import { describe, expect, it } from "vitest";
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
  castLobbyKickVote,
  castLobbyStartVote,
  castChildFoxDivination,
  castCatRevive,
  castDayVote,
  castDivination,
  castGuard,
  castNightKill,
  commonsForPlayer,
  createLobbyState,
  foxesForPlayer,
  forceEndGame,
  forceSetChannelRestrictions,
  forceSetCommonTalkVisible,
  forceSetPlayerAlive,
  forceSetPlayerFlag,
  forceSetPlayerRole,
  leaveLobbyPlayer,
  loversForPlayer,
  mediumReadingForPlayer,
  mediumReadingsForPlayer,
  playerStatUpdates,
  publicPlayers,
  raiseObjection,
  recordConversationActivity,
  requestRoomEnd,
  removeLobbyPlayer,
  setLastWords,
  startGame,
  upsertLobbyPlayer,
  MAX_REVOTES,
  wolvesForPlayer
} from "../src/game";
import type { GameState } from "../src/types";

function lobby(players: Array<[string, string]>): GameState {
  return players.reduce(
    (state, [playerId, nickname]) => upsertLobbyPlayer(state, { playerId, nickname }),
    createLobbyState("room_abc")
  );
}

function numberedLobby(count: number): GameState {
  return lobby(Array.from({ length: count }, (_, index) => [`player_${index + 1}`, `Player ${index + 1}`]));
}

function roleCounts(game: GameState): Record<string, number> {
  return game.players.reduce<Record<string, number>>((counts, player) => {
    counts[player.role] = (counts[player.role] ?? 0) + 1;
    return counts;
  }, {});
}

function randomSequence(values: number[], fallback = 0.999): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

function activeState(phase: "day" | "night", players: GameState["players"]): GameState {
  return {
    roomId: "room_abc",
    phase,
    day: 1,
    players,
    votes: {},
    openVote: false,
    commonTalkVisible: false,
    deadRoleVisible: false,
    wishRole: false,
    dummyBoy: false,
    dayMs: 180_000,
    nightMs: 90_000,
    selfVote: false,
    voteStatus: false,
    revoteCount: 0,
    nightKills: {},
    divinations: {},
    guards: {},
    catRevives: {},
    lastWords: {},
    log: []
  };
}

describe("game", () => {
  it("starts with one werewolf and public wolf partner lookup", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"]
      ]),
      0,
      () => 0
    );

    expect(game.phase).toBe("day");
    expect(game.day).toBe(1);
    expect(game.players.filter((player) => player.role === "werewolf")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "seer")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "medium")).toHaveLength(0);
    expect(wolvesForPlayer(game, "player_1")).toEqual([]);
    expect(wolvesForPlayer(game, "player_2")).toEqual([]);
  });

  it("adds a medium in five-player games", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"]
      ]),
      0,
      () => 0
    );

    expect(game.players.find((player) => player.playerId === "player_3")?.role).toBe("medium");
  });

  it("adds a madman in six-player games", () => {
    let game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"],
        ["player_6", "Frank"]
      ]),
      0,
      () => 0
    );

    expect(game.players.find((player) => player.playerId === "player_4")?.role).toBe("madman");
    expect(wolvesForPlayer(game, "player_4")).toEqual([]);

    for (const player of game.players) {
      game = castDayVote(game, player.playerId, player.playerId === "player_6" ? "player_5" : "player_6");
    }

    const divination = castDivination(game, "player_2", "player_4");
    expect(divination.result).toBe("human");
  });

  it("adds a guard in seven-player games and prevents guarded night kills", () => {
    let game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"],
        ["player_6", "Frank"],
        ["player_7", "Grace"]
      ]),
      0,
      () => 0
    );

    expect(game.players.find((player) => player.playerId === "player_5")?.role).toBe("guard");

    for (const player of game.players) {
      game = castDayVote(game, player.playerId, player.playerId === "player_7" ? "player_6" : "player_7");
    }

    const divination = castDivination(game, "player_2", "player_1");
    game = divination.state;
    expect(game.phase).toBe("night");

    game = castNightKill(game, "player_1", "player_2", 0);
    expect(game.phase).toBe("night");

    game = castGuard(game, "player_5", "player_2", 0);

    expect(game.phase).toBe("day");
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(game.guards).toEqual({});
    expect(game.log.at(-2)).toBe("夜晚平安過去。");
    expect(() => castGuard(game, "player_2", "player_3")).toThrow("Guarding is only available at night");
  });

  it("rejects guard self-protection like the reference night vote validation", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"],
        ["player_6", "Frank"],
        ["player_7", "Grace"]
      ]),
      0,
      () => 0
    );
    const night = {
      ...game,
      phase: "night" as const,
      day: 1,
      divinations: { player_2: "player_1" },
      nightKills: { player_1: "player_2" }
    };

    expect(() => castGuard(night, "player_5", "player_5")).toThrow("Guards cannot protect themselves");
  });

  it("uses the reference role deck in eight-player games", () => {
    const game = startGame(numberedLobby(8), 0, () => 0);

    expect(game.players.map((player) => player.role)).toEqual([
      "villager",
      "villager",
      "villager",
      "villager",
      "villager",
      "werewolf",
      "werewolf",
      "seer"
    ]);
  });

  it("uses reference large-player role deck counts", () => {
    expect(roleCounts(startGame(numberedLobby(16), 0, () => 0))).toEqual({
      villager: 6,
      werewolf: 3,
      seer: 1,
      medium: 1,
      madman: 1,
      guard: 1,
      common: 2,
      fox: 1
    });
    expect(roleCounts(startGame(numberedLobby(20), 0, () => 0))).toEqual({
      villager: 10,
      fox: 1,
      werewolf: 3,
      seer: 1,
      medium: 1,
      madman: 1,
      guard: 1,
      common: 2
    });
    expect(roleCounts(startGame(numberedLobby(23), 0, () => 0))).toEqual({
      villager: 12,
      fox: 1,
      werewolf: 4,
      seer: 1,
      medium: 1,
      madman: 1,
      guard: 1,
      common: 2
    });
    expect(roleCounts(startGame(numberedLobby(25), 0, () => 0))).toEqual({
      villager: 12,
      fox: 1,
      werewolf: 5,
      seer: 1,
      medium: 1,
      madman: 1,
      guard: 2,
      common: 2
    });
    expect(roleCounts(startGame(numberedLobby(28), 0, () => 0))).toEqual({
      villager: 13,
      fox: 1,
      werewolf: 5,
      seer: 2,
      medium: 1,
      madman: 1,
      guard: 2,
      common: 3
    });
    expect(roleCounts(startGame(numberedLobby(30), 0, () => 0))).toEqual({
      villager: 13,
      fox: 1,
      werewolf: 6,
      seer: 2,
      medium: 2,
      madman: 1,
      guard: 2,
      common: 3
    });
  });

  it("adds common partners in thirteen-player games", () => {
    const game = startGame(numberedLobby(13), 0, () => 0);

    expect(game.players.filter((player) => player.role === "common")).toEqual([
      expect.objectContaining({ playerId: "player_12", role: "common" }),
      expect.objectContaining({ playerId: "player_13", role: "common" })
    ]);
    expect(commonsForPlayer(game, "player_12")).toEqual([
      { playerId: "player_13", nickname: "Player 13" }
    ]);
    expect(commonsForPlayer(game, "player_10")).toEqual([]);
  });

  it("adds a fox in fifteen-player games", () => {
    const game = startGame(numberedLobby(15), 0, () => 0);

    expect(game.players.filter((player) => player.role === "fox")).toEqual([
      expect.objectContaining({ playerId: "player_15", role: "fox" })
    ]);
  });

  it("applies the poison room option in twenty-player games", () => {
    const normal = startGame(numberedLobby(20), 0, () => 0);
    const withPoison = startGame(numberedLobby(20), 0, () => 0, {
      poison: true,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(normal.players.filter((player) => player.role === "poison")).toHaveLength(0);
    expect(normal.players.filter((player) => player.role === "werewolf")).toHaveLength(3);
    expect(withPoison.players.filter((player) => player.role === "poison")).toHaveLength(1);
    expect(withPoison.players.filter((player) => player.role === "werewolf")).toHaveLength(4);
    expect(withPoison.players.filter((player) => player.role === "villager")).toHaveLength(
      normal.players.filter((player) => player.role === "villager").length - 2
    );
  });

  it("applies the big wolf room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, {
      poison: false,
      bigWolf: true,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.role === "big_wolf")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "werewolf")).toHaveLength(2);
    expect(wolvesForPlayer(game, "player_12")).toEqual([
      { playerId: "player_13", nickname: "Player 13" },
      { playerId: "player_14", nickname: "Player 14" }
    ]);
  });

  it("applies authority and decider room options in sixteen-player games", () => {
    const game = startGame(numberedLobby(16), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: true,
      decider: true,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.find((player) => player.authority)?.playerId).toBe("player_1");
    expect(game.players.find((player) => player.decider)?.playerId).toBe("player_2");
  });

  it("counts authority votes as two votes", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Authority", role: "villager", alive: true, authority: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Dave", role: "werewolf", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_4");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_1");

    expect(game.players.find((player) => player.playerId === "player_4")?.alive).toBe(false);
  });

  it("uses decider votes to resolve tied executions", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Decider", role: "villager", alive: true, decider: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Dave", role: "werewolf", alive: true }
    ]);
    game = { ...game, selfVote: true };

    game = castDayVote(game, "player_1", "player_3");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_4");

    expect(game.revoteCount).toBe(0);
    expect(game.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
  });

  it("applies lovers room option in thirteen-player games", () => {
    const game = startGame(numberedLobby(13), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: true,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.lover)).toEqual([
      expect.objectContaining({ playerId: "player_1" }),
      expect.objectContaining({ playerId: "player_2" })
    ]);
    expect(loversForPlayer(game, "player_1")).toEqual([
      { playerId: "player_2", nickname: "Player 2" }
    ]);
    expect(loversForPlayer(game, "player_3")).toEqual([]);
  });

  it("applies the betrayer room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: true,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.role === "betrayer")).toEqual([
      expect.objectContaining({ playerId: "player_1", role: "betrayer" })
    ]);
    expect(foxesForPlayer(game, "player_1")).toEqual([{ playerId: "player_11", nickname: "Player 11" }]);
    expect(foxesForPlayer(game, "player_11")).toEqual([]);
    expect(foxesForPlayer(game, "player_2")).toEqual([]);
  });

  it("applies the child fox room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: true,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.role === "child_fox")).toEqual([
      expect.objectContaining({ playerId: "player_1", role: "child_fox" })
    ]);
    expect(foxesForPlayer(game, "player_1")).toEqual([{ playerId: "player_11", nickname: "Player 11" }]);
  });

  it("applies the two foxes room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: true,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.role === "fox")).toEqual([
      expect.objectContaining({ playerId: "player_1", role: "fox" }),
      expect.objectContaining({ playerId: "player_11", role: "fox" })
    ]);
    expect(foxesForPlayer(game, "player_1")).toEqual([
      { playerId: "player_11", nickname: "Player 11" }
    ]);
  });

  it("applies the cat room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, {
      poison: false,
      bigWolf: false,
      authority: false,
      decider: false,
      lovers: false,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: true,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    });

    expect(game.players.filter((player) => player.role === "cat")).toEqual([
      expect.objectContaining({ playerId: "player_1", role: "cat" })
    ]);
  });

  it("stores the open vote room option in started games", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"]
      ]),
      0,
      () => 0,
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: true,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: false,
        dummyBoy: false,
        customDummy: true,
        dummyName: "Custom Dummy",
        dummyLastWords: "Remember the dummy",
        realTime: true,
        dayMinutes: 2,
        nightMinutes: 1,
        selfVote: false,
        voteStatus: false
      }
    );

    expect(game.openVote).toBe(true);
    expect(game.dayMs).toBe(120_000);
    expect(game.nightMs).toBe(60_000);
  });

  it("stores the self vote room option in started games", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"]
      ]),
      0,
      () => 0,
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: false,
        commonTalkVisible: true,
        deadRoleVisible: false,
        wishRole: false,
        dummyBoy: false,
        customDummy: false,
        dummyName: "替身君",
        dummyLastWords: "",
        realTime: false,
        dayMinutes: 3,
        nightMinutes: 1.5,
        selfVote: true,
        voteStatus: true
      }
    );

    expect(game.selfVote).toBe(true);
    expect(game.voteStatus).toBe(true);
    expect(game.commonTalkVisible).toBe(true);
  });

  it("honors available wished roles when the room option is enabled", () => {
    const game = startGame(
      {
        ...lobby([
          ["player_1", "Alice"],
          ["player_2", "Bob"],
          ["player_3", "Carol"],
          ["player_4", "Dave"]
        ]),
        players: [
          { playerId: "player_1", nickname: "Alice", role: "villager", alive: true, wishRole: "seer" },
          { playerId: "player_2", nickname: "Bob", role: "villager", alive: true, wishRole: "werewolf" },
          { playerId: "player_3", nickname: "Carol", role: "villager", alive: true },
          { playerId: "player_4", nickname: "Dave", role: "villager", alive: true, wishRole: "seer" }
        ]
      },
      0,
      randomSequence([0]),
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: false,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: true,
        dummyBoy: false,
        customDummy: false,
        dummyName: "替身君",
        dummyLastWords: "",
        realTime: false,
        dayMinutes: 3,
        nightMinutes: 1.5,
        selfVote: false,
        voteStatus: false
      }
    );

    expect(game.players.find((player) => player.playerId === "player_1")?.role).toBe("seer");
    expect(game.players.find((player) => player.playerId === "player_2")?.role).toBe("werewolf");
    expect(game.players.find((player) => player.playerId === "player_4")?.role).not.toBe("seer");
  });

  it("processes wish role conflicts in randomized reference order", () => {
    const state = numberedLobby(8);
    const game = startGame(
      {
        ...state,
        players: state.players.map((player) => (
          player.playerId === "player_1" || player.playerId === "player_2" ? { ...player, wishRole: "seer" } : player
        ))
      },
      0,
      randomSequence([0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0]),
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: false,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: true,
        dummyBoy: false,
        customDummy: false,
        dummyName: "替身君",
        dummyLastWords: "",
        realTime: false,
        dayMinutes: 3,
        nightMinutes: 1.5,
        selfVote: false,
        voteStatus: false
      }
    );

    expect(game.players.find((player) => player.playerId === "player_2")?.role).toBe("seer");
    expect(game.players.find((player) => player.playerId === "player_1")?.role).not.toBe("seer");
  });

  it("honors enabled optional role wishes before assigning remaining roles", () => {
    const state = numberedLobby(20);
    const game = startGame(
      {
        ...state,
        players: state.players.map((player) => {
          const wishes: Record<string, GameState["players"][number]["role"]> = {
            player_1: "big_wolf",
            player_2: "poison",
            player_3: "betrayer",
            player_4: "child_fox",
            player_5: "cat"
          };
          return wishes[player.playerId] ? { ...player, wishRole: wishes[player.playerId] } : player;
        })
      },
      0,
      () => 0.999,
      {
        poison: true,
        bigWolf: true,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: true,
        childFox: true,
        twoFoxes: false,
        cat: true,
        lastWords: false,
        openVote: false,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: true,
        dummyBoy: false,
        customDummy: false,
        dummyName: "替身君",
        dummyLastWords: "",
        realTime: false,
        dayMinutes: 3,
        nightMinutes: 1.5,
        selfVote: false,
        voteStatus: false
      }
    );

    expect(game.players.find((player) => player.playerId === "player_1")?.role).toBe("big_wolf");
    expect(game.players.find((player) => player.playerId === "player_2")?.role).toBe("poison");
    expect(game.players.find((player) => player.playerId === "player_3")?.role).toBe("betrayer");
    expect(game.players.find((player) => player.playerId === "player_4")?.role).toBe("child_fox");
    expect(game.players.find((player) => player.playerId === "player_5")?.role).toBe("cat");
    expect(roleCounts(game)).toMatchObject({ big_wolf: 1, poison: 1, betrayer: 1, child_fox: 1, cat: 1 });
  });

  it("starts dummy boy rooms on the first night and forces the dummy target", () => {
    let game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"]
      ]),
      0,
      () => 0,
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: false,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: false,
        dummyBoy: true,
        customDummy: true,
        dummyName: "Custom Dummy",
        dummyLastWords: "Remember the dummy",
        realTime: false,
        dayMinutes: 3,
        nightMinutes: 1.5,
        selfVote: false,
        voteStatus: false
      }
    );
    const wolf = game.players.find((player) => player.role === "werewolf");
    const dummy = game.players.find((player) => player.playerId === "player_dummy_boy");
    const nonDummy = game.players.find((player) => player.alive && player.playerId !== wolf?.playerId && player.playerId !== dummy?.playerId);

    expect(game.phase).toBe("night");
    expect(game.day).toBe(0);
    expect(dummy).toMatchObject({ nickname: "Custom Dummy", alive: true });
    expect(dummy?.role).not.toBe("werewolf");
    expect(dummy?.role).not.toBe("fox");
    expect(() => castNightKill(game, wolf?.playerId ?? "", nonDummy?.playerId ?? "")).toThrow("dummy boy");

    game = castNightKill(game, wolf?.playerId ?? "", "player_dummy_boy", 0);

    expect(game.phase).toBe("day");
    expect(game.day).toBe(1);
    expect(game.players.find((player) => player.playerId === "player_dummy_boy")?.alive).toBe(false);
    expect(game.log).toContain("Custom Dummy 的遺言：Remember the dummy");
  });

  it("rejects non-wolf night role actions on the dummy boy first night", () => {
    const firstNight = {
      ...activeState("night", [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf" as const, alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer" as const, alive: true },
        { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox" as const, alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard" as const, alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat" as const, alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager" as const, alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager" as const, alive: false }
      ]),
      day: 0
    };

    expect(() => castDivination(firstNight, "player_seer", "player_target")).toThrow("Divination is not available on the first night");
    expect(() => castChildFoxDivination(firstNight, "player_child_fox", "player_target")).toThrow("Child fox divination is not available on the first night");
    expect(() => castGuard(firstNight, "player_guard", "player_target")).toThrow("Guarding is not available on the first night");
    expect(() => castCatRevive(firstNight, "player_cat", "player_dead")).toThrow("Cats cannot revive on the first night");
  });

  it("uses default phase timers when real time is disabled", () => {
    const game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"]
      ]),
      0,
      () => 0,
      {
        poison: false,
        bigWolf: false,
        authority: false,
        decider: false,
        lovers: false,
        betrayer: false,
        childFox: false,
        twoFoxes: false,
        cat: false,
        lastWords: false,
        openVote: false,
        commonTalkVisible: false,
        deadRoleVisible: false,
        wishRole: false,
        dummyBoy: false,
        customDummy: false,
        dummyName: "替身君",
        dummyLastWords: "",
        realTime: false,
        dayMinutes: 9,
        nightMinutes: 9,
        selfVote: false,
        voteStatus: false
      }
    );

    expect(game.dayMs).toBe(180_000);
    expect(game.nightMs).toBe(90_000);
  });

  it("lets child foxes divine at night with possible failure", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_2", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    const success = castChildFoxDivination(game, "player_1", "player_2", () => 0.9);

    expect(success.result).toBe("werewolf");
    expect(success.targetNickname).toBe("Wolf");
    expect(success.state.divinations).toEqual({ player_1: "player_2" });
    expect(() => castChildFoxDivination(success.state, "player_1", "player_3", () => 0.9)).toThrow("already used");
    expect(castChildFoxDivination(game, "player_1", "player_3", () => 0.2).result).toBe("failed");
    expect(() => castChildFoxDivination(game, "player_3", "player_2")).toThrow("Only child foxes");
  });

  it("uses reference big wolf divination odds for seers and child foxes", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Big Wolf", role: "big_wolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ]);

    expect(castDivination(game, "player_2", "player_1", () => 0.2).result).toBe("human");
    expect(castDivination(game, "player_2", "player_1", () => 0.8).result).toBe("werewolf");
    expect(castChildFoxDivination(game, "player_3", "player_1", sequence(0.8, 0.6)).result).toBe("human");
    expect(castChildFoxDivination(game, "player_3", "player_1", sequence(0.8, 0.8)).result).toBe("werewolf");
  });

  it("kills betrayers when all foxes die", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_3", nickname: "Betrayer", role: "betrayer", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
  });

  it("kills the other lover when one lover dies", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Lover A", role: "villager", alive: true, lover: true },
      { playerId: "player_2", nickname: "Lover B", role: "villager", alive: true, lover: true },
      { playerId: "player_3", nickname: "Wolf", role: "werewolf", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
  });

  it("gives lovers the win when both lovers survive a normal win condition", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Lover A", role: "villager", alive: true, lover: true },
      { playerId: "player_2", nickname: "Lover B", role: "werewolf", alive: true, lover: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_3");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("lovers");
    expect(game.log.at(-1)).toBe("戀人勝利。");
  });

  it("does not give same-faction lovers the win over a normal win condition", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Lover Wolf A", role: "werewolf", alive: true, lover: true },
      { playerId: "player_2", nickname: "Lover Wolf B", role: "big_wolf", alive: true, lover: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_3");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("werewolves");
    expect(game.log.at(-1)).toBe("狼人勝利。");
  });

  it("does not give lovers the win while more than four players remain", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Lover Wolf", role: "werewolf", alive: true, lover: true },
      { playerId: "player_2", nickname: "Wolf B", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Wolf C", role: "werewolf", alive: true },
      { playerId: "player_4", nickname: "Lover Villager", role: "villager", alive: true, lover: true },
      { playerId: "player_5", nickname: "Villager A", role: "villager", alive: true },
      { playerId: "player_6", nickname: "Villager B", role: "villager", alive: true },
      { playerId: "player_7", nickname: "Villager C", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_7");
    game = castDayVote(game, "player_2", "player_7");
    game = castDayVote(game, "player_3", "player_7");
    game = castDayVote(game, "player_4", "player_7");
    game = castDayVote(game, "player_5", "player_1");
    game = castDayVote(game, "player_6", "player_1");
    game = castDayVote(game, "player_7", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("werewolves");
    expect(game.players.filter((player) => player.alive)).toHaveLength(6);
    expect(game.log.at(-1)).toBe("狼人勝利。");
  });

  it("does not give lovers the win when only one lover survives a normal win condition", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Lover Wolf", role: "werewolf", alive: true, lover: true },
      { playerId: "player_2", nickname: "Dead Lover", role: "villager", alive: false, lover: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    const killed = castNightKill(game, "player_1", "player_3", 0);

    expect(killed.phase).toBe("ended");
    expect(killed.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(killed.winner).toBe("villagers");
    expect(killed.log.at(-1)).toBe("村民勝利。");
  });

  it("moves from completed day vote to night", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(game.phase).toBe("night");
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
  });

  it("plays a core game loop from opening day through village victory", () => {
    let game = startGame(
      lobby([
        ["player_1", "Wolf"],
        ["player_2", "Seer"],
        ["player_3", "Medium"],
        ["player_4", "Villager A"],
        ["player_5", "Villager B"]
      ]),
      0,
      () => 0
    );

    expect(game.players.map((player) => [player.playerId, player.role])).toEqual([
      ["player_1", "werewolf"],
      ["player_2", "seer"],
      ["player_3", "medium"],
      ["player_4", "villager"],
      ["player_5", "villager"]
    ]);

    game = castDayVote(game, "player_1", "player_4");
    game = castDayVote(game, "player_2", "player_4");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_1");
    game = castDayVote(game, "player_5", "player_1");

    expect(game.phase).toBe("night");
    expect(game.day).toBe(1);
    expect(game.players.find((player) => player.playerId === "player_4")?.alive).toBe(false);
    expect(game.votes).toEqual({});
    expect(game.log).toContain("Villager A 被投票處決。");

    const divination = castDivination(game, "player_2", "player_1");
    expect(divination.result).toBe("werewolf");
    game = divination.state;
    expect(game.phase).toBe("night");

    game = castNightKill(game, "player_1", "player_5", 0);

    expect(game.phase).toBe("day");
    expect(game.day).toBe(2);
    expect(game.players.find((player) => player.playerId === "player_5")?.alive).toBe(false);
    expect(game.nightKills).toEqual({});
    expect(game.divinations).toEqual({});
    expect(mediumReadingForPlayer(game, "player_3")).toEqual({
      day: 1,
      targetPlayerId: "player_4",
      targetNickname: "Villager A",
      result: "human"
    });

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("villagers");
    expect(game.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(game.log.at(-2)).toBe("Wolf 被投票處決。");
    expect(game.log.at(-1)).toBe("村民勝利。");
  });

  it("allows self votes only when the room option is enabled", () => {
    const game = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Wolf", role: "werewolf", alive: true }
    ]);

    expect(() => castDayVote(game, "player_1", "player_1")).toThrow("Self votes are not enabled");
    expect(castDayVote({ ...game, selfVote: true }, "player_1", "player_1").votes).toEqual({ player_1: "player_1" });
  });

  it("rejects duplicate day votes until the round is reset", () => {
    const game = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_4", nickname: "Carol", role: "villager", alive: true }
    ]);
    let voted = castDayVote(game, "player_1", "player_2");

    expect(() => castDayVote(voted, "player_1", "player_3")).toThrow("Day vote is already used this round");

    voted = {
      ...voted,
      votes: {},
      revoteCount: 1
    };

    expect(castDayVote(voted, "player_1", "player_3").votes).toEqual({ player_1: "player_3" });
  });

  it("stores last words only for living players during active phases", () => {
    const day = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Dead", role: "villager", alive: false }
    ]);

    expect(setLastWords(day, "player_1", "Remember me").lastWords).toEqual({ player_1: "Remember me" });
    expect(() => setLastWords(createLobbyState("room_abc"), "player_1", "soon")).toThrow("active games");
    expect(() => setLastWords({ ...day, phase: "ended", winner: "villagers" }, "player_1", "soon")).toThrow("active games");
    expect(() => setLastWords(day, "player_3", "too late")).toThrow("Living player is required");
  });

  it("reveals last words after day executions", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Wolf", role: "werewolf", alive: true }
    ]);

    game = setLastWords(game, "player_2", "Trust Alice");
    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_4");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.log).toContain("Bob 的遺言：Trust Alice");
  });

  it("reveals last words after night deaths", () => {
    let game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Bob", role: "villager", alive: true }
    ]);

    game = setLastWords(game, "player_2", "It was the wolf");
    game = castNightKill(game, "player_1", "player_2", 0);

    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.log).toContain("Alice 的遺言：It was the wolf");
  });

  it("treats cat revive as optional while preserving submitted revive actions", () => {
    let game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_4", nickname: "Cat", role: "cat", alive: true },
      { playerId: "player_5", nickname: "Dead", role: "villager", alive: false },
      { playerId: "player_6", nickname: "Villager", role: "villager", alive: true },
      { playerId: "player_7", nickname: "Spare", role: "villager", alive: true }
    ]);
    game = { ...game, day: 2 };

    game = castCatRevive(game, "player_4", "player_5", 0, () => 0.95);
    expect(game.phase).toBe("night");

    const seer = castDivination(game, "player_2", "player_1");
    game = seer.state;
    expect(game.phase).toBe("night");

    const childFox = castChildFoxDivination(game, "player_3", "player_1", () => 0.9);
    game = childFox.state;
    expect(game.phase).toBe("night");

    game = castNightKill(game, "player_1", "player_6", 0, () => 0.95);
    expect(game.phase).toBe("day");
    expect(game.players.find((player) => player.playerId === "player_5")?.alive).toBe(true);
    expect(game.players.find((player) => player.playerId === "player_6")?.alive).toBe(false);
  });

  it("resolves night without waiting for cats to use optional revive", () => {
    let game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Guard", role: "guard", alive: true },
      { playerId: "player_4", nickname: "Cat", role: "cat", alive: true },
      { playerId: "player_5", nickname: "Dead", role: "villager", alive: false },
      { playerId: "player_6", nickname: "Target", role: "villager", alive: true },
      { playerId: "player_7", nickname: "Spare", role: "villager", alive: true }
    ]);
    game = { ...game, day: 2 };

    game = castGuard(game, "player_3", "player_2");
    expect(game.phase).toBe("night");

    game = castDivination(game, "player_2", "player_1").state;
    expect(game.phase).toBe("night");

    game = castNightKill(game, "player_1", "player_6", 0);

    expect(game.phase).toBe("day");
    expect(game.catRevives).toEqual({});
    expect(game.players.find((player) => player.playerId === "player_5")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_6")?.alive).toBe(false);
  });

  it("keeps revoting tied day votes until the reference draw limit", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);

    for (let round = 1; round < MAX_REVOTES; round += 1) {
      game = castDayVote(game, "player_1", "player_2");
      game = castDayVote(game, "player_2", "player_1");
      game = castDayVote(game, "player_3", "player_4");
      game = castDayVote(game, "player_4", "player_3");

      expect(game.phase).toBe("day");
      expect(game.revoteCount).toBe(round);
      expect(game.votes).toEqual({});
      expect(game.log.at(-1)).toBe("投票結果平手，重新投票。");
    }

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_3");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("draw");
    expect(game.revoteCount).toBe(0);
    expect(game.players.every((player) => player.alive)).toBe(true);
    expect(game.log.at(-2)).toBe("投票結果平手達到上限，遊戲和局。");
    expect(game.log.at(-1)).toBe("平手。");
  });

  it("clears pending actions owned by players who die", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    game = {
      ...game,
      nightKills: { player_2: "player_3" },
      divinations: { player_2: "player_1" }
    };

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(game.phase).toBe("night");
    expect(game.nightKills).toEqual({});
    expect(game.divinations).toEqual({});

    game = { ...game, votes: { player_3: "player_1" } };
    game = castNightKill(game, "player_1", "player_3", 0);

    expect(game.votes).toEqual({});
  });

  it("treats missing legacy action maps as empty during alarm advancement", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Alice", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "villager", alive: true }
    ];
    const { votes: _dayVotes, nightKills: _dayNightKills, divinations: _dayDivinations, ...legacyDayValue } = activeState("day", players);
    const legacyDay = legacyDayValue as GameState;

    const nextNight = advancePhaseByAlarm(legacyDay);

    expect(nextNight.phase).toBe("night");
    expect(nextNight.votes).toEqual({});
    expect(nextNight.nightKills).toEqual({});
    expect(nextNight.divinations).toEqual({});

    const { nightKills: _nightKills, divinations: _nightDivinations, ...legacyNightValue } = activeState("night", players);
    const legacyNight = legacyNightValue as GameState;

    const nextDay = advancePhaseByAlarm(legacyNight);

    expect(nextDay.phase).toBe("day");
    expect(nextDay.nightKills).toEqual({});
    expect(nextDay.divinations).toEqual({});
  });

  it("warns before sudden-deathing day players who have not voted when a timed phase expires", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Alice", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Dave", role: "villager", alive: true }
    ];
    const day = {
      ...activeState("day", players),
      phaseEndsAt: "2026-05-06T00:00:00.000Z",
      votes: { player_1: "player_2", player_2: "player_1", player_3: "player_2" },
      lastWords: { player_4: "我先走一步" }
    };

    const warning = advancePhaseByAlarm(day, Date.parse("2026-05-06T00:03:00.000Z"));

    expect(warning.phase).toBe("day");
    expect(warning.players.find((player) => player.playerId === "player_4")?.alive).toBe(true);
    expect(warning.votes).toEqual({ player_1: "player_2", player_2: "player_1", player_3: "player_2" });
    expect(warning.phaseEndsAt).toBe("2026-05-06T00:05:00.000Z");
    expect(warning.suddenDeathWarningAt).toBe("2026-05-06T00:03:00.000Z");
    expect(warning.log.at(-1)).toBe("最後2分還不投票將會暴斃");

    const next = advancePhaseByAlarm(warning, Date.parse("2026-05-06T00:05:00.000Z"));

    expect(next.players.find((player) => player.playerId === "player_4")?.alive).toBe(false);
    expect(next.votes).toEqual({});
    expect(next.suddenDeathWarningAt).toBeUndefined();
    expect(next.phaseEndsAt).toBe("2026-05-06T00:08:00.000Z");
    expect(next.log).toContain("Dave 突然暴斃死亡。");
    expect(next.log).toContain("Dave 的遺言：我先走一步");
    expect(next.log.at(-1)).toBe("＜投票結果有問題 請重新投票＞");
  });

  it("draws the game when sudden death kills every living player", () => {
    const day = {
      ...activeState("day", [
        { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_2", nickname: "Villager", role: "villager", alive: true }
      ]),
      phaseEndsAt: "2026-05-06T00:00:00.000Z",
      suddenDeathWarningAt: "2026-05-06T00:00:00.000Z"
    };

    const next = advancePhaseByAlarm(day, Date.parse("2026-05-06T00:02:00.000Z"));

    expect(next.phase).toBe("ended");
    expect(next.winner).toBe("draw");
    expect(next.players.every((player) => !player.alive)).toBe(true);
    expect(next.log).toContain("Wolf 突然暴斃死亡。");
    expect(next.log).toContain("Villager 突然暴斃死亡。");
    expect(next.log.at(-1)).toBe("平手。");
  });

  it("warns before sudden-deathing required night actors who have not acted when a timed phase expires", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Guard", role: "guard", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ];
    const night = {
      ...activeState("night", players),
      phaseEndsAt: "2026-05-06T00:00:00.000Z",
      nightKills: { player_1: "player_4" },
      guards: { player_3: "player_2" }
    };

    const warning = advancePhaseByAlarm(night, Date.parse("2026-05-06T00:01:30.000Z"));

    expect(warning.phase).toBe("night");
    expect(warning.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(warning.nightKills).toEqual({ player_1: "player_4" });
    expect(warning.guards).toEqual({ player_3: "player_2" });
    expect(warning.phaseEndsAt).toBe("2026-05-06T00:03:30.000Z");
    expect(warning.suddenDeathWarningAt).toBe("2026-05-06T00:01:30.000Z");
    expect(warning.log.at(-1)).toBe("最後2分還不投票將會暴斃");

    const next = advancePhaseByAlarm(warning, Date.parse("2026-05-06T00:03:30.000Z"));

    expect(next.players.find((player) => player.playerId === "player_1")?.alive).toBe(true);
    expect(next.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(next.players.find((player) => player.playerId === "player_3")?.alive).toBe(true);
    expect(next.nightKills).toEqual({});
    expect(next.divinations).toEqual({});
    expect(next.guards).toEqual({});
    expect(next.suddenDeathWarningAt).toBeUndefined();
    expect(next.phaseEndsAt).toBe("2026-05-06T00:05:00.000Z");
    expect(next.log).toContain("Seer 突然暴斃死亡。");
  });

  it("does not sudden-death cats for skipping optional revive when a timed night expires", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Guard", role: "guard", alive: true },
      { playerId: "player_4", nickname: "Cat", role: "cat", alive: true },
      { playerId: "player_5", nickname: "Dead", role: "villager", alive: false },
      { playerId: "player_6", nickname: "Target", role: "villager", alive: true },
      { playerId: "player_7", nickname: "Spare", role: "villager", alive: true }
    ];
    const night = {
      ...activeState("night", players),
      day: 2,
      phaseEndsAt: "2026-05-06T00:00:00.000Z",
      nightKills: { player_1: "player_6" },
      divinations: { player_2: "player_1" },
      guards: { player_3: "player_2" }
    };

    const next = advancePhaseByAlarm(night, Date.parse("2026-05-06T00:01:30.000Z"));

    expect(next.phase).toBe("day");
    expect(next.suddenDeathWarningAt).toBeUndefined();
    expect(next.players.find((player) => player.playerId === "player_4")?.alive).toBe(true);
    expect(next.players.find((player) => player.playerId === "player_5")?.alive).toBe(false);
    expect(next.players.find((player) => player.playerId === "player_6")?.alive).toBe(false);
    expect(next.log).not.toContain("Cat 突然暴斃死亡。");
  });

  it("accelerates non-realtime conversation phases after silence", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Alice", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true }
    ];
    const day = {
      ...activeState("day", players),
      realTime: false,
      phaseEndsAt: "2026-05-06T02:00:00.000Z",
      lastSpokenAt: "2026-05-06T00:00:00.000Z"
    };

    const next = recordConversationActivity(day, Date.parse("2026-05-06T00:02:00.000Z"));

    expect(next.phaseEndsAt).toBe("2026-05-06T01:00:00.000Z");
    expect(next.lastSpokenAt).toBe("2026-05-06T00:02:00.000Z");
    expect(next.log.at(-1)).toBe("・・・・・・・・・・ 持續沉默了 1時間");
  });

  it("does not accelerate realtime phases after silence", () => {
    const players: GameState["players"] = [
      { playerId: "player_1", nickname: "Alice", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true }
    ];
    const day = {
      ...activeState("day", players),
      realTime: true,
      phaseEndsAt: "2026-05-06T02:00:00.000Z",
      lastSpokenAt: "2026-05-06T00:00:00.000Z"
    };

    const next = recordConversationActivity(day, Date.parse("2026-05-06T00:02:00.000Z"));

    expect(next.phaseEndsAt).toBe("2026-05-06T02:00:00.000Z");
    expect(next.lastSpokenAt).toBe("2026-05-06T00:02:00.000Z");
    expect(next.log).toEqual([]);
  });

  it("limits player objections during lobby and day", () => {
    let game = upsertLobbyPlayer(createLobbyState("room_abc"), { playerId: "player_1", nickname: "Alice" });

    game = raiseObjection(game, "player_1");
    game = raiseObjection(game, "player_1");

    expect(game.objectionCounts).toEqual({ player_1: 2 });
    expect(game.log.at(-1)).toBe("Alice 提出反對。剩餘 0 次。");
    expect(() => raiseObjection(game, "player_1")).toThrow("No objections remaining");
  });

  it("rejects night objections", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Alice", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true }
    ]);

    expect(() => raiseObjection(game, "player_1")).toThrow("Objection is only available");
  });

  it("ends the room when room-end requests exceed half of living players", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
      { playerId: "player_3", nickname: "Carol", role: "werewolf", alive: true }
    ]);

    game = requestRoomEnd(game, "player_1");
    expect(game.phase).toBe("day");
    expect(game.roomEndVotes).toEqual({ player_1: 1 });

    game = requestRoomEnd(game, "player_2");
    expect(game.phase).toBe("ended");
    expect(game.winner).toBeUndefined();
    expect(game.phaseEndsAt).toBeUndefined();
    expect(game.log).toEqual(expect.arrayContaining(["Alice 要求廢村。", "Bob 要求廢村。", "抗議人數超過生存人數一半，廢村。"]));
  });

  it("rejects duplicate and night room-end requests", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Alice", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Bob", role: "werewolf", alive: true }
    ]);
    game = requestRoomEnd(game, "player_1");

    expect(() => requestRoomEnd(game, "player_1")).toThrow("already requested");
    expect(() => requestRoomEnd({ ...game, phase: "night" }, "player_2")).toThrow("Room end requests are only available");
  });

  it("allows only wolves to perform night kills and detects wolf win", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(() => castNightKill(game, "player_3", "player_1")).toThrow("Only werewolves");
    game = castNightKill(game, "player_1", "player_3", 0);

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("werewolves");
  });

  it("rejects duplicate night kills from the same wolf", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf A", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Wolf B", role: "werewolf", alive: true },
      { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Villager A", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Villager B", role: "villager", alive: true }
    ]);
    const voted = castNightKill(game, "player_1", "player_3", 0);

    expect(voted).toMatchObject({ phase: "night", nightKills: { player_1: "player_3" } });
    expect(() => castNightKill(voted, "player_1", "player_4", 0)).toThrow("Night kill is already used tonight");
  });

  it("counts the werewolf pack as complete after one night kill target", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf A", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Wolf B", role: "big_wolf", alive: true },
      { playerId: "player_3", nickname: "Villager A", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Villager B", role: "villager", alive: true },
      { playerId: "player_5", nickname: "Villager C", role: "villager", alive: true },
      { playerId: "player_6", nickname: "Villager D", role: "villager", alive: true }
    ]);

    const next = castNightKill(game, "player_1", "player_3", 0);

    expect(next.phase).toBe("day");
    expect(next.day).toBe(2);
    expect(next.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
  });

  it("gives foxes the win when a normal win condition happens while a fox is alive", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("foxes");
    expect(game.log.at(-1)).toBe("妖狐勝利。");
  });

  it("gives foxes the win when only a child fox is alive at a normal win condition", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_3");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("foxes");
    expect(game.log.at(-1)).toBe("妖狐勝利。");
  });

  it("does not let a lone child fox steal a wolf win in big-wolf child-fox rooms", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Big Wolf", role: "big_wolf", alive: false },
      { playerId: "player_5", nickname: "Fox", role: "fox", alive: false },
      ...Array.from({ length: 15 }, (_, index) => ({
        playerId: `player_dead_${index + 1}`,
        nickname: `Dead ${index + 1}`,
        role: "villager" as const,
        alive: false
      }))
    ]);

    game = castDayVote(game, "player_1", "player_3");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("werewolves");
    expect(game.log.at(-1)).toBe("狼人勝利。");
  });

  it("keeps fox win priority when a real fox and big wolf survive in big-wolf child-fox rooms", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Big Wolf", role: "big_wolf", alive: true },
      { playerId: "player_2", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_3", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true },
      ...Array.from({ length: 16 }, (_, index) => ({
        playerId: `player_dead_${index + 1}`,
        nickname: `Dead ${index + 1}`,
        role: "villager" as const,
        alive: false
      }))
    ]);

    game = castDayVote(game, "player_1", "player_4");
    game = castDayVote(game, "player_2", "player_4");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("foxes");
    expect(game.log.at(-1)).toBe("妖狐勝利。");
  });

  it("counts a lone big wolf as a werewolf for normal win conditions", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Big Wolf", role: "big_wolf", alive: true },
      { playerId: "player_2", nickname: "Villager", role: "villager", alive: true }
    ]);

    const killed = castNightKill(game, "player_1", "player_2", 0);

    expect(killed.phase).toBe("ended");
    expect(killed.winner).toBe("werewolves");
    expect(killed.log.at(-1)).toBe("狼人勝利。");
  });

  it("keeps foxes alive after wolf attacks", () => {
    const game = castNightKill(
      activeState("night", [
        { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_2", nickname: "Fox", role: "fox", alive: true },
        { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
      ]),
      "player_1",
      "player_2",
      0
    );

    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(game.winner).toBe("foxes");
    expect(game.log).toContain("妖狐被襲擊但沒有死亡。");
  });

  it("kills foxes when seers divine them", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ]);

    const divination = castDivination(game, "player_2", "player_3");

    expect(divination.result).toBe("human");
    expect(divination.state.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
    expect(divination.state.log.at(-1)).toBe("Fox 被占卜後死亡。");
  });

  it("reveals last words after fox divination deaths", () => {
    let game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = setLastWords(game, "player_3", "You found me");
    const divination = castDivination(game, "player_2", "player_3");

    expect(divination.state.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
    expect(divination.state.log).toContain("Fox 的遺言：You found me");
  });

  it("poisons another living player when a poison player is executed", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Poison", role: "poison", alive: true },
      { playerId: "player_2", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.log).toContain("Wolf 被埋毒者牽連死亡。");
  });

  it("poisons a living werewolf when wolves kill a poison player", () => {
    const game = castNightKill(
      activeState("night", [
        { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_2", nickname: "Poison", role: "poison", alive: true },
        { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
      ]),
      "player_1",
      "player_2",
      0
    );

    expect(game.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.winner).toBe("villagers");
    expect(game.log).toContain("Wolf 被埋毒者牽連死亡。");
  });

  it("treats cats as poison when executed", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Cat", role: "cat", alive: true },
      { playerId: "player_2", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.players.find((player) => player.playerId === "player_1")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(game.log).toContain("Wolf 被貓又牽連死亡。");
  });

  it("lets cats survive wolf attacks on a successful roll", () => {
    const game = castNightKill(
      activeState("night", [
        { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_2", nickname: "Cat", role: "cat", alive: true },
        { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
      ]),
      "player_1",
      "player_2",
      0,
      () => 0.95
    );

    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(game.log).toContain("貓又被襲擊但沒有死亡。");
  });

  it("lets cats revive dead players on a successful roll", () => {
    let game = activeState("night", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Cat", role: "cat", alive: true },
      { playerId: "player_3", nickname: "Dead", role: "villager", alive: false },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true }
    ]);
    game = { ...game, day: 2 };

    game = castCatRevive(game, "player_2", "player_3", 0, () => 0.95);
    game = castNightKill(game, "player_1", "player_4", 0, () => 0.95);

    expect(game.players.find((player) => player.playerId === "player_3")?.alive).toBe(true);
    expect(game.log).toContain("Dead 被貓又復活。");
    expect(() => castCatRevive(activeState("day", game.players), "player_2", "player_3")).toThrow("only available at night");
  });

  it("treats big wolves as werewolves for night actions and divination", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Big Wolf", role: "big_wolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    expect(canUseWerewolfChannel(game, "player_1")).toBe(true);
    expect(castDivination(game, "player_2", "player_1", () => 0.95).result).toBe("werewolf");

    const divined = castDivination(game, "player_2", "player_1", () => 0.95);
    const killed = castNightKill(divined.state, "player_1", "player_3", 0);

    expect(killed.players.find((player) => player.playerId === "player_3")?.alive).toBe(false);
  });

  it("builds player stat updates from final winners", () => {
    const wolfWin = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"],
        ["player_6", "Frank"]
      ]),
      0,
      () => 0
    );
    const ended = {
      ...wolfWin,
      phase: "ended" as const,
      winner: "werewolves" as const
    };

    expect(playerStatUpdates(ended)).toEqual([
      { playerId: "player_1", won: true },
      { playerId: "player_2", won: false },
      { playerId: "player_3", won: false },
      { playerId: "player_4", won: true },
      { playerId: "player_5", won: false },
      { playerId: "player_6", won: false }
    ]);
    expect(playerStatUpdates({ ...ended, winner: "villagers" })).toEqual([
      { playerId: "player_1", won: false },
      { playerId: "player_2", won: true },
      { playerId: "player_3", won: true },
      { playerId: "player_4", won: false },
      { playerId: "player_5", won: true },
      { playerId: "player_6", won: true }
    ]);
    expect(playerStatUpdates({ ...wolfWin, phase: "day" })).toEqual([]);
    expect(
      playerStatUpdates({
        ...ended,
        winner: "foxes",
        players: [
          { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
          { playerId: "player_2", nickname: "Mad", role: "madman", alive: true },
          { playerId: "player_3", nickname: "Fox", role: "fox", alive: true },
          { playerId: "player_4", nickname: "Poison", role: "poison", alive: true },
          { playerId: "player_5", nickname: "Betrayer", role: "betrayer", alive: true },
          { playerId: "player_6", nickname: "Child Fox", role: "child_fox", alive: true }
        ]
      })
    ).toEqual([
      { playerId: "player_1", won: false },
      { playerId: "player_2", won: false },
      { playerId: "player_3", won: true },
      { playerId: "player_4", won: false },
      { playerId: "player_5", won: true },
      { playerId: "player_6", won: true }
    ]);
    expect(playerStatUpdates({ ...ended, winner: "draw" })).toEqual([
      { playerId: "player_1", won: false, draw: true },
      { playerId: "player_2", won: false, draw: true },
      { playerId: "player_3", won: false, draw: true },
      { playerId: "player_4", won: false, draw: true },
      { playerId: "player_5", won: false, draw: true },
      { playerId: "player_6", won: false, draw: true }
    ]);
  });

  it("requires at least three players to start", () => {
    expect(() => startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"]]))).toThrow("At least 3 players");
  });

  it("assigns the first lobby player as host and checks start permission", () => {
    const game = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);

    expect(game.hostId).toBe("player_1");
    expect(canStartGame(game, "player_1")).toBe(true);
    expect(canStartGame(game, "player_2")).toBe(false);
    expect(canStartGame(startGame(game, 0, () => 0), "player_1")).toBe(false);
  });

  it("tracks unanimous lobby start votes", () => {
    const waiting = lobby([
      ["player_1", "Alice"],
      ["player_2", "Bob"],
      ["player_3", "Carol"],
      ["player_4", "Dave"],
      ["player_5", "Eve"],
      ["player_6", "Frank"],
      ["player_7", "Grace"],
      ["player_8", "Heidi"]
    ]);
    const first = castLobbyStartVote(waiting, "player_1");
    const duplicate = castLobbyStartVote(first.state, "player_1");
    const second = castLobbyStartVote(duplicate.state, "player_2");
    const almostReady = ["player_3", "player_4", "player_5", "player_6", "player_7"].reduce(
      (state, playerId) => castLobbyStartVote(state, playerId).state,
      second.state
    );
    const final = castLobbyStartVote(almostReady, "player_8");

    expect(first).toMatchObject({ ready: false, votedPlayerIds: ["player_1"], required: 8 });
    expect(duplicate.state.log).toEqual(first.state.log);
    expect(second).toMatchObject({ ready: false, votedPlayerIds: ["player_1", "player_2"], required: 8 });
    expect(final).toMatchObject({ ready: true, votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5", "player_6", "player_7", "player_8"], required: 8 });
    expect(() => castLobbyStartVote(startGame(waiting, 0, () => 0), "player_1")).toThrow("Start votes are only available");
    expect(() => castLobbyStartVote(waiting, "player_missing")).toThrow("Start vote player not found");
  });

  it("requires the reference minimum player count for resident start votes", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const voted = ["player_1", "player_2", "player_3"].reduce((state, playerId) => castLobbyStartVote(state, playerId).state, waiting);
    const result = castLobbyStartVote(voted, "player_3");

    expect(result).toMatchObject({ ready: false, votedPlayerIds: ["player_1", "player_2", "player_3"], required: 8 });
  });

  it("credits dummy boy as one resident start vote like the reference", () => {
    const waiting = lobby([
      ["player_1", "Alice"],
      ["player_2", "Bob"],
      ["player_3", "Carol"],
      ["player_4", "Dave"],
      ["player_5", "Eve"],
      ["player_6", "Frank"],
      ["player_7", "Grace"]
    ]);
    const almostReady = ["player_1", "player_2", "player_3", "player_4", "player_5", "player_6"].reduce(
      (state, playerId) => castLobbyStartVote(state, playerId, { dummyBoy: true }).state,
      waiting
    );
    const final = castLobbyStartVote(almostReady, "player_7", { dummyBoy: true });

    expect(final).toMatchObject({
      ready: true,
      votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5", "player_6", "player_7"],
      required: 8
    });
  });

  it("removes lobby start votes when players leave or are kicked", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const voted = castLobbyStartVote(castLobbyStartVote(waiting, "player_1").state, "player_2").state;

    expect(removeLobbyPlayer(voted, "player_2").lobbyStartVotes).toEqual({ player_1: true });
    expect(leaveLobbyPlayer(voted, "player_1").lobbyStartVotes).toEqual({ player_2: true });
  });

  it("tracks lobby kick votes and removes stale kick ballots", () => {
    let waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"], ["player_5", "Eve"], ["player_6", "Frank"]]);
    waiting = castLobbyKickVote(waiting, "player_1", "player_6").state;
    const duplicate = castLobbyKickVote(waiting, "player_1", "player_6");
    const ready = ["player_2", "player_3", "player_4", "player_5"].reduce((state, playerId) => castLobbyKickVote(state, playerId, "player_6").state, duplicate.state);

    expect(duplicate).toMatchObject({ ready: false, votedPlayerIds: ["player_1"], required: 5, targetNickname: "Frank" });
    expect(duplicate.state.log).toEqual(waiting.log);
    expect(castLobbyKickVote(ready, "player_1", "player_6")).toMatchObject({ ready: true, votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5"] });
    expect(removeLobbyPlayer(ready, "player_1").lobbyKickVotes).toEqual({ player_6: ["player_2", "player_3", "player_4", "player_5"] });
    expect(leaveLobbyPlayer(ready, "player_6").lobbyKickVotes).toEqual({});
    expect(() => castLobbyKickVote(startGame(ready, 0, () => 0), "player_1", "player_6")).toThrow("Kick votes are only available");
    expect(() => castLobbyKickVote(ready, "player_1", "player_1")).toThrow("Cannot kick vote yourself");
    expect(() => castLobbyKickVote(ready, "player_missing", "player_6")).toThrow("Kick vote player not found");
    expect(() => castLobbyKickVote(ready, "player_1", "player_missing")).toThrow("Kick vote target not found");
  });

  it("allows lobby joins but only existing players after start", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const started = startGame(waiting, 0, () => 0);

    expect(canJoinRoomState(waiting, "player_4")).toBe(true);
    expect(canJoinRoomState(started, "player_1")).toBe(true);
    expect(canJoinRoomState(started, "player_4")).toBe(false);
  });

  it("blocks new lobby joins when the room is full", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"]]);

    expect(canJoinRoomState(waiting, "player_1", 2)).toBe(true);
    expect(canJoinRoomState(waiting, "player_3", 2)).toBe(false);
    expect(() => upsertLobbyPlayer(waiting, { playerId: "player_3", nickname: "Carol" }, 2)).toThrow("Room is full");
  });

  it("keeps trip identity unique inside a lobby", () => {
    const waiting = upsertLobbyPlayer(createLobbyState("room_abc"), { playerId: "player_1", nickname: "Alice", tripHash: "trip_a" });
    const renamed = upsertLobbyPlayer(waiting, { playerId: "player_1", nickname: "Alice 2", tripHash: "trip_a" });

    expect(renamed.players[0]).toMatchObject({ playerId: "player_1", nickname: "Alice 2", tripHash: "trip_a" });
    expect(() => upsertLobbyPlayer(renamed, { playerId: "player_2", nickname: "Bob", tripHash: "trip_a" })).toThrow(
      "Trip already joined this room"
    );
  });

  it("stores and publishes default icon choices for lobby players", () => {
    const waiting = upsertLobbyPlayer(createLobbyState("room_abc"), {
      playerId: "player_1",
      nickname: "Alice",
      iconPath: "user_icon/001.gif"
    });
    const renamed = upsertLobbyPlayer(waiting, {
      playerId: "player_1",
      nickname: "Alice 2",
      iconPath: "user_icon/002.gif"
    });

    expect(renamed.players[0]).toMatchObject({ playerId: "player_1", nickname: "Alice 2", iconPath: "user_icon/002.gif" });
    expect(publicPlayers(renamed.players)).toEqual([{ playerId: "player_1", nickname: "Alice 2", alive: true, iconPath: "user_icon/002.gif" }]);
  });

  it("removes lobby players and reassigns host", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const withoutGuest = removeLobbyPlayer(waiting, "player_3");
    const withoutHost = removeLobbyPlayer(withoutGuest, "player_1");

    expect(withoutGuest.players.map((player) => player.playerId)).toEqual(["player_1", "player_2"]);
    expect(withoutGuest.hostId).toBe("player_1");
    expect(withoutHost.players.map((player) => player.playerId)).toEqual(["player_2"]);
    expect(withoutHost.hostId).toBe("player_2");
    expect(() => removeLobbyPlayer(startGame(waiting, 0, () => 0), "player_2")).toThrow("Players can only be kicked");
    expect(() => removeLobbyPlayer(waiting, "player_missing")).toThrow("Kick target not found");
  });

  it("lets lobby players leave and reassigns host", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const withoutGuest = leaveLobbyPlayer(waiting, "player_3");
    const withoutHost = leaveLobbyPlayer(withoutGuest, "player_1");

    expect(withoutGuest.players.map((player) => player.playerId)).toEqual(["player_1", "player_2"]);
    expect(withoutGuest.hostId).toBe("player_1");
    expect(withoutHost.players.map((player) => player.playerId)).toEqual(["player_2"]);
    expect(withoutHost.hostId).toBe("player_2");
    expect(() => leaveLobbyPlayer(startGame(waiting, 0, () => 0), "player_2")).toThrow("Players can only leave");
    expect(() => leaveLobbyPlayer(waiting, "player_missing")).toThrow("Leave target not found");
  });

  it("lets GM adjudication force a winner", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const ended = forceEndGame(day, "villagers");

    expect(ended.phase).toBe("ended");
    expect(ended.winner).toBe("villagers");
    expect(ended.phaseEndsAt).toBeUndefined();
    expect(ended.log).toContain("GM 裁定結束遊戲。");
    expect(() => forceEndGame(createLobbyState("room_abc"), "villagers")).toThrow("Cannot adjudicate");
    expect(() => forceEndGame(ended, "werewolves")).toThrow("Game already ended");
  });

  it("lets GM adjust player life state during active games", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const voted = castDayVote(castDayVote(day, "player_1", "player_2"), "player_3", "player_1");
    const killed = forceSetPlayerAlive(voted, "player_2", false);
    const revived = forceSetPlayerAlive(killed, "player_2", true);

    expect(killed.players.find((player) => player.playerId === "player_2")?.alive).toBe(false);
    expect(killed.votes).toEqual({});
    expect(killed.log).toContain("GM 將 Bob 調整為死亡。");
    expect(revived.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(() => forceSetPlayerAlive(createLobbyState("room_abc"), "player_1", false)).toThrow("active games");
    expect(() => forceSetPlayerAlive(day, "player_missing", false)).toThrow("Life control target not found");
  });

  it("clears all pending actions when GM kills a player and target actions when GM revives", () => {
    const night = {
      ...activeState("night", [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf" as const, alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer" as const, alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard" as const, alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat" as const, alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager" as const, alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager" as const, alive: false },
        { playerId: "player_other", nickname: "Other", role: "villager" as const, alive: true }
      ]),
      nightKills: { player_wolf: "player_target" },
      divinations: { player_seer: "player_target" },
      guards: { player_guard: "player_target" },
      catRevives: { player_cat: "player_dead" }
    };
    const killedTarget = forceSetPlayerAlive(night, "player_target", false);
    const revivedDead = forceSetPlayerAlive(killedTarget, "player_dead", true);

    expect(killedTarget.nightKills).toEqual({});
    expect(killedTarget.divinations).toEqual({});
    expect(killedTarget.guards).toEqual({});
    expect(killedTarget.catRevives).toEqual({});
    expect(revivedDead.catRevives).toEqual({});
  });

  it("lets GM adjust player roles during active games", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const changed = forceSetPlayerRole(day, "player_2", "seer");

    expect(changed.players.find((player) => player.playerId === "player_2")?.role).toBe("seer");
    expect(changed.log).toContain("GM 將 Bob 的角色調整為 seer。");
    expect(() => forceSetPlayerRole(createLobbyState("room_abc"), "player_1", "seer")).toThrow("active games");
    expect(() => forceSetPlayerRole(day, "player_missing", "seer")).toThrow("Role control target not found");
  });

  it("clears pending night actions involving a player when GM adjusts role", () => {
    const night = {
      ...activeState("night", [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf" as const, alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer" as const, alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard" as const, alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat" as const, alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager" as const, alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager" as const, alive: false },
        { playerId: "player_other", nickname: "Other", role: "villager" as const, alive: true }
      ]),
      nightKills: { player_wolf: "player_target" },
      divinations: { player_seer: "player_target" },
      guards: { player_guard: "player_target" },
      catRevives: { player_cat: "player_dead" }
    };
    const changedTarget = forceSetPlayerRole(night, "player_target", "werewolf");
    const changedDead = forceSetPlayerRole(changedTarget, "player_dead", "seer");

    expect(changedTarget.nightKills).toEqual({});
    expect(changedTarget.divinations).toEqual({});
    expect(changedTarget.guards).toEqual({});
    expect(changedTarget.catRevives).toEqual({ player_cat: "player_dead" });
    expect(changedDead.catRevives).toEqual({});
  });

  it("lets GM adjust player flags during active games", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const authority = forceSetPlayerFlag(day, "player_2", "authority", true);
    const cleared = forceSetPlayerFlag(authority, "player_2", "authority", false);

    expect(authority.players.find((player) => player.playerId === "player_2")?.authority).toBe(true);
    expect(authority.log).toContain("GM 將 Bob 的 authority 調整為啟用。");
    expect(cleared.players.find((player) => player.playerId === "player_2")?.authority).toBeUndefined();
    expect(() => forceSetPlayerFlag(createLobbyState("room_abc"), "player_1", "lover", true)).toThrow("active games");
    expect(() => forceSetPlayerFlag(day, "player_missing", "lover", true)).toThrow("Flag control target not found");
  });

  it("lets GM adjust common voice visibility during active games", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const enabled = forceSetCommonTalkVisible(day, true);
    const disabled = forceSetCommonTalkVisible(enabled, false);

    expect(enabled.commonTalkVisible).toBe(true);
    expect(enabled.log).toContain("GM 調整共有頻道公開：開啟。");
    expect(disabled.commonTalkVisible).toBe(false);
    expect(disabled.log).toContain("GM 調整共有頻道公開：關閉。");
    expect(() => forceSetCommonTalkVisible(createLobbyState("room_abc"), true)).toThrow("active games");
  });

  it("lets GM restrict night private channels during active games", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const restricted = forceSetChannelRestrictions(day, { wolf: true, common: false, lovers: true, fox: false });

    expect(restricted.channelRestrictions).toEqual({ wolf: true, common: false, lovers: true, fox: false });
    expect(restricted.log).toContain("GM 調整頻道限制：人狼關閉、共有開啟、戀人關閉、妖狐開啟。");
    expect(() => forceSetChannelRestrictions(createLobbyState("room_abc"), { wolf: true, common: false, lovers: false, fox: false })).toThrow("active games");
  });

  it("allows only living werewolves to use the night channel", () => {
    const day = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    const night = castDayVote(
      castDayVote(castDayVote(castDayVote(day, "player_1", "player_2"), "player_2", "player_3"), "player_3", "player_2"),
      "player_4",
      "player_2"
    );

    expect(canUseWerewolfChannel(day, "player_1")).toBe(false);
    expect(canUseWerewolfChannel(night, "player_1")).toBe(true);
    expect(canUseWerewolfChannel({ ...night, channelRestrictions: { wolf: true, common: false, lovers: false, fox: false } }, "player_1")).toBe(false);
    expect(canUseWerewolfChannel(night, "player_3")).toBe(false);
    expect(canUseWerewolfChannel(night, "player_2")).toBe(false);
  });

  it("allows only living foxes to use the fox channel at night", () => {
    const night = activeState("night", [
      { playerId: "player_1", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_2", nickname: "Child Fox", role: "child_fox", alive: true },
      { playerId: "player_3", nickname: "Betrayer", role: "betrayer", alive: true },
      { playerId: "player_4", nickname: "Villager", role: "villager", alive: true },
      { playerId: "player_5", nickname: "Dead Fox", role: "fox", alive: false }
    ]);

    expect(canUseFoxChannel(night, "player_1")).toBe(true);
    expect(canUseFoxChannel({ ...night, channelRestrictions: { wolf: false, common: false, lovers: false, fox: true } }, "player_1")).toBe(false);
    expect(canUseFoxChannel(night, "player_2")).toBe(false);
    expect(canUseFoxChannel(night, "player_3")).toBe(false);
    expect(canUseFoxChannel(night, "player_4")).toBe(false);
    expect(canUseFoxChannel(night, "player_5")).toBe(false);
    expect(canUseFoxChannel({ ...night, phase: "day" }, "player_1")).toBe(false);
  });

  it("allows only living common partners to use the common channel at night", () => {
    const night = activeState("night", [
      { playerId: "player_1", nickname: "Common A", role: "common", alive: true },
      { playerId: "player_2", nickname: "Common B", role: "common", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Dead Common", role: "common", alive: false }
    ]);

    expect(canUseCommonChannel(night, "player_1")).toBe(true);
    expect(canUseCommonChannel({ ...night, channelRestrictions: { wolf: false, common: true, lovers: false, fox: false } }, "player_1")).toBe(false);
    expect(canUseCommonChannel(night, "player_2")).toBe(true);
    expect(canUseCommonChannel(night, "player_3")).toBe(false);
    expect(canUseCommonChannel(night, "player_4")).toBe(false);
    expect(canUseCommonChannel({ ...night, phase: "day" }, "player_1")).toBe(false);
  });

  it("allows only living lovers to use the lovers channel at night", () => {
    const night = activeState("night", [
      { playerId: "player_1", nickname: "Lover A", role: "villager", alive: true, lover: true },
      { playerId: "player_2", nickname: "Lover B", role: "werewolf", alive: true, lover: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true },
      { playerId: "player_4", nickname: "Dead Lover", role: "villager", alive: false, lover: true }
    ]);

    expect(canUseLoversChannel(night, "player_1")).toBe(true);
    expect(canUseLoversChannel({ ...night, channelRestrictions: { wolf: false, common: false, lovers: true, fox: false } }, "player_1")).toBe(false);
    expect(canUseLoversChannel(night, "player_2")).toBe(true);
    expect(canUseLoversChannel(night, "player_3")).toBe(false);
    expect(canUseLoversChannel(night, "player_4")).toBe(false);
    expect(canUseLoversChannel({ ...night, phase: "day" }, "player_1")).toBe(false);
  });

  it("allows only dead players to use the dead channel during active phases", () => {
    const night = activeState("night", [
      { playerId: "player_1", nickname: "Alive", role: "villager", alive: true },
      { playerId: "player_2", nickname: "Dead", role: "villager", alive: false }
    ]);

    expect(canUseDeadChannel(night, "player_2")).toBe(true);
    expect(canUseDeadChannel(night, "player_1")).toBe(false);
    expect(canUseDeadChannel({ ...night, phase: "day" }, "player_2")).toBe(true);
    expect(canUseDeadChannel({ ...night, phase: "lobby" }, "player_2")).toBe(false);
    expect(canUseDeadChannel({ ...night, phase: "ended", winner: "villagers" }, "player_2")).toBe(false);
  });

  it("allows public chat in lobby and after end but restricts dead players during active phases", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]);
    let game = startGame(waiting, 0, () => 0);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_3");
    game = castDayVote(game, "player_3", "player_2");
    game = castDayVote(game, "player_4", "player_2");

    expect(canUsePublicChat(waiting, "player_new")).toBe(true);
    expect(canUsePublicChat(game, "player_1")).toBe(true);
    expect(canUsePublicChat(game, "player_2")).toBe(false);

    const ended = castNightKill(game, "player_1", "player_3", 0);
    expect(canUsePublicChat(ended, "player_2")).toBe(true);
  });

  it("allows living seers to divine one player per night", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);
    game = castDayVote(game, "player_1", "player_4");
    game = castDayVote(game, "player_2", "player_4");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_3");

    const divination = castDivination(game, "player_2", "player_1");

    expect(divination.result).toBe("werewolf");
    expect(divination.targetNickname).toBe("Alice");
    expect(divination.state.divinations).toEqual({ player_2: "player_1" });
    expect(() => castDivination(divination.state, "player_2", "player_3")).toThrow("already used");
    expect(() => castDivination(game, "player_3", "player_1")).toThrow("Only seers");
  });

  it("returns medium readings only to living mediums during the next day", () => {
    let game = startGame(
      lobby([
        ["player_1", "Alice"],
        ["player_2", "Bob"],
        ["player_3", "Carol"],
        ["player_4", "Dave"],
        ["player_5", "Ellen"]
      ]),
      0,
      () => 0
    );

    game = castDayVote(game, "player_1", "player_4");
    game = castDayVote(game, "player_2", "player_4");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_3");
    game = castDayVote(game, "player_5", "player_3");

    expect(game.phase).toBe("night");
    expect(mediumReadingForPlayer(game, "player_3")).toBeUndefined();

    game = castDivination(game, "player_2", "player_1").state;
    game = castNightKill(game, "player_1", "player_5", 0);

    expect(game.phase).toBe("day");
    expect(mediumReadingForPlayer(game, "player_3")).toEqual({
      day: 1,
      targetPlayerId: "player_4",
      targetNickname: "Dave",
      result: "human"
    });
    expect(mediumReadingForPlayer(game, "player_2")).toBeUndefined();
  });

  it("preserves reference medium results for executed big wolves and child foxes", () => {
    for (const [targetRole, expected] of [
      ["big_wolf", "big_wolf"],
      ["child_fox", "child_fox"]
    ] as const) {
      let game: GameState = {
        ...createLobbyState("room_abc"),
        day: 2,
        players: [
          { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
          { playerId: "player_medium", nickname: "Medium", role: "medium", alive: true },
          { playerId: "player_target", nickname: "Target", role: targetRole, alive: true },
          { playerId: "player_villager_1", nickname: "Villager 1", role: "villager", alive: true },
          { playerId: "player_villager_2", nickname: "Villager 2", role: "villager", alive: true },
          { playerId: "player_villager_3", nickname: "Villager 3", role: "villager", alive: true }
        ],
        phase: "day",
        log: ["第 2 日白天開始。"]
      };

      for (const player of game.players) {
        game = castDayVote(game, player.playerId, player.playerId === "player_target" ? "player_wolf" : "player_target");
      }
      game = castNightKill(game, "player_wolf", "player_villager_1", 0);

      expect(mediumReadingForPlayer(game, "player_medium")).toEqual({
        day: 2,
        targetPlayerId: "player_target",
        targetNickname: "Target",
        result: expected
      });
    }
  });

  it("keeps multiple day sudden-death medium readings for the next day", () => {
    let game: GameState = {
      ...createLobbyState("room_abc"),
      day: 2,
      phase: "day",
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_medium", nickname: "Medium", role: "medium", alive: true },
        { playerId: "player_big_wolf", nickname: "Big Wolf", role: "big_wolf", alive: true },
        { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox", alive: true },
        { playerId: "player_villager_1", nickname: "Villager 1", role: "villager", alive: true },
        { playerId: "player_villager_2", nickname: "Villager 2", role: "villager", alive: true },
        { playerId: "player_villager_3", nickname: "Villager 3", role: "villager", alive: true }
      ],
      votes: {
        player_wolf: "player_villager_3",
        player_medium: "player_villager_3",
        player_villager_1: "player_villager_3",
        player_villager_2: "player_villager_3",
        player_villager_3: "player_wolf"
      },
      phaseEndsAt: "2026-05-06T00:00:00.000Z",
      suddenDeathWarningAt: "2026-05-06T00:00:00.000Z"
    };

    game = advancePhaseByAlarm(game, Date.parse("2026-05-06T00:02:01.000Z"));

    expect(game.phase).toBe("day");
    expect(game.players.find((player) => player.playerId === "player_big_wolf")?.alive).toBe(false);
    expect(game.players.find((player) => player.playerId === "player_child_fox")?.alive).toBe(false);
    expect(mediumReadingsForPlayer(game, "player_medium")).toEqual([]);

    const voters = game.players.filter((player) => player.alive).map((player) => player.playerId);
    for (const voterId of voters) {
      game = castDayVote(game, voterId, voterId === "player_villager_3" ? "player_wolf" : "player_villager_3");
    }
    game = castNightKill(game, "player_wolf", "player_villager_2", 0);

    expect(mediumReadingsForPlayer(game, "player_medium")).toEqual([
      {
        day: 2,
        targetPlayerId: "player_big_wolf",
        targetNickname: "Big Wolf",
        result: "big_wolf"
      },
      {
        day: 2,
        targetPlayerId: "player_child_fox",
        targetNickname: "Child Fox",
        result: "child_fox"
      },
      {
        day: 2,
        targetPlayerId: "player_villager_3",
        targetNickname: "Villager 3",
        result: "human"
      }
    ]);
  });
});

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
