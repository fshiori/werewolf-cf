import { describe, expect, it } from "vitest";
import { createLobbyState, startGame } from "../src/game";
import {
  buildActionAckMessage,
  buildChatMessage,
  buildChildFoxResultMessage,
  buildDivinationResultMessage,
  buildGameStateMessage,
  buildJoinedMessage,
  buildMediumResultMessage,
  buildPresenceMessage,
  buildRoleMessage,
  buildWolfChatMessage
} from "../src/messages";

describe("messages", () => {
  it("builds joined messages", () => {
    expect(buildJoinedMessage("room_abc", "player_1", [])).toEqual({
      type: "joined",
      roomId: "room_abc",
      playerId: "player_1",
      members: []
    });
  });

  it("builds presence messages", () => {
    expect(buildPresenceMessage([{ playerId: "player_1", nickname: "Alice" }])).toEqual({
      type: "presence",
      members: [{ playerId: "player_1", nickname: "Alice" }]
    });
  });

  it("builds escaped chat messages", () => {
    expect(buildChatMessage("player_1", "Alice", "<hello>")).toMatchObject({
      type: "chat",
      playerId: "player_1",
      nickname: "Alice",
      text: "&lt;hello&gt;"
    });
  });

  it("builds escaped werewolf chat messages", () => {
    expect(buildWolfChatMessage("player_1", "<Wolf>", "<secret>")).toMatchObject({
      type: "wolf_chat",
      playerId: "player_1",
      nickname: "&lt;Wolf&gt;",
      text: "&lt;secret&gt;"
    });
  });

  it("builds escaped divination result messages", () => {
    expect(buildDivinationResultMessage("player_1", "<Wolf>", "werewolf")).toEqual({
      type: "divination_result",
      targetPlayerId: "player_1",
      targetNickname: "&lt;Wolf&gt;",
      result: "werewolf"
    });
  });

  it("builds escaped child fox result messages", () => {
    expect(buildChildFoxResultMessage("player_1", "<Wolf>", "failed")).toEqual({
      type: "child_fox_result",
      targetPlayerId: "player_1",
      targetNickname: "&lt;Wolf&gt;",
      result: "failed"
    });
  });

  it("builds escaped medium result messages", () => {
    expect(
      buildMediumResultMessage({
        day: 1,
        targetPlayerId: "player_1",
        targetNickname: "<Victim>",
        result: "human"
      })
    ).toEqual({
      type: "medium_result",
      day: 1,
      targetPlayerId: "player_1",
      targetNickname: "&lt;Victim&gt;",
      result: "human"
    });
  });

  it("builds action acknowledgement messages", () => {
    expect(buildActionAckMessage("guard", "player_1")).toEqual({
      type: "action_ack",
      action: "guard",
      targetPlayerId: "player_1"
    });
  });

  it("builds public game state messages without roles", () => {
    const game = startGame(
      {
        ...createLobbyState("room_abc"),
        players: [
          { playerId: "player_1", nickname: "<Wolf>", role: "villager", alive: true },
          { playerId: "player_2", nickname: "Bob", role: "villager", alive: true },
          { playerId: "player_3", nickname: "Carol", role: "villager", alive: true }
        ]
      },
      0
    );

    expect(buildGameStateMessage(game)).toMatchObject({
      type: "game_state",
      phase: "day",
      hostId: undefined,
      revoteCount: 0,
      players: [
        { playerId: "player_1", nickname: "&lt;Wolf&gt;", alive: true },
        { playerId: "player_2", nickname: "Bob", alive: true },
        { playerId: "player_3", nickname: "Carol", alive: true }
      ]
    });
    expect(JSON.stringify(buildGameStateMessage(game))).not.toContain('"role"');
  });

  it("builds role messages with escaped wolf list", () => {
    expect(buildRoleMessage("werewolf", [{ playerId: "player_1", nickname: "<Wolf>" }])).toEqual({
      type: "role",
      role: "werewolf",
      wolves: [{ playerId: "player_1", nickname: "&lt;Wolf&gt;" }],
      commons: [],
      lovers: [],
      foxes: [],
      authority: false
    });
  });

  it("builds role messages with escaped common partner list", () => {
    expect(buildRoleMessage("common", [], [{ playerId: "player_2", nickname: "<Shared>" }])).toEqual({
      type: "role",
      role: "common",
      wolves: [],
      commons: [{ playerId: "player_2", nickname: "&lt;Shared&gt;" }],
      lovers: [],
      foxes: [],
      authority: false
    });
  });

  it("builds role messages with authority flag", () => {
    expect(buildRoleMessage("villager", [], [], [], [], true)).toEqual({
      type: "role",
      role: "villager",
      wolves: [],
      commons: [],
      lovers: [],
      foxes: [],
      authority: true
    });
  });

  it("builds role messages with escaped lover partner list", () => {
    expect(buildRoleMessage("villager", [], [], [{ playerId: "player_2", nickname: "<Love>" }])).toEqual({
      type: "role",
      role: "villager",
      wolves: [],
      commons: [],
      lovers: [{ playerId: "player_2", nickname: "&lt;Love&gt;" }],
      foxes: [],
      authority: false
    });
  });

  it("builds role messages with escaped fox list", () => {
    expect(buildRoleMessage("betrayer", [], [], [], [{ playerId: "player_2", nickname: "<Fox>" }])).toEqual({
      type: "role",
      role: "betrayer",
      wolves: [],
      commons: [],
      lovers: [],
      foxes: [{ playerId: "player_2", nickname: "&lt;Fox&gt;" }],
      authority: false
    });
  });
});
