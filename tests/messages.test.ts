import { describe, expect, it } from "vitest";
import { createLobbyState, startGame } from "../src/game";
import {
  buildActionAckMessage,
  buildChatMessage,
  buildChildFoxResultMessage,
  buildCommonChatMessage,
  buildDeadChatMessage,
  buildDivinationResultMessage,
  buildFoxChatMessage,
  buildGameStateMessage,
  buildJoinedMessage,
  buildLastWordsAckMessage,
  buildLoversChatMessage,
  buildMediumResultMessage,
  buildPresenceMessage,
  buildRevealedRolesMessage,
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
    expect(buildPresenceMessage([{ playerId: "player_1", nickname: "Alice" }, { playerId: "player_gm", nickname: "GM", gm: true }])).toEqual({
      type: "presence",
      members: [{ playerId: "player_1", nickname: "Alice" }, { playerId: "player_gm", nickname: "GM", gm: true }]
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

  it("builds escaped fox chat messages", () => {
    expect(buildFoxChatMessage("player_1", "<Fox>", "<secret>")).toMatchObject({
      type: "fox_chat",
      playerId: "player_1",
      nickname: "&lt;Fox&gt;",
      text: "&lt;secret&gt;"
    });
  });

  it("builds escaped common chat messages", () => {
    expect(buildCommonChatMessage("player_1", "<Common>", "<secret>")).toMatchObject({
      type: "common_chat",
      playerId: "player_1",
      nickname: "&lt;Common&gt;",
      text: "&lt;secret&gt;"
    });
  });

  it("builds escaped lovers chat messages", () => {
    expect(buildLoversChatMessage("player_1", "<Lover>", "<secret>")).toMatchObject({
      type: "lovers_chat",
      playerId: "player_1",
      nickname: "&lt;Lover&gt;",
      text: "&lt;secret&gt;"
    });
  });

  it("builds escaped dead chat messages", () => {
    expect(buildDeadChatMessage("player_1", "<Dead>", "<secret>")).toMatchObject({
      type: "dead_chat",
      playerId: "player_1",
      nickname: "&lt;Dead&gt;",
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

  it("builds last words acknowledgement messages", () => {
    expect(buildLastWordsAckMessage()).toEqual({ type: "last_words_ack" });
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

  it("hides vote mappings unless open vote is enabled", () => {
    const hidden = {
      ...createLobbyState("room_abc"),
      votes: { player_1: "player_2" },
      openVote: false,
      voteStatus: false
    };
    const visible = { ...hidden, openVote: true };
    const statusOnly = { ...hidden, voteStatus: true };
    const visibleWithStatus = { ...visible, voteStatus: true };

    expect(buildGameStateMessage(hidden)).toMatchObject({ type: "game_state", votes: {}, votedPlayerIds: [] });
    expect(buildGameStateMessage(statusOnly)).toMatchObject({ type: "game_state", votes: {}, votedPlayerIds: ["player_1"] });
    expect(buildGameStateMessage(visible)).toMatchObject({ type: "game_state", votes: { player_1: "player_2" }, votedPlayerIds: [] });
    expect(buildGameStateMessage(visibleWithStatus)).toMatchObject({
      type: "game_state",
      votes: { player_1: "player_2" },
      votedPlayerIds: ["player_1"]
    });
  });

  it("builds revealed role maps for dead role visibility", () => {
    const game = {
      ...createLobbyState("room_abc"),
      players: [
        { playerId: "player_1", nickname: "Alice", role: "werewolf" as const, alive: true },
        { playerId: "player_2", nickname: "Bob", role: "seer" as const, alive: false }
      ]
    };

    expect(buildRevealedRolesMessage(game)).toEqual({
      type: "revealed_roles",
      roles: {
        player_1: "werewolf",
        player_2: "seer"
      }
    });
  });

  it("escapes public game state log entries", () => {
    const game = {
      ...createLobbyState("room_abc"),
      log: ["Alice 的遺言：<script>alert(1)</script>"]
    };

    const message = buildGameStateMessage(game);

    expect(message.type).toBe("game_state");
    if (message.type === "game_state") {
      expect(message.log).toEqual(["Alice 的遺言：&lt;script&gt;alert(1)&lt;/script&gt;"]);
    }
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
