import { describe, expect, it } from "vitest";
import {
  canJoinRoomState,
  canStartGame,
  canUsePublicChat,
  canUseWerewolfChannel,
  castDayVote,
  castDivination,
  castGuard,
  castNightKill,
  commonsForPlayer,
  createLobbyState,
  mediumReadingForPlayer,
  playerStatUpdates,
  startGame,
  upsertLobbyPlayer,
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

function activeState(phase: "day" | "night", players: GameState["players"]): GameState {
  return {
    roomId: "room_abc",
    phase,
    day: 1,
    players,
    votes: {},
    revoteCount: 0,
    nightKills: {},
    divinations: {},
    guards: {},
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
    expect(wolvesForPlayer(game, "player_1")).toEqual([{ playerId: "player_1", nickname: "Alice" }]);
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
      game = castDayVote(game, player.playerId, "player_6");
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
      game = castDayVote(game, player.playerId, "player_7");
    }

    game = castNightKill(game, "player_1", "player_2", 0);
    expect(game.phase).toBe("night");

    game = castGuard(game, "player_5", "player_2", 0);

    expect(game.phase).toBe("day");
    expect(game.players.find((player) => player.playerId === "player_2")?.alive).toBe(true);
    expect(game.guards).toEqual({});
    expect(game.log.at(-2)).toBe("夜晚平安過去。");
    expect(() => castGuard(game, "player_2", "player_3")).toThrow("Guarding is only available at night");
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

  it("adds common partners in thirteen-player games", () => {
    const game = startGame(numberedLobby(13), 0, () => 0);

    expect(game.players.filter((player) => player.role === "common")).toEqual([
      expect.objectContaining({ playerId: "player_12", role: "common" }),
      expect.objectContaining({ playerId: "player_13", role: "common" })
    ]);
    expect(commonsForPlayer(game, "player_12")).toEqual([
      { playerId: "player_12", nickname: "Player 12" },
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
    const withPoison = startGame(numberedLobby(20), 0, () => 0, { poison: true, bigWolf: false });

    expect(normal.players.filter((player) => player.role === "poison")).toHaveLength(0);
    expect(normal.players.filter((player) => player.role === "werewolf")).toHaveLength(3);
    expect(withPoison.players.filter((player) => player.role === "poison")).toHaveLength(1);
    expect(withPoison.players.filter((player) => player.role === "werewolf")).toHaveLength(4);
    expect(withPoison.players.filter((player) => player.role === "villager")).toHaveLength(
      normal.players.filter((player) => player.role === "villager").length - 2
    );
  });

  it("applies the big wolf room option in twenty-player games", () => {
    const game = startGame(numberedLobby(20), 0, () => 0, { poison: false, bigWolf: true });

    expect(game.players.filter((player) => player.role === "big_wolf")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "werewolf")).toHaveLength(2);
    expect(wolvesForPlayer(game, "player_12")).toEqual([
      { playerId: "player_12", nickname: "Player 12" },
      { playerId: "player_13", nickname: "Player 13" },
      { playerId: "player_14", nickname: "Player 14" }
    ]);
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

  it("runs one revote after a tied day vote before moving to night", () => {
    let game = startGame(lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"], ["player_4", "Dave"]]), 0, () => 0);

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_3");

    expect(game.phase).toBe("day");
    expect(game.revoteCount).toBe(1);
    expect(game.votes).toEqual({});
    expect(game.log.at(-1)).toBe("投票結果平手，重新投票。");

    game = castDayVote(game, "player_1", "player_2");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_4");
    game = castDayVote(game, "player_4", "player_3");

    expect(game.phase).toBe("night");
    expect(game.revoteCount).toBe(0);
    expect(game.players.every((player) => player.alive)).toBe(true);
    expect(game.log.at(-2)).toBe("白天沒有共識，無人被處決。");
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

  it("gives foxes the win when a normal win condition happens while a fox is alive", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_2", nickname: "Fox", role: "fox", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_1");
    game = castDayVote(game, "player_2", "player_1");
    game = castDayVote(game, "player_3", "player_1");

    expect(game.phase).toBe("ended");
    expect(game.winner).toBe("foxes");
    expect(game.log.at(-1)).toBe("妖狐勝利。");
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

  it("poisons another living player when a poison player is executed", () => {
    let game = activeState("day", [
      { playerId: "player_1", nickname: "Poison", role: "poison", alive: true },
      { playerId: "player_2", nickname: "Wolf", role: "werewolf", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    game = castDayVote(game, "player_1", "player_1");
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

  it("treats big wolves as werewolves for night actions and divination", () => {
    const game = activeState("night", [
      { playerId: "player_1", nickname: "Big Wolf", role: "big_wolf", alive: true },
      { playerId: "player_2", nickname: "Seer", role: "seer", alive: true },
      { playerId: "player_3", nickname: "Villager", role: "villager", alive: true }
    ]);

    expect(canUseWerewolfChannel(game, "player_1")).toBe(true);
    expect(castDivination(game, "player_2", "player_1").result).toBe("werewolf");

    const killed = castNightKill(game, "player_1", "player_3", 0);

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
          { playerId: "player_4", nickname: "Poison", role: "poison", alive: true }
        ]
      })
    ).toEqual([
      { playerId: "player_1", won: false },
      { playerId: "player_2", won: false },
      { playerId: "player_3", won: true },
      { playerId: "player_4", won: false }
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

  it("allows lobby joins but only existing players after start", () => {
    const waiting = lobby([["player_1", "Alice"], ["player_2", "Bob"], ["player_3", "Carol"]]);
    const started = startGame(waiting, 0, () => 0);

    expect(canJoinRoomState(waiting, "player_4")).toBe(true);
    expect(canJoinRoomState(started, "player_1")).toBe(true);
    expect(canJoinRoomState(started, "player_4")).toBe(false);
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
    expect(canUseWerewolfChannel(night, "player_3")).toBe(false);
    expect(canUseWerewolfChannel(night, "player_2")).toBe(false);
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
});
