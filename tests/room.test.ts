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

function connect(room: RoomDurableObject, socket: WebSocket, playerId: string, nickname: string): void {
  (room as unknown as { sockets: Map<WebSocket, { playerId: string; nickname: string }> }).sockets.set(socket, { playerId, nickname });
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
});
