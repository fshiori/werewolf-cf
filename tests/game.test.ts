import { describe, expect, it } from "vitest";
import {
  canJoinRoomState,
  canStartGame,
  canUseWerewolfChannel,
  castDayVote,
  castDivination,
  castNightKill,
  createLobbyState,
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
    expect(wolvesForPlayer(game, "player_1")).toEqual([{ playerId: "player_1", nickname: "Alice" }]);
    expect(wolvesForPlayer(game, "player_2")).toEqual([]);
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
});
