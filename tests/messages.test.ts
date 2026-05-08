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
  buildGmChatMessage,
  buildGmWhisperMessage,
  buildJoinedMessage,
  buildLastWordsAckMessage,
  buildLobbyKickVoteMessage,
  buildLobbyStartVoteMessage,
  buildLoversChatMessage,
  buildMediumResultMessage,
  buildObjectionMessage,
  buildPresenceMessage,
  buildRevealedRolesMessage,
  buildRoleMessage,
  buildSelfTalkMessage,
  buildWolfChatMessage,
  buildErrorMessage
} from "../src/messages";

describe("messages", () => {
  it("builds joined messages", () => {
    expect(buildJoinedMessage("room_abc", "player_1", [{ playerId: "player_1", nickname: "<Alice>" }])).toEqual({
      type: "joined",
      roomId: "room_abc",
      playerId: "player_1",
      members: [{ playerId: "player_1", nickname: "&lt;Alice&gt;" }]
    });
  });

  it("builds presence messages", () => {
    expect(buildPresenceMessage([{ playerId: "player_1", nickname: "Alice" }, { playerId: "player_gm", nickname: "<GM>", gm: true }])).toEqual({
      type: "presence",
      members: [{ playerId: "player_1", nickname: "Alice" }, { playerId: "player_gm", nickname: "&lt;GM&gt;", gm: true }]
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

  it("builds escaped GM messages", () => {
    expect(buildGmChatMessage("player_gm", "<GM>", "<notice>")).toMatchObject({
      type: "gm_chat",
      playerId: "player_gm",
      nickname: "&lt;GM&gt;",
      text: "&lt;notice&gt;"
    });
    expect(buildGmWhisperMessage("player_gm", "<GM>", { playerId: "player_1", nickname: "<Alice>" }, "<secret>")).toMatchObject({
      type: "gm_whisper",
      playerId: "player_gm",
      nickname: "&lt;GM&gt;",
      targetPlayerId: "player_1",
      targetNickname: "&lt;Alice&gt;",
      text: "&lt;secret&gt;"
    });
  });

  it("builds escaped objection messages", () => {
    expect(buildObjectionMessage("player_1", "<Alice>", 1)).toMatchObject({
      type: "objection",
      playerId: "player_1",
      nickname: "&lt;Alice&gt;",
      remaining: 1
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

  it("builds escaped self talk messages", () => {
    expect(buildSelfTalkMessage("player_1", "<Alive>", "<secret>")).toMatchObject({
      type: "self_talk",
      playerId: "player_1",
      nickname: "&lt;Alive&gt;",
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
        result: "big_wolf"
      })
    ).toEqual({
      type: "medium_result",
      day: 1,
      targetPlayerId: "player_1",
      targetNickname: "&lt;Victim&gt;",
      result: "big_wolf"
    });
  });

  it("builds action acknowledgement messages", () => {
    expect(buildActionAckMessage("guard", "player_1")).toEqual({
      type: "action_ack",
      action: "guard",
      targetPlayerId: "player_1"
    });
    expect(buildActionAckMessage("divine", "player_1")).toEqual({
      type: "action_ack",
      action: "divine",
      targetPlayerId: "player_1"
    });
    expect(buildActionAckMessage("kick_player", "player_2")).toEqual({
      type: "action_ack",
      action: "kick_player",
      targetPlayerId: "player_2"
    });
    expect(buildActionAckMessage("leave_room", "player_3")).toEqual({
      type: "action_ack",
      action: "leave_room",
      targetPlayerId: "player_3"
    });
    expect(buildActionAckMessage("gm_set_role", "player_4")).toEqual({
      type: "action_ack",
      action: "gm_set_role",
      targetPlayerId: "player_4"
    });
    expect(buildActionAckMessage("room_end_vote", "player_5")).toEqual({
      type: "action_ack",
      action: "room_end_vote",
      targetPlayerId: "player_5"
    });
    expect(buildActionAckMessage("gm_advance_phase", "player_gm")).toEqual({
      type: "action_ack",
      action: "gm_advance_phase",
      targetPlayerId: "player_gm"
    });
    expect(buildActionAckMessage("start_game", "player_host")).toEqual({
      type: "action_ack",
      action: "start_game",
      targetPlayerId: "player_host"
    });
  });

  it("builds escaped lobby start vote messages", () => {
    expect(buildLobbyStartVoteMessage("player_1", "<Alice>", ["player_1"], 3, false)).toMatchObject({
      type: "lobby_start_vote",
      playerId: "player_1",
      nickname: "&lt;Alice&gt;",
      votedPlayerIds: ["player_1"],
      required: 3,
      ready: false
    });
  });

  it("builds escaped lobby kick vote messages", () => {
    expect(buildLobbyKickVoteMessage("player_1", "<Alice>", "player_2", "<Bob>", ["player_1"], 5, false)).toMatchObject({
      type: "lobby_kick_vote",
      playerId: "player_1",
      nickname: "&lt;Alice&gt;",
      targetPlayerId: "player_2",
      targetNickname: "&lt;Bob&gt;",
      votedPlayerIds: ["player_1"],
      required: 5,
      ready: false
    });
  });

  it("builds last words acknowledgement messages", () => {
    expect(buildLastWordsAckMessage()).toEqual({ type: "last_words_ack" });
  });

  it("builds escaped error messages", () => {
    expect(buildErrorMessage("<bad>")).toEqual({ type: "error", message: "&lt;bad&gt;" });
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
      roomId: "room_abc",
      phase: "day",
      hostId: undefined,
      revoteCount: 0,
      commonTalkVisible: false,
      openVote: false,
      selfVote: false,
      voteStatus: false,
      objectionCounts: {},
      players: [
        { playerId: "player_1", nickname: "&lt;Wolf&gt;", alive: true },
        { playerId: "player_2", nickname: "Bob", alive: true },
        { playerId: "player_3", nickname: "Carol", alive: true }
      ]
    });
    expect(JSON.stringify(buildGameStateMessage(game))).not.toContain('"role"');

    expect(buildGameStateMessage({ ...game, objectionCounts: { player_1: 2, missing_player: 1 } })).toMatchObject({
      type: "game_state",
      objectionCounts: { player_1: 2 }
    });

    expect(buildGameStateMessage({ ...game, roomEndVotes: { player_1: game.day, player_2: game.day - 1, missing_player: game.day } })).toMatchObject({
      type: "game_state",
      roomEndVotedPlayerIds: ["player_1"]
    });

    const suddenDeathWarningAt = "2026-05-06T00:03:00.000Z";
    expect(buildGameStateMessage({ ...game, suddenDeathWarningAt })).toMatchObject({
      type: "game_state",
      suddenDeathWarningAt
    });
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

    expect(buildGameStateMessage(hidden)).toMatchObject({ type: "game_state", openVote: false, voteStatus: false, votes: {}, votedPlayerIds: [] });
    expect(buildGameStateMessage(hidden, "player_1")).toMatchObject({ type: "game_state", openVote: false, voteStatus: false, votes: { player_1: "player_2" }, votedPlayerIds: ["player_1"] });
    expect(buildGameStateMessage(hidden, "player_2")).toMatchObject({ type: "game_state", openVote: false, voteStatus: false, votes: {}, votedPlayerIds: [] });
    expect(buildGameStateMessage(statusOnly)).toMatchObject({ type: "game_state", openVote: false, voteStatus: true, votes: {}, votedPlayerIds: ["player_1"] });
    expect(buildGameStateMessage(statusOnly, "player_1")).toMatchObject({ type: "game_state", openVote: false, voteStatus: true, votes: { player_1: "player_2" }, votedPlayerIds: ["player_1"] });
    expect(buildGameStateMessage(statusOnly, "player_2")).toMatchObject({ type: "game_state", openVote: false, voteStatus: true, votes: {}, votedPlayerIds: ["player_1"] });
    expect(buildGameStateMessage(visible)).toMatchObject({ type: "game_state", openVote: true, voteStatus: false, votes: { player_1: "player_2" }, votedPlayerIds: [] });
    expect(buildGameStateMessage(visibleWithStatus)).toMatchObject({
      type: "game_state",
      openVote: true,
      voteStatus: true,
      votes: { player_1: "player_2" },
      votedPlayerIds: ["player_1"]
    });

    expect(buildGameStateMessage({ ...hidden, selfVote: true })).toMatchObject({
      type: "game_state",
      selfVote: true
    });
  });

  it("publishes filtered lobby kick vote status for current resident targets", () => {
    const game = {
      ...createLobbyState("room_abc"),
      players: [
        { playerId: "player_1", nickname: "One", role: "villager" as const, alive: true },
        { playerId: "player_2", nickname: "Two", role: "villager" as const, alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager" as const, alive: true }
      ],
      lobbyKickVotes: {
        player_target: ["player_1", "missing_voter", "player_2"],
        missing_target: ["player_1"]
      }
    };

    expect(buildGameStateMessage(game)).toMatchObject({
      type: "game_state",
      lobbyKickVoteTargets: [{ targetPlayerId: "player_target", votedPlayerIds: ["player_1", "player_2"] }]
    });
    expect(buildGameStateMessage({ ...game, phase: "day" as const, day: 1 })).toMatchObject({
      type: "game_state",
      lobbyKickVoteTargets: undefined
    });
  });

  it("shows submitted night action actors and only exposes action targets to the actor", () => {
    const game = {
      ...createLobbyState("room_abc"),
      phase: "night" as const,
      voteStatus: true,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf" as const, alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer" as const, alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard" as const, alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat" as const, alive: true },
        { playerId: "player_bystander", nickname: "Bystander", role: "villager" as const, alive: true }
      ],
      nightKills: { player_wolf: "target_wolf" },
      divinations: { player_seer: "target_seer" },
      guards: { player_guard: "target_guard" },
      catRevives: { player_cat: "target_cat" }
    };

    const message = buildGameStateMessage(game);

    expect(message).toMatchObject({
      type: "game_state",
      votes: {},
      votedPlayerIds: ["player_wolf", "player_seer", "player_guard", "player_cat"]
    });
    expect(JSON.stringify(message)).not.toContain("target_wolf");
    expect(JSON.stringify(message)).not.toContain("target_seer");
    expect(JSON.stringify(message)).not.toContain("target_guard");
    expect(JSON.stringify(message)).not.toContain("target_cat");

    expect(buildGameStateMessage(game, "player_wolf")).toMatchObject({
      type: "game_state",
      votedPlayerIds: ["player_wolf", "player_seer", "player_guard", "player_cat"],
      ownNightActionTarget: { action: "night_kill", targetPlayerId: "target_wolf" }
    });
    expect(buildGameStateMessage(game, "player_seer")).toMatchObject({
      type: "game_state",
      ownNightActionTarget: { action: "divine", targetPlayerId: "target_seer" }
    });
    expect(buildGameStateMessage(game, "player_guard")).toMatchObject({
      type: "game_state",
      ownNightActionTarget: { action: "guard", targetPlayerId: "target_guard" }
    });
    expect(buildGameStateMessage(game, "player_cat")).toMatchObject({
      type: "game_state",
      ownNightActionTarget: { action: "cat_revive", targetPlayerId: "target_cat" }
    });
    expect(buildGameStateMessage(game, "player_bystander")).toMatchObject({
      type: "game_state",
      ownNightActionTarget: undefined
    });

    const childFoxGame = {
      ...game,
      players: game.players.map((player) => (player.playerId === "player_seer" ? { ...player, role: "child_fox" as const } : player))
    };
    expect(buildGameStateMessage(childFoxGame, "player_seer")).toMatchObject({
      type: "game_state",
      ownNightActionTarget: { action: "child_fox_divine", targetPlayerId: "target_seer" }
    });

    const hiddenStatusGame = { ...game, voteStatus: false };
    expect(buildGameStateMessage(hiddenStatusGame)).toMatchObject({
      type: "game_state",
      votedPlayerIds: []
    });
    expect(buildGameStateMessage(hiddenStatusGame, "player_wolf")).toMatchObject({
      type: "game_state",
      votedPlayerIds: ["player_wolf"],
      ownNightActionTarget: { action: "night_kill", targetPlayerId: "target_wolf" }
    });
    expect(buildGameStateMessage(hiddenStatusGame, "player_bystander")).toMatchObject({
      type: "game_state",
      votedPlayerIds: [],
      ownNightActionTarget: undefined
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
      expect(message.roomId).toBe("room_abc");
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
