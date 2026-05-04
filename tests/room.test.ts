import { describe, expect, it } from "vitest";
import { RoomDurableObject } from "../src/room";
import type { GameState } from "../src/types";

type SentMessage = {
  type: string;
  message: string;
  action?: string;
  targetPlayerId?: string;
  playerId?: string;
  nickname?: string;
  text?: string;
  sentAt?: string;
  phase?: string;
  day?: number;
  role?: string;
  wolves?: Array<{ playerId: string; nickname: string }>;
  players?: Array<{ playerId: string; nickname: string; alive: boolean; role?: string }>;
};

function roomObject(gameState?: GameState): RoomDurableObject {
  const stored = new Map<string, unknown>(gameState ? [["gameState", gameState]] : []);
  return new RoomDurableObject(
    {
      id: { name: "room_abc" },
      storage: {
        async get(key: string) {
          return stored.get(key);
        },
        async put(key: string, value: unknown) {
          stored.set(key, value);
        },
        async setAlarm() {},
        async deleteAlarm() {}
      }
    } as unknown as DurableObjectState,
    {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return { option_role: "", dellook: 0, dummy_name: "替身君", dummy_last_words: "", gm_trip_hash: null };
                },
                async run() {
                  return {};
                }
              };
            }
          };
        },
        async batch() {
          return [];
        }
      }
    } as unknown as Env
  );
}

function fakeSocket(messages: SentMessage[]): WebSocket {
  return {
    send(data: string) {
      messages.push(JSON.parse(data) as SentMessage);
    }
  } as WebSocket;
}

async function sendRaw(room: RoomDurableObject, socket: WebSocket, data: string): Promise<void> {
  await (room as unknown as { onMessage(socket: WebSocket, event: MessageEvent): Promise<void> }).onMessage(socket, { data } as MessageEvent);
}

function connect(room: RoomDurableObject, socket: WebSocket, playerId: string, nickname: string, gm = false): void {
  (room as unknown as { sockets: Map<WebSocket, { playerId: string; nickname: string; gm?: boolean }> }).sockets.set(socket, {
    playerId,
    nickname,
    gm: gm || undefined
  });
}

describe("RoomDurableObject", () => {
  it("reports malformed websocket JSON without closing the socket handler", async () => {
    const room = roomObject();
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);

    await sendRaw(room, socket, "{bad");
    await sendRaw(room, socket, JSON.stringify({ type: "chat", text: "still open" }));

    expect(messages).toEqual([
      { type: "error", message: "Invalid JSON" },
      { type: "error", message: "Join required" }
    ]);
  });

  it("rejects pre-join websocket commands", async () => {
    const commands = [
      { type: "chat", text: "hello" },
      { type: "vote", targetPlayerId: "player_target" },
      { type: "night_kill", targetPlayerId: "player_target" }
    ];

    for (const command of commands) {
      const room = roomObject();
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);

      await sendRaw(room, socket, JSON.stringify(command));

      expect(messages).toEqual([{ type: "error", message: "Join required" }]);
    }
  });

  it("reports websocket validation errors without crashing", async () => {
    const invalidPlayerMessages: SentMessage[] = [];
    await sendRaw(
      roomObject(),
      fakeSocket(invalidPlayerMessages),
      JSON.stringify({ type: "join", playerId: "bad", nickname: "Alice" })
    );
    expect(invalidPlayerMessages).toEqual([{ type: "error", message: "Invalid player id" }]);

    const emptyNicknameMessages: SentMessage[] = [];
    await sendRaw(
      roomObject(),
      fakeSocket(emptyNicknameMessages),
      JSON.stringify({ type: "join", playerId: "player_valid", nickname: "   " })
    );
    expect(emptyNicknameMessages).toEqual([{ type: "error", message: "Nickname is required" }]);

    const chatMessages: SentMessage[] = [];
    const chatSocket = fakeSocket(chatMessages);
    const chatRoom = roomObject();
    connect(chatRoom, chatSocket, "player_valid", "Alice");
    await sendRaw(chatRoom, chatSocket, JSON.stringify({ type: "chat", text: "x".repeat(501) }));
    await sendRaw(chatRoom, chatSocket, JSON.stringify({ type: "chat", text: "ok" }));

    expect(chatMessages).toEqual([
      { type: "error", message: "Chat text is too long" },
      { type: "chat", playerId: "player_valid", nickname: "Alice", text: "ok", sentAt: expect.any(String) }
    ]);
  });

  it("rejects unauthorized private channel websocket commands", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_dead_wolf", nickname: "Dead Wolf", role: "werewolf", alive: false },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false }
      ],
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
    const cases = [
      {
        playerId: "player_villager",
        nickname: "Villager",
        command: { type: "wolf_chat", text: "secret" },
        message: "Werewolf channel is only available to living werewolves at night"
      },
      {
        playerId: "player_dead_wolf",
        nickname: "Dead Wolf",
        command: { type: "wolf_chat", text: "secret" },
        message: "Werewolf channel is only available to living werewolves at night"
      },
      {
        playerId: "player_villager",
        nickname: "Villager",
        command: { type: "fox_chat", text: "secret" },
        message: "Fox channel is only available to living foxes at night"
      },
      {
        playerId: "player_villager",
        nickname: "Villager",
        command: { type: "common_chat", text: "secret" },
        message: "Common channel is only available to living common partners at night"
      },
      {
        playerId: "player_villager",
        nickname: "Villager",
        command: { type: "lovers_chat", text: "secret" },
        message: "Lovers channel is only available to living lovers at night"
      },
      {
        playerId: "player_villager",
        nickname: "Villager",
        command: { type: "dead_chat", text: "secret" },
        message: "Dead channel is only available to dead players during the game"
      },
      {
        playerId: "player_wolf",
        nickname: "Wolf",
        command: { type: "dead_chat", text: "secret" },
        message: "Dead channel is only available to dead players during the game"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname);

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects public chat from dead players during active games", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 2,
      players: [
        { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false }
      ],
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
    const room = roomObject(game);
    const aliveMessages: SentMessage[] = [];
    const deadMessages: SentMessage[] = [];
    const aliveSocket = fakeSocket(aliveMessages);
    const deadSocket = fakeSocket(deadMessages);
    connect(room, aliveSocket, "player_alive", "Alive");
    connect(room, deadSocket, "player_dead", "Dead");

    await sendRaw(room, deadSocket, JSON.stringify({ type: "chat", text: "hello" }));
    await sendRaw(room, aliveSocket, JSON.stringify({ type: "chat", text: "ok" }));

    expect(deadMessages).toEqual([
      { type: "error", message: "Only living players can chat during the game" },
      expect.objectContaining({ type: "chat", playerId: "player_alive", text: "ok" })
    ]);
    expect(aliveMessages).toEqual([expect.objectContaining({ type: "chat", playerId: "player_alive", text: "ok" })]);
  });

  it("rejects GM websocket commands from non-GM sockets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [{ playerId: "player_villager", nickname: "Villager", role: "villager", alive: true }],
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
    const cases = [
      { command: { type: "gm_chat", text: "notice" }, message: "GM chat is only available to the GM" },
      {
        command: { type: "gm_whisper", targetPlayerId: "player_villager", text: "secret" },
        message: "GM whisper is only available to the GM"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_villager", "Villager");

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("sends GM whisper only to GM and target sockets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_other", nickname: "Other", role: "villager", alive: true }
      ],
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
    const room = roomObject(game);
    const gmMessages: SentMessage[] = [];
    const targetMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const targetSocket = fakeSocket(targetMessages);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, targetSocket, "player_target", "Target");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_whisper", targetPlayerId: "player_target", text: "secret" }));

    expect(gmMessages).toEqual([expect.objectContaining({ type: "gm_whisper", playerId: "player_gm", text: "secret" })]);
    expect(targetMessages).toEqual([expect.objectContaining({ type: "gm_whisper", playerId: "player_gm", text: "secret" })]);
    expect(otherMessages).toEqual([]);
  });

  it("rejects GM whisper commands with missing targets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [{ playerId: "player_target", nickname: "Target", role: "villager", alive: true }],
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
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_gm", "GM", true);

    await sendRaw(room, socket, JSON.stringify({ type: "gm_whisper", targetPlayerId: "player_missing", text: "secret" }));

    expect(messages).toEqual([{ type: "error", message: "GM whisper target not found" }]);
  });

  it("rejects GM control websocket commands from non-GM sockets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true }
      ],
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
    const cases = [
      { command: { type: "gm_advance_phase" }, message: "Only the GM can advance phases" },
      { command: { type: "gm_end_game", winner: "villagers" }, message: "Only the GM can adjudicate games" },
      {
        command: { type: "gm_set_alive", targetPlayerId: "player_target", alive: false },
        message: "Only the GM can adjust life state"
      },
      {
        command: { type: "gm_set_role", targetPlayerId: "player_target", role: "seer" },
        message: "Only the GM can adjust roles"
      },
      {
        command: { type: "gm_set_flag", targetPlayerId: "player_target", flag: "lover", enabled: true },
        message: "Only the GM can adjust player flags"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_villager", "Villager");

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects GM control websocket commands with missing targets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [{ playerId: "player_target", nickname: "Target", role: "villager", alive: true }],
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
    const cases = [
      {
        command: { type: "gm_set_alive", targetPlayerId: "player_missing", alive: false },
        message: "Life control target not found"
      },
      {
        command: { type: "gm_set_role", targetPlayerId: "player_missing", role: "seer" },
        message: "Role control target not found"
      },
      {
        command: { type: "gm_set_flag", targetPlayerId: "player_missing", flag: "lover", enabled: true },
        message: "Flag control target not found"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_gm", "GM", true);

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects host-only websocket commands from non-host sockets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true }
      ],
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
    const cases = [
      { command: { type: "start_game" }, message: "Only the room host can start the game" },
      {
        command: { type: "kick_player", targetPlayerId: "player_target" },
        message: "Only the room host or GM can kick players"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_guest", "Guest");

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects last words websocket commands when the room option is disabled", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [{ playerId: "player_alive", nickname: "Alive", role: "villager", alive: true }],
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
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_alive", "Alive");

    await sendRaw(room, socket, JSON.stringify({ type: "set_last_words", text: "remember me" }));

    expect(messages).toEqual([{ type: "error", message: "Last words are not enabled in this room" }]);
  });

  it("rejects invalid vote websocket commands", async () => {
    const cases: Array<{
      game: GameState;
      playerId: string;
      nickname: string;
      message: string;
    }> = [
      {
        game: {
          roomId: "room_abc",
          phase: "night",
          day: 1,
          players: [
            { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
            { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true }
          ],
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
        },
        playerId: "player_alive",
        nickname: "Alive",
        message: "Voting is only available during the day"
      },
      {
        game: {
          roomId: "room_abc",
          phase: "day",
          day: 1,
          players: [
            { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false },
            { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true }
          ],
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
        },
        playerId: "player_dead",
        nickname: "Dead",
        message: "Living player is required"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname);

      await sendRaw(room, socket, JSON.stringify({ type: "vote", targetPlayerId: "player_target" }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("sends only each socket's own role message", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true }
      ],
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
    const room = roomObject(game);
    const wolfMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, villagerSocket, "player_villager", "Villager");

    (room as unknown as { sendRoles(gameState: GameState): void }).sendRoles(game);

    expect(wolfMessages).toEqual([
      expect.objectContaining({
        type: "role",
        role: "werewolf",
        wolves: [{ playerId: "player_wolf", nickname: "Wolf" }]
      })
    ]);
    expect(villagerMessages).toEqual([
      expect.objectContaining({
        type: "role",
        role: "villager",
        wolves: []
      })
    ]);
  });

  it("broadcasts public game state without roles", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true }
      ],
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
    const room = roomObject(game);
    const wolfMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, villagerSocket, "player_villager", "Villager");

    await (room as unknown as { broadcastGameState(gameState: GameState): Promise<void> }).broadcastGameState(game);

    for (const message of [wolfMessages[0], villagerMessages[0]]) {
      expect(message).toMatchObject({
        type: "game_state",
        players: [
          { playerId: "player_wolf", nickname: "Wolf", alive: true },
          { playerId: "player_villager", nickname: "Villager", alive: true },
          { playerId: "player_seer", nickname: "Seer", alive: true }
        ]
      });
      expect(JSON.stringify(message)).not.toContain('"role"');
    }
  });

  it("sends wolf chat only to living werewolf sockets", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_big_wolf", nickname: "Big Wolf", role: "big_wolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_dead_wolf", nickname: "Dead Wolf", role: "werewolf", alive: false }
      ],
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
    const room = roomObject(game);
    const wolfMessages: SentMessage[] = [];
    const bigWolfMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const deadWolfMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const bigWolfSocket = fakeSocket(bigWolfMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const deadWolfSocket = fakeSocket(deadWolfMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, bigWolfSocket, "player_big_wolf", "Big Wolf");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, deadWolfSocket, "player_dead_wolf", "Dead Wolf");

    (room as unknown as { broadcastWerewolf(gameState: GameState, message: unknown): void }).broadcastWerewolf(game, {
      type: "wolf_chat",
      playerId: "player_wolf",
      nickname: "Wolf",
      text: "secret",
      sentAt: "2026-05-04T00:00:00.000Z"
    });

    expect(wolfMessages).toEqual([expect.objectContaining({ type: "wolf_chat", text: "secret" })]);
    expect(bigWolfMessages).toEqual([expect.objectContaining({ type: "wolf_chat", text: "secret" })]);
    expect(villagerMessages).toEqual([]);
    expect(deadWolfMessages).toEqual([]);
  });

  it("sends fox chat only to living fox sockets", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_fox", nickname: "Fox", role: "fox", alive: true },
        { playerId: "player_betrayer", nickname: "Betrayer", role: "betrayer", alive: true },
        { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_dead_fox", nickname: "Dead Fox", role: "fox", alive: false }
      ],
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
    const room = roomObject(game);
    const foxMessages: SentMessage[] = [];
    const betrayerMessages: SentMessage[] = [];
    const childFoxMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const deadFoxMessages: SentMessage[] = [];
    const foxSocket = fakeSocket(foxMessages);
    const betrayerSocket = fakeSocket(betrayerMessages);
    const childFoxSocket = fakeSocket(childFoxMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const deadFoxSocket = fakeSocket(deadFoxMessages);
    connect(room, foxSocket, "player_fox", "Fox");
    connect(room, betrayerSocket, "player_betrayer", "Betrayer");
    connect(room, childFoxSocket, "player_child_fox", "Child Fox");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, deadFoxSocket, "player_dead_fox", "Dead Fox");

    (room as unknown as { broadcastFox(gameState: GameState, message: unknown): void }).broadcastFox(game, {
      type: "fox_chat",
      playerId: "player_fox",
      nickname: "Fox",
      text: "secret",
      sentAt: "2026-05-04T00:00:00.000Z"
    });

    expect(foxMessages).toEqual([expect.objectContaining({ type: "fox_chat", text: "secret" })]);
    expect(betrayerMessages).toEqual([]);
    expect(childFoxMessages).toEqual([]);
    expect(villagerMessages).toEqual([]);
    expect(deadFoxMessages).toEqual([]);
  });

  it("sends common chat only to living common sockets", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_common_a", nickname: "Common A", role: "common", alive: true },
        { playerId: "player_common_b", nickname: "Common B", role: "common", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_dead_common", nickname: "Dead Common", role: "common", alive: false }
      ],
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
    const room = roomObject(game);
    const commonAMessages: SentMessage[] = [];
    const commonBMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const deadCommonMessages: SentMessage[] = [];
    const commonASocket = fakeSocket(commonAMessages);
    const commonBSocket = fakeSocket(commonBMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const deadCommonSocket = fakeSocket(deadCommonMessages);
    connect(room, commonASocket, "player_common_a", "Common A");
    connect(room, commonBSocket, "player_common_b", "Common B");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, deadCommonSocket, "player_dead_common", "Dead Common");

    (room as unknown as { broadcastCommon(gameState: GameState, message: unknown): void }).broadcastCommon(game, {
      type: "common_chat",
      playerId: "player_common_a",
      nickname: "Common A",
      text: "secret",
      sentAt: "2026-05-04T00:00:00.000Z"
    });

    expect(commonAMessages).toEqual([expect.objectContaining({ type: "common_chat", text: "secret" })]);
    expect(commonBMessages).toEqual([expect.objectContaining({ type: "common_chat", text: "secret" })]);
    expect(villagerMessages).toEqual([]);
    expect(deadCommonMessages).toEqual([]);
  });

  it("sends lovers chat only to living lover sockets", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_lover_a", nickname: "Lover A", role: "villager", alive: true, lover: true },
        { playerId: "player_lover_b", nickname: "Lover B", role: "werewolf", alive: true, lover: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_dead_lover", nickname: "Dead Lover", role: "villager", alive: false, lover: true }
      ],
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
    const room = roomObject(game);
    const loverAMessages: SentMessage[] = [];
    const loverBMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const deadLoverMessages: SentMessage[] = [];
    const loverASocket = fakeSocket(loverAMessages);
    const loverBSocket = fakeSocket(loverBMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const deadLoverSocket = fakeSocket(deadLoverMessages);
    connect(room, loverASocket, "player_lover_a", "Lover A");
    connect(room, loverBSocket, "player_lover_b", "Lover B");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, deadLoverSocket, "player_dead_lover", "Dead Lover");

    (room as unknown as { broadcastLovers(gameState: GameState, message: unknown): void }).broadcastLovers(game, {
      type: "lovers_chat",
      playerId: "player_lover_a",
      nickname: "Lover A",
      text: "secret",
      sentAt: "2026-05-04T00:00:00.000Z"
    });

    expect(loverAMessages).toEqual([expect.objectContaining({ type: "lovers_chat", text: "secret" })]);
    expect(loverBMessages).toEqual([expect.objectContaining({ type: "lovers_chat", text: "secret" })]);
    expect(villagerMessages).toEqual([]);
    expect(deadLoverMessages).toEqual([]);
  });

  it("sends dead chat only to dead player sockets during active games", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false },
        { playerId: "player_dead_wolf", nickname: "Dead Wolf", role: "werewolf", alive: false }
      ],
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
    const room = roomObject(game);
    const aliveMessages: SentMessage[] = [];
    const deadMessages: SentMessage[] = [];
    const deadWolfMessages: SentMessage[] = [];
    const aliveSocket = fakeSocket(aliveMessages);
    const deadSocket = fakeSocket(deadMessages);
    const deadWolfSocket = fakeSocket(deadWolfMessages);
    connect(room, aliveSocket, "player_alive", "Alive");
    connect(room, deadSocket, "player_dead", "Dead");
    connect(room, deadWolfSocket, "player_dead_wolf", "Dead Wolf");

    (room as unknown as { broadcastDead(gameState: GameState, message: unknown): void }).broadcastDead(game, {
      type: "dead_chat",
      playerId: "player_dead",
      nickname: "Dead",
      text: "secret",
      sentAt: "2026-05-04T00:00:00.000Z"
    });

    expect(aliveMessages).toEqual([]);
    expect(deadMessages).toEqual([expect.objectContaining({ type: "dead_chat", text: "secret" })]);
    expect(deadWolfMessages).toEqual([expect.objectContaining({ type: "dead_chat", text: "secret" })]);
  });

  it("broadcasts game state when child fox divination completes the night", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_child", nickname: "Child Fox", role: "child_fox", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_villager_2", nickname: "Villager 2", role: "villager", alive: true },
        { playerId: "player_villager_3", nickname: "Villager 3", role: "villager", alive: true }
      ],
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
      nightKills: { player_wolf: "player_villager" },
      divinations: {},
      guards: {},
      catRevives: {},
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_child", "Child Fox");

    await sendRaw(room, socket, JSON.stringify({ type: "child_fox_divine", targetPlayerId: "player_wolf" }));

    expect(messages.some((message) => message.type === "child_fox_result")).toBe(true);
    expect(messages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "child_fox_divine", targetPlayerId: "player_wolf" }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 2 }));
  });

  it("broadcasts game state when seer divination completes the night", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_villager_2", nickname: "Villager 2", role: "villager", alive: true },
        { playerId: "player_villager_3", nickname: "Villager 3", role: "villager", alive: true }
      ],
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
      nightKills: { player_wolf: "player_villager" },
      divinations: {},
      guards: {},
      catRevives: {},
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_seer", "Seer");

    await sendRaw(room, socket, JSON.stringify({ type: "divine", targetPlayerId: "player_wolf" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "divination_result", targetPlayerId: "player_wolf" }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 2 }));
  });

  it("rejects villager night kills through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true }
      ],
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
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_villager", "Villager");

    await sendRaw(room, socket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_target" }));

    expect(messages).toEqual([{ type: "error", message: "Only werewolves can perform night kills" }]);
  });

  it("rejects night role actions from unauthorized websocket players", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false }
      ],
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
    const cases = [
      { command: { type: "divine", targetPlayerId: "player_target" }, message: "Only seers can divine players" },
      {
        command: { type: "child_fox_divine", targetPlayerId: "player_target" },
        message: "Only child foxes can divine players"
      },
      { command: { type: "guard", targetPlayerId: "player_target" }, message: "Only guards can protect players" },
      { command: { type: "cat_revive", targetPlayerId: "player_dead" }, message: "Only cats can revive players" }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_villager", "Villager");

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects night action websocket commands outside the night phase", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 2,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
        { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox", alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard", alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false }
      ],
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
    const cases = [
      {
        playerId: "player_wolf",
        nickname: "Wolf",
        command: { type: "night_kill", targetPlayerId: "player_target" },
        message: "Night actions are only available at night"
      },
      {
        playerId: "player_seer",
        nickname: "Seer",
        command: { type: "divine", targetPlayerId: "player_target" },
        message: "Divination is only available at night"
      },
      {
        playerId: "player_child_fox",
        nickname: "Child Fox",
        command: { type: "child_fox_divine", targetPlayerId: "player_target" },
        message: "Child fox divination is only available at night"
      },
      {
        playerId: "player_guard",
        nickname: "Guard",
        command: { type: "guard", targetPlayerId: "player_target" },
        message: "Guarding is only available at night"
      },
      {
        playerId: "player_cat",
        nickname: "Cat",
        command: { type: "cat_revive", targetPlayerId: "player_dead" },
        message: "Cat revival is only available at night"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname);

      await sendRaw(room, socket, JSON.stringify(testCase.command));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });
});
