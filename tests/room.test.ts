import { describe, expect, it } from "vitest";
import { RoomDurableObject } from "../src/room";
import type { GameState } from "../src/types";

type SentMessage = {
  type: string;
  message: string;
  roomId?: string;
  members?: Array<{ playerId: string; nickname: string; gm?: boolean }>;
  action?: string;
  targetPlayerId?: string;
  targetNickname?: string;
  playerId?: string;
  votedPlayerIds?: string[];
  roomEndVotedPlayerIds?: string[];
  lobbyStartVotedPlayerIds?: string[];
  required?: number;
  ready?: boolean;
  nickname?: string;
  text?: string;
  sentAt?: string;
  phase?: string;
  day?: number;
  votes?: Record<string, string>;
  ownNightActionTarget?: { action: string; targetPlayerId: string };
  commonTalkVisible?: boolean;
  channelRestrictions?: { wolf: boolean; common: boolean; lovers: boolean; fox: boolean };
  log?: string[];
  role?: string;
  result?: string;
  wolves?: Array<{ playerId: string; nickname: string }>;
  lovers?: Array<{ playerId: string; nickname: string }>;
  roles?: Record<string, string>;
  players?: Array<{ playerId: string; nickname: string; alive: boolean; role?: string }>;
  winner?: string;
};

type CloseEvent = {
  code: number;
  reason: string;
};

type RoomRow = {
  option_role: string;
  dellook: number;
  dummy_name: string;
  dummy_last_words: string;
  gm_trip_hash: string | null;
};

function roomObject(gameState?: GameState, roomRow: Partial<RoomRow> = {}): RoomDurableObject {
  const stored = new Map<string, unknown>(gameState ? [["gameState", gameState]] : []);
  const row = {
    option_role: "",
    dellook: 0,
    dummy_name: "替身君",
    dummy_last_words: "",
    gm_trip_hash: null,
    ...roomRow
  };
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
                  return row;
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

type StoragePut = {
  key: string;
  value: unknown;
};

type DbRun = {
  query: string;
  binds: unknown[];
};

type BoundStatement = {
  query: string;
  binds: unknown[];
};

function observableRoomObject(gameState: GameState, roomRow: Partial<RoomRow> = {}) {
  const stored = new Map<string, unknown>([["gameState", gameState]]);
  const puts: StoragePut[] = [];
  const alarms: Date[] = [];
  const deletedAlarms: number[] = [];
  const dbRuns: DbRun[] = [];
  const batches: BoundStatement[][] = [];
  const row = {
    option_role: "",
    dellook: 0,
    dummy_name: "替身君",
    dummy_last_words: "",
    gm_trip_hash: null,
    ...roomRow
  };
  const room = new RoomDurableObject(
    {
      id: { name: "room_abc" },
      storage: {
        async get(key: string) {
          return stored.get(key);
        },
        async put(key: string, value: unknown) {
          stored.set(key, value);
          puts.push({ key, value });
        },
        async setAlarm(value: Date) {
          alarms.push(value);
        },
        async deleteAlarm() {
          deletedAlarms.push(Date.now());
        }
      }
    } as unknown as DurableObjectState,
    {
      DB: {
        prepare(query: string) {
          return {
            bind(...binds: unknown[]) {
              return {
                query,
                binds,
                async first() {
                  return query.includes("FROM rooms") ? row : null;
                },
                async run() {
                  dbRuns.push({ query, binds });
                  return {};
                }
              };
            }
          };
        },
        async batch(statements: BoundStatement[]) {
          batches.push(statements);
          dbRuns.push({ query: "batch", binds: statements });
          return [];
        }
      }
    } as unknown as Env
  );
  return { room, stored, puts, alarms, deletedAlarms, dbRuns, batches };
}

function fakeSocket(messages: SentMessage[], closes: CloseEvent[] = []): WebSocket {
  return {
    send(data: string) {
      messages.push(JSON.parse(data) as SentMessage);
    },
    close(code?: number, reason?: string) {
      closes.push({ code: code ?? 1005, reason: reason ?? "" });
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
  it("advances phases through the Durable Object alarm and broadcasts the saved state", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 0,
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_other", nickname: "Other", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_dummy_boy", nickname: "替身君", role: "villager", alive: true }
      ],
      votes: {},
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: false,
      wishRole: false,
      dummyBoy: true,
      dayMs: 180_000,
      nightMs: 90_000,
      selfVote: false,
      voteStatus: false,
      revoteCount: 0,
      nightKills: { player_wolf: "player_dummy_boy" },
      divinations: {},
      guards: {},
      catRevives: {},
      lastWords: {},
      phaseEndsAt: "2026-05-04T00:00:00.000Z",
      log: ["第 0 日夜晚開始。"]
    };
    const { room, stored, puts, alarms, deletedAlarms, dbRuns } = observableRoomObject(game);
    const hostMessages: SentMessage[] = [];
    const wolfMessages: SentMessage[] = [];
    connect(room, fakeSocket(hostMessages), "player_host", "Host");
    connect(room, fakeSocket(wolfMessages), "player_wolf", "Wolf");

    await room.alarm();

    const saved = stored.get("gameState") as GameState;
    expect(saved).toEqual(expect.objectContaining({ phase: "day", day: 1 }));
    expect(saved.log).toContain("替身君 在夜晚死亡。");
    expect(saved.log).toContain("第 1 日白天開始。");
    expect(puts).toContainEqual({ key: "gameState", value: saved });
    expect(alarms).toHaveLength(1);
    expect(alarms[0]?.toISOString()).toBe(saved.phaseEndsAt);
    expect(deletedAlarms).toEqual([]);
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("UPDATE rooms SET status = 'playing'"),
        binds: ["room_abc"]
      })
    );
    expect(puts).toContainEqual({ key: "roomPlayingSynced", value: true });
    expect(hostMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
    expect(wolfMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
  });

  it("syncs the active room status to D1 only once", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
      phaseEndsAt: "2026-05-04T00:00:00.000Z",
      log: []
    };
    const { room, puts, dbRuns } = observableRoomObject(game);

    await (room as unknown as { syncRoomStatus(gameState: GameState): Promise<void> }).syncRoomStatus(game);
    await (room as unknown as { syncRoomStatus(gameState: GameState): Promise<void> }).syncRoomStatus(game);

    expect(dbRuns.filter((run) => run.query.includes("UPDATE rooms SET status = 'playing'"))).toHaveLength(1);
    expect(puts).toContainEqual({ key: "roomPlayingSynced", value: true });
  });

  it("persists final game records and player stats exactly once when a GM ends a game", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 2,
      players: [
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: false },
        { playerId: "player_fox", nickname: "Fox", role: "fox", alive: false }
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
      phaseEndsAt: "2026-05-04T00:00:00.000Z",
      log: []
    };
    const { room, stored, puts, deletedAlarms, batches } = observableRoomObject(game);
    const gmMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, villagerSocket, "player_villager", "Villager");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_end_game", winner: "villagers" }));
    await (room as unknown as { syncRoomStatus(gameState: GameState): Promise<void> }).syncRoomStatus(stored.get("gameState") as GameState);

    const saved = stored.get("gameState") as GameState;
    expect(saved).toEqual(expect.objectContaining({ phase: "ended", winner: "villagers", phaseEndsAt: undefined }));
    expect(deletedAlarms).toHaveLength(1);
    expect(puts).toContainEqual({ key: "gameFinalized", value: true });
    expect(batches).toHaveLength(1);
    const finalizationBatch = batches[0] ?? [];
    expect(finalizationBatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ query: expect.stringContaining("UPDATE rooms SET status = 'ended'"), binds: ["room_abc"] }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO game_records"), binds: expect.arrayContaining(["room_abc"]) }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO room_events"), binds: expect.arrayContaining(["room_abc"]) }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO player_stats"), binds: ["player_villager", 1, 0] }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO player_stats"), binds: ["player_wolf", 0, 1] }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO player_stats"), binds: ["player_fox", 0, 1] })
      ])
    );
    const gameRecord = finalizationBatch.find((statement) => statement.query.includes("INSERT INTO game_records"));
    expect(JSON.parse(gameRecord?.binds[1] as string)).toEqual({
      winner: "villagers",
      day: 2,
      players: saved.players
    });
    expect(gmMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "ended", winner: "villagers" }));
    expect(villagerMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "ended", winner: "villagers" }));
    expect(villagerMessages).toContainEqual(expect.objectContaining({ type: "revealed_roles" }));
  });

  it("counts draw games without adding player wins or losses", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "ended",
      day: 2,
      players: [
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
      winner: "draw",
      log: ["平手。"]
    };
    const { room, batches } = observableRoomObject(game);

    await (room as unknown as { syncRoomStatus(gameState: GameState): Promise<void> }).syncRoomStatus(game);

    const finalizationBatch = batches[0] ?? [];
    expect(finalizationBatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO player_stats"), binds: ["player_villager", 0, 0] }),
        expect.objectContaining({ query: expect.stringContaining("INSERT INTO player_stats"), binds: ["player_wolf", 0, 0] })
      ])
    );
  });

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

  it("publishes vetted default icon choices from websocket joins", async () => {
    const room = roomObject();
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);

    await sendRaw(
      room,
      socket,
      JSON.stringify({ type: "join", playerId: "player_icon", nickname: "Icon", iconPath: "user_icon/001.gif" })
    );

    expect(messages).toContainEqual(
      expect.objectContaining({
        type: "game_state",
        players: [expect.objectContaining({ playerId: "player_icon", nickname: "Icon", alive: true, iconPath: "user_icon/001.gif" })]
      })
    );

    const invalidMessages: SentMessage[] = [];
    await sendRaw(
      roomObject(),
      fakeSocket(invalidMessages),
      JSON.stringify({ type: "join", playerId: "player_icon", nickname: "Icon", iconPath: "img/grave.gif" })
    );

    expect(invalidMessages).toEqual([{ type: "error", message: "Invalid icon path" }]);
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

  it("persists public chat as room transcript events", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const { room, dbRuns } = observableRoomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_alive", "Alive");

    await sendRaw(room, socket, JSON.stringify({ type: "chat", text: "hello transcript" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "chat", playerId: "player_alive", text: "hello transcript" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_alive",
          "public_chat",
          JSON.stringify({ nickname: "Alive", text: "hello transcript", phase: "day", day: 1 })
        ]
      })
    );
  });

  it("broadcasts and persists objections", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const { room, stored, dbRuns } = observableRoomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_alive", "Alive");

    await sendRaw(room, socket, JSON.stringify({ type: "objection" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "objection", playerId: "player_alive", nickname: "Alive", remaining: 1 }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", log: expect.arrayContaining(["Alive 提出反對。剩餘 1 次。"]) }));
    expect((stored.get("gameState") as GameState).objectionCounts).toEqual({ player_alive: 1 });
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_alive",
          "objection",
          JSON.stringify({ nickname: "Alive", remaining: 1, phase: "day", day: 1 })
        ]
      })
    );
  });

  it("ends the room when live room-end requests exceed half of living players", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_a", nickname: "Alice", role: "villager", alive: true },
        { playerId: "player_b", nickname: "Bob", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
      ],
      votes: { player_a: "player_wolf" },
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
    const { room, stored, batches, dbRuns } = observableRoomObject(game);
    const aliceMessages: SentMessage[] = [];
    const bobMessages: SentMessage[] = [];
    const aliceSocket = fakeSocket(aliceMessages);
    const bobSocket = fakeSocket(bobMessages);
    connect(room, aliceSocket, "player_a", "Alice");
    connect(room, bobSocket, "player_b", "Bob");

    await sendRaw(room, aliceSocket, JSON.stringify({ type: "room_end_vote" }));
    expect((stored.get("gameState") as GameState).phase).toBe("day");
    expect(aliceMessages).toContainEqual(expect.objectContaining({ type: "game_state", roomEndVotedPlayerIds: ["player_a"] }));

    await sendRaw(room, bobSocket, JSON.stringify({ type: "room_end_vote" }));

    const saved = stored.get("gameState") as GameState;
    expect(saved.phase).toBe("ended");
    expect(saved.winner).toBeUndefined();
    expect(saved.votes).toEqual({});
    expect(saved.log).toEqual(expect.arrayContaining(["Alice 要求廢村。", "Bob 要求廢村。", "抗議人數超過生存人數一半，廢村。"]));
    const endedMessage = bobMessages.find((message) => message.type === "game_state" && message.phase === "ended");
    expect(endedMessage).toBeDefined();
    expect(endedMessage).not.toHaveProperty("winner");
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_b",
          "room_end_requested",
          JSON.stringify({ nickname: "Bob", phase: "ended", day: 1 })
        ]
      })
    );
    expect(batches[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: expect.stringContaining("UPDATE rooms SET status = 'ended'"), binds: ["room_abc"] }),
      expect.objectContaining({ query: expect.stringContaining("INSERT INTO game_records") })
    ]));
  });

  it("persists private chat as private transcript events", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true }
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
    const { room, dbRuns } = observableRoomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_wolf", "Wolf");

    await sendRaw(room, socket, JSON.stringify({ type: "wolf_chat", text: "secret transcript" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "wolf_chat", playerId: "player_wolf", text: "secret transcript" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_wolf",
          "wolf_chat",
          JSON.stringify({ visibility: "private", nickname: "Wolf", text: "secret transcript", phase: "night", day: 1 })
        ]
      })
    );
  });

  it("broadcasts wolf and fox lover composite night talk to lover sockets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true, lover: true },
        { playerId: "player_fox", nickname: "Fox", role: "fox", alive: true, lover: true },
        { playerId: "player_lover", nickname: "Lover", role: "villager", alive: true, lover: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_packmate", nickname: "Packmate", role: "big_wolf", alive: true }
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
    const { room, dbRuns } = observableRoomObject(game);
    const wolfMessages: SentMessage[] = [];
    const foxMessages: SentMessage[] = [];
    const loverMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const packmateMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const foxSocket = fakeSocket(foxMessages);
    const loverSocket = fakeSocket(loverMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const packmateSocket = fakeSocket(packmateMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, foxSocket, "player_fox", "Fox");
    connect(room, loverSocket, "player_lover", "Lover");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, packmateSocket, "player_packmate", "Packmate");

    await sendRaw(room, wolfSocket, JSON.stringify({ type: "wolf_chat", text: "wolf lover secret" }));
    await sendRaw(room, foxSocket, JSON.stringify({ type: "fox_chat", text: "fox lover secret" }));

    expect(wolfMessages).toContainEqual(expect.objectContaining({ type: "wolf_chat", text: "wolf lover secret" }));
    expect(packmateMessages).toContainEqual(expect.objectContaining({ type: "wolf_chat", text: "wolf lover secret" }));
    expect(loverMessages).toContainEqual(expect.objectContaining({ type: "wolf_chat", text: "wolf lover secret" }));
    expect(loverMessages).toContainEqual(expect.objectContaining({ type: "fox_chat", text: "fox lover secret" }));
    expect(foxMessages).toContainEqual(expect.objectContaining({ type: "fox_chat", text: "fox lover secret" }));
    expect(villagerMessages).toEqual([]);
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_wolf",
          "wolf_chat",
          JSON.stringify({ visibility: "private", nickname: "Wolf", text: "wolf lover secret", phase: "night", day: 1, location: "night wolf lovers" })
        ]
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_fox",
          "fox_chat",
          JSON.stringify({ visibility: "private", nickname: "Fox", text: "fox lover secret", phase: "night", day: 1, location: "night fox lovers" })
        ]
      })
    );
  });

  it("falls back restricted night channels to lovers or self talk like the reference", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true, lover: true },
        { playerId: "player_lover", nickname: "Lover", role: "villager", alive: true, lover: true },
        { playerId: "player_common", nickname: "Common", role: "common", alive: true },
        { playerId: "player_packmate", nickname: "Packmate", role: "big_wolf", alive: true }
      ],
      votes: {},
      openVote: false,
      commonTalkVisible: false,
      channelRestrictions: { wolf: true, common: true, lovers: false, fox: false },
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
    const { room, dbRuns } = observableRoomObject(game);
    const wolfMessages: SentMessage[] = [];
    const loverMessages: SentMessage[] = [];
    const commonMessages: SentMessage[] = [];
    const packmateMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const loverSocket = fakeSocket(loverMessages);
    const commonSocket = fakeSocket(commonMessages);
    const packmateSocket = fakeSocket(packmateMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, loverSocket, "player_lover", "Lover");
    connect(room, commonSocket, "player_common", "Common");
    connect(room, packmateSocket, "player_packmate", "Packmate");

    await sendRaw(room, wolfSocket, JSON.stringify({ type: "wolf_chat", text: "restricted wolf lover" }));
    await sendRaw(room, commonSocket, JSON.stringify({ type: "common_chat", text: "restricted common self" }));

    expect(wolfMessages).toContainEqual(expect.objectContaining({ type: "lovers_chat", text: "restricted wolf lover" }));
    expect(loverMessages).toContainEqual(expect.objectContaining({ type: "lovers_chat", text: "restricted wolf lover" }));
    expect(packmateMessages).toEqual([]);
    expect(commonMessages).toContainEqual(expect.objectContaining({ type: "self_talk", text: "restricted common self" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_wolf",
          "lovers_chat",
          JSON.stringify({ visibility: "private", nickname: "Wolf", text: "restricted wolf lover", phase: "night", day: 1, location: "night lovers", sourceChannel: "wolf" })
        ]
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_common",
          "self_talk",
          JSON.stringify({ visibility: "private", nickname: "Common", text: "restricted common self", phase: "night", day: 1, location: "night self_talk" })
        ]
      })
    );
  });

  it("persists and echoes self talk only to the speaker", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_alive", nickname: "Alive", role: "villager", alive: true },
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
    const { room, dbRuns } = observableRoomObject(game);
    const speakerMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const speakerSocket = fakeSocket(speakerMessages);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, speakerSocket, "player_alive", "Alive");
    connect(room, otherSocket, "player_other", "Other");
    speakerMessages.length = 0;
    otherMessages.length = 0;

    await sendRaw(room, speakerSocket, JSON.stringify({ type: "self_talk", text: "private mutter" }));

    expect(speakerMessages).toEqual([expect.objectContaining({ type: "self_talk", playerId: "player_alive", text: "private mutter" })]);
    expect(otherMessages).toEqual([]);
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_alive",
          "self_talk",
          JSON.stringify({ visibility: "private", nickname: "Alive", text: "private mutter", phase: "night", day: 1 })
        ]
      })
    );
  });

  it("persists night actions as private transcript events", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
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
    const { room, dbRuns } = observableRoomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_wolf", "Wolf");

    await sendRaw(room, socket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_villager" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "night_kill", targetPlayerId: "player_villager" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_wolf",
          "night_kill",
          JSON.stringify({
            visibility: "private",
            nickname: "Wolf",
            targetPlayerId: "player_villager",
            targetNickname: "Villager",
            phase: "night",
            day: 1
          })
        ]
      })
    );
  });

  it("persists hidden day votes as private transcript events", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_voter", nickname: "Voter", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true },
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
    const { room, dbRuns } = observableRoomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_voter", "Voter");

    await sendRaw(room, socket, JSON.stringify({ type: "vote", targetPlayerId: "player_target" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "vote", targetPlayerId: "player_target" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: [
          "room_abc",
          "player_voter",
          "day_vote",
          JSON.stringify({
            visibility: "private",
            nickname: "Voter",
            targetPlayerId: "player_target",
            targetNickname: "Target",
            phase: "day",
            day: 1,
            revoteCount: 0
          })
        ]
      })
    );
  });

  it("sends hidden day vote targets only to the voter websocket", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_voter", nickname: "Voter", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true },
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
    const voterMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const voterSocket = fakeSocket(voterMessages);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, voterSocket, "player_voter", "Voter");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, voterSocket, JSON.stringify({ type: "vote", targetPlayerId: "player_target" }));

    expect(voterMessages).toContainEqual(expect.objectContaining({ type: "game_state", openVote: false, votes: { player_voter: "player_target" }, votedPlayerIds: ["player_voter"] }));
    expect(otherMessages).toContainEqual(expect.objectContaining({ type: "game_state", openVote: false, votes: {}, votedPlayerIds: [] }));
  });

  it("sends night action targets only to the actor websocket", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
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
      voteStatus: true,
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
    const otherMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, wolfSocket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_target" }));

    expect(wolfMessages).toContainEqual(
      expect.objectContaining({
        type: "game_state",
        phase: "night",
        ownNightActionTarget: { action: "night_kill", targetPlayerId: "player_target" },
        votedPlayerIds: ["player_wolf"]
      })
    );
    const otherGameState = otherMessages.find((message) => message.type === "game_state" && message.phase === "night");
    expect(otherGameState).toMatchObject({
      type: "game_state",
      phase: "night",
      votedPlayerIds: ["player_wolf"]
    });
    expect(otherGameState?.ownNightActionTarget).toBeUndefined();
  });

  it("allows existing players but rejects new players joining active games", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_existing", nickname: "Existing", role: "seer", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const existingMessages: SentMessage[] = [];
    const newPlayerMessages: SentMessage[] = [];

    await sendRaw(
      room,
      fakeSocket(existingMessages),
      JSON.stringify({ type: "join", playerId: "player_existing", nickname: "Existing" })
    );
    await sendRaw(
      room,
      fakeSocket(newPlayerMessages),
      JSON.stringify({ type: "join", playerId: "player_new", nickname: "New" })
    );

    expect(existingMessages).toContainEqual(
      expect.objectContaining({ type: "joined", roomId: "room_abc", playerId: "player_existing" })
    );
    expect(existingMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
    expect(existingMessages).toContainEqual(expect.objectContaining({ type: "role", role: "seer" }));
    expect(newPlayerMessages).toEqual([{ type: "error", message: "Game already started" }]);
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
      },
      {
        playerId: "player_dead",
        nickname: "Dead",
        command: { type: "self_talk", text: "secret" },
        message: "Self talk is only available to living players at night"
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
      },
      {
        command: { type: "gm_set_common_voice", enabled: true },
        message: "Only the GM can adjust channels"
      },
      {
        command: { type: "gm_set_channel_restrictions", restrictions: { wolf: true, common: false, lovers: false, fox: false } },
        message: "Only the GM can adjust channels"
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

  it("rejects GM player controls outside active games through the websocket handler", async () => {
    const baseGame: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
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
        command: { type: "gm_set_alive", targetPlayerId: "player_target", alive: false },
        message: "Can only adjust life state during active games"
      },
      {
        command: { type: "gm_set_role", targetPlayerId: "player_target", role: "seer" },
        message: "Can only adjust roles during active games"
      },
      {
        command: { type: "gm_set_flag", targetPlayerId: "player_target", flag: "lover", enabled: true },
        message: "Can only adjust player flags during active games"
      }
    ];

    for (const game of [baseGame, { ...baseGame, phase: "ended" as const, winner: "villagers" as const }]) {
      for (const testCase of cases) {
        const room = roomObject(game);
        const messages: SentMessage[] = [];
        const socket = fakeSocket(messages);
        connect(room, socket, "player_gm", "GM", true);

        await sendRaw(room, socket, JSON.stringify(testCase.command));

        expect(messages).toEqual([{ type: "error", message: testCase.message }]);
      }
    }
  });

  it("updates private roles after GM role changes through the websocket handler", async () => {
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

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_role", targetPlayerId: "player_target", role: "seer" }));

    for (const messages of [gmMessages, targetMessages, otherMessages]) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
      expect(messages.find((message) => message.type === "game_state")?.players?.some((player) => "role" in player)).toBe(false);
    }
    expect(gmMessages.some((message) => message.type === "role")).toBe(false);
    expect(targetMessages).toContainEqual(expect.objectContaining({ type: "role", role: "seer" }));
    expect(otherMessages).toContainEqual(expect.objectContaining({ type: "role", role: "villager" }));
  });

  it("clears pending night actions involving a player after GM role changes through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_gm", nickname: "GM", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard", alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false },
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
      voteStatus: true,
      revoteCount: 0,
      nightKills: { player_wolf: "player_target" },
      divinations: { player_seer: "player_target" },
      guards: { player_guard: "player_target" },
      catRevives: { player_cat: "player_dead" },
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const gmMessages: SentMessage[] = [];
    const targetMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const targetSocket = fakeSocket(targetMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, targetSocket, "player_target", "Target");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_role", targetPlayerId: "player_target", role: "werewolf" }));

    for (const messages of [gmMessages, targetMessages]) {
      const state = messages.find((message) => message.type === "game_state");
      expect(state).toEqual(expect.objectContaining({ type: "game_state", phase: "night", votedPlayerIds: ["player_cat"] }));
    }
    expect(targetMessages).toContainEqual(expect.objectContaining({ type: "role", role: "werewolf" }));
  });

  it("updates public life state after GM alive changes through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_other", nickname: "Other", role: "villager", alive: true }
      ],
      votes: { player_target: "player_other", player_other: "player_target" },
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

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_alive", targetPlayerId: "player_target", alive: false }));

    for (const messages of [gmMessages, targetMessages, otherMessages]) {
      const state = messages.find((message) => message.type === "game_state");
      expect(state).toEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1, votes: {} }));
      expect(state?.players).toContainEqual({ playerId: "player_target", nickname: "Target", alive: false });
      expect(state?.players?.some((player) => "role" in player)).toBe(false);
    }
  });

  it("clears all pending night actions after GM kills a player through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_gm", nickname: "GM", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard", alive: true },
        { playerId: "player_cat", nickname: "Cat", role: "cat", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_dead", nickname: "Dead", role: "villager", alive: false },
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
      voteStatus: true,
      revoteCount: 0,
      nightKills: { player_wolf: "player_target" },
      divinations: { player_seer: "player_target" },
      guards: { player_guard: "player_target" },
      catRevives: { player_cat: "player_dead" },
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const gmMessages: SentMessage[] = [];
    const targetMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const targetSocket = fakeSocket(targetMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, targetSocket, "player_target", "Target");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_alive", targetPlayerId: "player_target", alive: false }));

    for (const messages of [gmMessages, targetMessages]) {
      const state = messages.find((message) => message.type === "game_state");
      expect(state).toEqual(expect.objectContaining({ type: "game_state", phase: "night", votedPlayerIds: [] }));
    }
  });

  it("updates private partner visibility after GM flag changes through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_other", nickname: "Other", role: "villager", alive: true, lover: true }
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

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_flag", targetPlayerId: "player_target", flag: "lover", enabled: true }));

    for (const messages of [gmMessages, targetMessages, otherMessages]) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "night", day: 1 }));
      expect(messages.find((message) => message.type === "game_state")?.players?.some((player) => "role" in player)).toBe(false);
    }
    expect(gmMessages.some((message) => message.type === "role")).toBe(false);
    expect(targetMessages).toContainEqual(
      expect.objectContaining({
        type: "role",
        role: "villager",
        lovers: [
          { playerId: "player_other", nickname: "Other" }
        ]
      })
    );
    expect(otherMessages).toContainEqual(
      expect.objectContaining({
        type: "role",
        role: "villager",
        lovers: [
          { playerId: "player_target", nickname: "Target" }
        ]
      })
    );
  });

  it("persists GM target nicknames for old-log operation rows", async () => {
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
    const { room, dbRuns } = observableRoomObject(game);
    const gmSocket = fakeSocket([]);
    connect(room, gmSocket, "player_gm", "GM", true);

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_role", targetPlayerId: "player_target", role: "seer" }));
    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_flag", targetPlayerId: "player_target", flag: "lover", enabled: true }));
    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_alive", targetPlayerId: "player_target", alive: false }));

    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_gm", "gm_set_role", JSON.stringify({ targetPlayerId: "player_target", targetNickname: "Target", role: "seer" })]
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_gm", "gm_set_flag", JSON.stringify({ targetPlayerId: "player_target", targetNickname: "Target", flag: "lover", enabled: true })]
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_gm", "gm_set_alive", JSON.stringify({ targetPlayerId: "player_target", targetNickname: "Target", alive: false })]
      })
    );
  });

  it("sends role partner lists without echoing the viewer", () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf_a", nickname: "Wolf A", role: "werewolf", alive: true },
        { playerId: "player_wolf_b", nickname: "Wolf B", role: "big_wolf", alive: true },
        { playerId: "player_common_a", nickname: "Common A", role: "common", alive: true },
        { playerId: "player_common_b", nickname: "Common B", role: "common", alive: true },
        { playerId: "player_lover_a", nickname: "Lover A", role: "villager", alive: true, lover: true },
        { playerId: "player_lover_b", nickname: "Lover B", role: "seer", alive: true, lover: true },
        { playerId: "player_fox_a", nickname: "Fox A", role: "fox", alive: true },
        { playerId: "player_fox_b", nickname: "Fox B", role: "fox", alive: true },
        { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox", alive: true }
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
    const commonMessages: SentMessage[] = [];
    const loverMessages: SentMessage[] = [];
    const foxMessages: SentMessage[] = [];
    const childFoxMessages: SentMessage[] = [];
    connect(room, fakeSocket(wolfMessages), "player_wolf_a", "Wolf A");
    connect(room, fakeSocket(commonMessages), "player_common_a", "Common A");
    connect(room, fakeSocket(loverMessages), "player_lover_a", "Lover A");
    connect(room, fakeSocket(foxMessages), "player_fox_a", "Fox A");
    connect(room, fakeSocket(childFoxMessages), "player_child_fox", "Child Fox");

    (room as unknown as { sendRoles(gameState: GameState): void }).sendRoles(game);

    expect(wolfMessages).toContainEqual(expect.objectContaining({
      type: "role",
      wolves: [{ playerId: "player_wolf_b", nickname: "Wolf B" }]
    }));
    expect(commonMessages).toContainEqual(expect.objectContaining({
      type: "role",
      commons: [{ playerId: "player_common_b", nickname: "Common B" }]
    }));
    expect(loverMessages).toContainEqual(expect.objectContaining({
      type: "role",
      lovers: [{ playerId: "player_lover_b", nickname: "Lover B" }]
    }));
    expect(foxMessages).toContainEqual(expect.objectContaining({
      type: "role",
      foxes: [{ playerId: "player_fox_b", nickname: "Fox B" }]
    }));
    expect(childFoxMessages).toContainEqual(
      expect.objectContaining({
        type: "role",
        foxes: [
          { playerId: "player_fox_a", nickname: "Fox A" },
          { playerId: "player_fox_b", nickname: "Fox B" }
        ]
      })
    );
  });

  it("advances active phases through the GM websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
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
    const wolfMessages: SentMessage[] = [];
    const targetMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const wolfSocket = fakeSocket(wolfMessages);
    const targetSocket = fakeSocket(targetMessages);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, targetSocket, "player_target", "Target");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_advance_phase" }));

    for (const messages of [gmMessages, wolfMessages, targetMessages, otherMessages]) {
      const state = messages.find((message) => message.type === "game_state");
      expect(state).toEqual(expect.objectContaining({ type: "game_state", phase: "night", day: 1 }));
      expect(state?.players?.some((player) => "role" in player)).toBe(false);
    }
    expect(gmMessages.some((message) => message.type === "role")).toBe(false);
    expect(wolfMessages).toContainEqual(expect.objectContaining({ type: "role", role: "werewolf" }));
    expect(targetMessages).toContainEqual(expect.objectContaining({ type: "role", role: "villager" }));
    expect(otherMessages).toContainEqual(expect.objectContaining({ type: "role", role: "villager" }));
  });

  it("rejects GM phase advancement outside active games through the websocket handler", async () => {
    const baseGame: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
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

    for (const game of [baseGame, { ...baseGame, phase: "ended" as const, winner: "villagers" as const }]) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_gm", "GM", true);

      await sendRaw(room, socket, JSON.stringify({ type: "gm_advance_phase" }));

      expect(messages).toEqual([{ type: "error", message: "Only active day or night phases can be advanced" }]);
    }
  });

  it("adjudicates active games through the GM websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: false }
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
    const wolfMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const seerMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const wolfSocket = fakeSocket(wolfMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const seerSocket = fakeSocket(seerMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, seerSocket, "player_seer", "Seer");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_end_game", winner: "villagers" }));

    for (const messages of [gmMessages, wolfMessages, villagerMessages, seerMessages]) {
      const state = messages.find((message) => message.type === "game_state");
      expect(state).toEqual(expect.objectContaining({ type: "game_state", phase: "ended", day: 2, winner: "villagers" }));
      expect(state?.players?.some((player) => "role" in player)).toBe(false);
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: "revealed_roles",
          roles: {
            player_wolf: "werewolf",
            player_villager: "villager",
            player_seer: "seer"
          }
        })
      );
    }
    expect(gmMessages.some((message) => message.type === "role")).toBe(false);
  });

  it("rejects GM adjudication outside active games through the websocket handler", async () => {
    const baseGame: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
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
    const cases: Array<{ game: GameState; message: string }> = [
      { game: baseGame, message: "Cannot adjudicate a lobby game" },
      { game: { ...baseGame, phase: "ended", winner: "villagers" }, message: "Game already ended" }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_gm", "GM", true);

      await sendRaw(room, socket, JSON.stringify({ type: "gm_end_game", winner: "werewolves" }));

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

  it("rejects invalid start game websocket states", async () => {
    const lobbyWithTooFewPlayers: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true }
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
    const activeGame: GameState = {
      ...lobbyWithTooFewPlayers,
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
      ]
    };
    const cases = [
      {
        game: lobbyWithTooFewPlayers,
        playerId: "player_host",
        nickname: "Host",
        gm: false,
        message: "At least 3 players are required"
      },
      {
        game: activeGame,
        playerId: "player_gm",
        nickname: "GM",
        gm: true,
        message: "Game already started"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname, testCase.gm);

      await sendRaw(room, socket, JSON.stringify({ type: "start_game" }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("starts games through the websocket handler and sends private roles", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_third", nickname: "Third", role: "villager", alive: true }
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
    const hostMessages: SentMessage[] = [];
    const guestMessages: SentMessage[] = [];
    const thirdMessages: SentMessage[] = [];
    const hostSocket = fakeSocket(hostMessages);
    const guestSocket = fakeSocket(guestMessages);
    const thirdSocket = fakeSocket(thirdMessages);
    connect(room, hostSocket, "player_host", "Host");
    connect(room, guestSocket, "player_guest", "Guest");
    connect(room, thirdSocket, "player_third", "Third");

    await sendRaw(room, hostSocket, JSON.stringify({ type: "start_game" }));

    for (const messages of [hostMessages, guestMessages, thirdMessages]) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
      expect(messages.find((message) => message.type === "game_state")?.players?.some((player) => "role" in player)).toBe(false);
      expect(messages.filter((message) => message.type === "role")).toHaveLength(1);
    }
    const roles = [hostMessages, guestMessages, thirdMessages].map((messages) => messages.find((message) => message.type === "role")?.role);
    expect(roles).toHaveLength(3);
    expect(roles).toContain("werewolf");
    expect(roles.every((role) => typeof role === "string")).toBe(true);
  });

  it("starts games when all lobby players cast start votes", async () => {
    const lobbyPlayers = [
      { playerId: "player_1", nickname: "Player 1", role: "villager" as const, alive: true },
      { playerId: "player_2", nickname: "Player 2", role: "villager" as const, alive: true },
      { playerId: "player_3", nickname: "Player 3", role: "villager" as const, alive: true },
      { playerId: "player_4", nickname: "Player 4", role: "villager" as const, alive: true },
      { playerId: "player_5", nickname: "Player 5", role: "villager" as const, alive: true },
      { playerId: "player_6", nickname: "Player 6", role: "villager" as const, alive: true },
      { playerId: "player_7", nickname: "Player 7", role: "villager" as const, alive: true },
      { playerId: "player_8", nickname: "Player 8", role: "villager" as const, alive: true }
    ];
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_1",
      players: lobbyPlayers,
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
      lobbyStartVotes: {},
      log: []
    };
    const { room, stored, dbRuns } = observableRoomObject(game);
    const clients = lobbyPlayers.map((player) => {
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, player.playerId, player.nickname);
      return { player, socket, messages };
    });

    for (const client of clients) {
      await sendRaw(room, client.socket, JSON.stringify({ type: "start_vote" }));
    }

    expect(clients[0].messages).toContainEqual(expect.objectContaining({ type: "lobby_start_vote", votedPlayerIds: ["player_1"], required: 8, ready: false }));
    expect(clients[1].messages).toContainEqual(expect.objectContaining({ type: "lobby_start_vote", votedPlayerIds: ["player_1", "player_2"], required: 8, ready: false }));
    for (const { messages } of clients) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "lobby_start_vote", votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5", "player_6", "player_7", "player_8"], required: 8, ready: true }));
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
      expect(messages.filter((message) => message.type === "role")).toHaveLength(1);
    }
    expect(stored.get("gameState")).toEqual(expect.objectContaining({ phase: "day", lobbyStartVotes: {} }));
    expect(dbRuns).toContainEqual(expect.objectContaining({ query: expect.stringContaining("UPDATE rooms SET status = 'playing'"), binds: ["room_abc"] }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_8", "game_started", JSON.stringify({ day: 1, players: 8, startVotes: 8 })]
      })
    );
  });

  it("rejects invalid lobby start vote websocket states", async () => {
    const activeGame: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const lobbyGame: GameState = { ...activeGame, phase: "lobby", day: 0 };
    const cases: Array<{ game: GameState; playerId: string; nickname: string; gm: boolean; message: string }> = [
      { game: activeGame, playerId: "player_host", nickname: "Host", gm: false, message: "Start votes are only available before the game starts" },
      { game: lobbyGame, playerId: "player_gm", nickname: "GM", gm: true, message: "GM cannot cast resident start votes" }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname, testCase.gm);

      await sendRaw(room, socket, JSON.stringify({ type: "start_vote" }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("marks dummy boy games as playing when they start on the first night", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_third", nickname: "Third", role: "villager", alive: true }
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
    const { room, stored, puts, dbRuns } = observableRoomObject(game, { option_role: "dummy_boy" });
    const hostMessages: SentMessage[] = [];
    const hostSocket = fakeSocket(hostMessages);
    connect(room, hostSocket, "player_host", "Host");

    await sendRaw(room, hostSocket, JSON.stringify({ type: "start_game" }));

    expect(stored.get("gameState")).toEqual(expect.objectContaining({ phase: "night", day: 0, dummyBoy: true }));
    expect(hostMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "night", day: 0 }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("UPDATE rooms SET status = 'playing'"),
        binds: ["room_abc"]
      })
    );
    expect(puts).toContainEqual({ key: "roomPlayingSynced", value: true });
  });

  it("starts dummy boy games when seven residents cast start votes", async () => {
    const lobbyPlayers = [
      { playerId: "player_1", nickname: "Player 1", role: "villager" as const, alive: true },
      { playerId: "player_2", nickname: "Player 2", role: "villager" as const, alive: true },
      { playerId: "player_3", nickname: "Player 3", role: "villager" as const, alive: true },
      { playerId: "player_4", nickname: "Player 4", role: "villager" as const, alive: true },
      { playerId: "player_5", nickname: "Player 5", role: "villager" as const, alive: true },
      { playerId: "player_6", nickname: "Player 6", role: "villager" as const, alive: true },
      { playerId: "player_7", nickname: "Player 7", role: "villager" as const, alive: true }
    ];
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_1",
      players: lobbyPlayers,
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
      lobbyStartVotes: {},
      log: []
    };
    const { room, stored, dbRuns } = observableRoomObject(game, { option_role: "dummy_boy" });
    const clients = lobbyPlayers.map((player) => {
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, player.playerId, player.nickname);
      return { socket, messages };
    });

    for (const client of clients) {
      await sendRaw(room, client.socket, JSON.stringify({ type: "start_vote" }));
    }

    for (const { messages } of clients) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "lobby_start_vote", votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5", "player_6", "player_7"], required: 8, ready: true }));
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "night", day: 0 }));
    }
    expect(stored.get("gameState")).toEqual(expect.objectContaining({ phase: "night", day: 0, dummyBoy: true, lobbyStartVotes: {} }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_7", "game_started", JSON.stringify({ day: 0, players: 8, startVotes: 7 })]
      })
    );
  });

  it("lets GM sockets start games without receiving player roles", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_third", nickname: "Third", role: "villager", alive: true }
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
    const hostMessages: SentMessage[] = [];
    const guestMessages: SentMessage[] = [];
    const thirdMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const hostSocket = fakeSocket(hostMessages);
    const guestSocket = fakeSocket(guestMessages);
    const thirdSocket = fakeSocket(thirdMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, hostSocket, "player_host", "Host");
    connect(room, guestSocket, "player_guest", "Guest");
    connect(room, thirdSocket, "player_third", "Third");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "start_game" }));

    expect(gmMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
    expect(gmMessages.some((message) => message.type === "role")).toBe(false);
    for (const messages of [hostMessages, guestMessages, thirdMessages]) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 1 }));
      expect(messages.filter((message) => message.type === "role")).toHaveLength(1);
    }
  });

  it("rejects kick websocket commands with invalid targets", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
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
      { targetPlayerId: "player_host", message: "Cannot kick yourself" },
      { targetPlayerId: "player_missing", message: "Kick target not found" }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, "player_host", "Host");

      await sendRaw(room, socket, JSON.stringify({ type: "kick_player", targetPlayerId: testCase.targetPlayerId }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("rejects kick websocket commands after the game starts", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_other", nickname: "Other", role: "werewolf", alive: true }
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
      { playerId: "player_host", nickname: "Host", gm: false, message: "Only the room host or GM can kick players" },
      { playerId: "player_gm", nickname: "GM", gm: true, message: "Players can only be kicked before the game starts" }
    ];

    for (const testCase of cases) {
      const room = roomObject(game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname, testCase.gm);

      await sendRaw(room, socket, JSON.stringify({ type: "kick_player", targetPlayerId: "player_target" }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("kicks lobby players through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
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
    const { room, stored, dbRuns } = observableRoomObject(game);
    const hostMessages: SentMessage[] = [];
    const targetMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const targetCloses: CloseEvent[] = [];
    const hostSocket = fakeSocket(hostMessages);
    const targetSocket = fakeSocket(targetMessages, targetCloses);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, hostSocket, "player_host", "Host");
    connect(room, targetSocket, "player_target", "Target");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, hostSocket, JSON.stringify({ type: "kick_player", targetPlayerId: "player_target" }));

    expect(targetMessages).toContainEqual({ type: "error", message: "You were kicked from the room" });
    expect(targetCloses).toEqual([{ code: 1000, reason: "You were kicked from the room" }]);
    expect(hostMessages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "kick_player", targetPlayerId: "player_target" }));
    expect(hostMessages).toContainEqual(
      expect.objectContaining({
        type: "presence",
        members: [
          { playerId: "player_host", nickname: "Host" },
          { playerId: "player_other", nickname: "Other" }
        ]
      })
    );
    expect(otherMessages).toContainEqual(
      expect.objectContaining({
        type: "presence",
        members: [
          { playerId: "player_host", nickname: "Host" },
          { playerId: "player_other", nickname: "Other" }
        ]
      })
    );
    expect(stored.get("gameState")).toEqual(
      expect.objectContaining({
        players: expect.not.arrayContaining([expect.objectContaining({ playerId: "player_target" })]),
        lobbyStartVotes: {},
        lobbyKickVotes: {},
        log: expect.arrayContaining(["Target 人間蒸發、被轉學了。", "＜投票重新開始 請盡速重新投票＞"])
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_host", "player_kicked", JSON.stringify({ targetPlayerId: "player_target", targetNickname: "Target", method: "host" })]
      })
    );
  });

  it("kicks lobby players when resident kick votes reach the reference threshold", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_1",
      players: [
        { playerId: "player_1", nickname: "One", role: "villager", alive: true },
        { playerId: "player_2", nickname: "Two", role: "villager", alive: true },
        { playerId: "player_3", nickname: "Three", role: "villager", alive: true },
        { playerId: "player_4", nickname: "Four", role: "villager", alive: true },
        { playerId: "player_5", nickname: "Five", role: "villager", alive: true },
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
      lobbyStartVotes: { player_1: true, player_target: true },
      lobbyKickVotes: {},
      log: []
    };
    const { room, stored, dbRuns } = observableRoomObject(game);
    const voterMessages: SentMessage[][] = [];
    const voterSockets: WebSocket[] = [];
    const targetMessages: SentMessage[] = [];
    const targetCloses: CloseEvent[] = [];
    for (const [playerId, nickname] of [["player_1", "One"], ["player_2", "Two"], ["player_3", "Three"], ["player_4", "Four"], ["player_5", "Five"]] as Array<[string, string]>) {
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      voterMessages.push(messages);
      voterSockets.push(socket);
      connect(room, socket, playerId, nickname);
    }
    const targetSocket = fakeSocket(targetMessages, targetCloses);
    connect(room, targetSocket, "player_target", "Target");

    for (const socket of voterSockets) {
      await sendRaw(room, socket, JSON.stringify({ type: "kick_vote", targetPlayerId: "player_target" }));
    }

    expect(voterMessages[0]).toContainEqual(expect.objectContaining({ type: "lobby_kick_vote", targetPlayerId: "player_target", votedPlayerIds: ["player_1"], required: 5, ready: false }));
    for (const messages of voterMessages) {
      expect(messages).toContainEqual(expect.objectContaining({ type: "lobby_kick_vote", targetPlayerId: "player_target", votedPlayerIds: ["player_1", "player_2", "player_3", "player_4", "player_5"], required: 5, ready: true }));
      expect(messages).toContainEqual(expect.objectContaining({ type: "presence", members: expect.not.arrayContaining([expect.objectContaining({ playerId: "player_target" })]) }));
      expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "lobby" }));
    }
    expect(targetMessages).toContainEqual({ type: "error", message: "You were kicked from the room" });
    expect(targetCloses).toEqual([{ code: 1000, reason: "You were kicked from the room" }]);
    expect(stored.get("gameState")).toEqual(
      expect.objectContaining({
        players: expect.not.arrayContaining([expect.objectContaining({ playerId: "player_target" })]),
        lobbyStartVotes: {},
        lobbyKickVotes: {},
        log: expect.arrayContaining(["Target 人間蒸發、被轉學了。", "＜投票重新開始 請盡速重新投票＞"])
      })
    );
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_5", "player_kicked", JSON.stringify({ targetPlayerId: "player_target", targetNickname: "Target", method: "vote", kickVotes: 5 })]
      })
    );
  });

  it("rejects invalid lobby kick vote websocket states", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
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
    const cases = [
      { game, playerId: "player_host", nickname: "Host", gm: false, targetPlayerId: "player_host", message: "Cannot kick vote yourself" },
      { game, playerId: "player_host", nickname: "Host", gm: false, targetPlayerId: "player_missing", message: "Kick vote target not found" },
      { game, playerId: "player_gm", nickname: "GM", gm: true, targetPlayerId: "player_target", message: "GM cannot cast resident kick votes" },
      { game: { ...game, phase: "day" as const, day: 1 }, playerId: "player_host", nickname: "Host", gm: false, targetPlayerId: "player_target", message: "Kick votes are only available before the game starts" }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game);
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname, testCase.gm);

      await sendRaw(room, socket, JSON.stringify({ type: "kick_vote", targetPlayerId: testCase.targetPlayerId }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
  });

  it("lets lobby players leave through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "lobby",
      day: 0,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
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
      lobbyStartVotes: { player_host: true, player_guest: true },
      lobbyKickVotes: { player_other: ["player_host", "player_guest"] },
      log: ["before"]
    };
    const { room, stored, dbRuns } = observableRoomObject(game);
    const hostMessages: SentMessage[] = [];
    const guestMessages: SentMessage[] = [];
    const otherMessages: SentMessage[] = [];
    const guestCloses: CloseEvent[] = [];
    const hostSocket = fakeSocket(hostMessages);
    const guestSocket = fakeSocket(guestMessages, guestCloses);
    const otherSocket = fakeSocket(otherMessages);
    connect(room, hostSocket, "player_host", "Host");
    connect(room, guestSocket, "player_guest", "Guest");
    connect(room, otherSocket, "player_other", "Other");

    await sendRaw(room, guestSocket, JSON.stringify({ type: "leave_room" }));

    expect(stored.get("gameState")).toEqual(
      expect.objectContaining({
        hostId: "player_host",
        lobbyStartVotes: {},
        lobbyKickVotes: {},
        log: ["before", "Guest 離開這個村莊了", "＜投票重新開始 請盡速重新投票＞"],
        players: [
          { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
          { playerId: "player_other", nickname: "Other", role: "villager", alive: true }
        ]
      })
    );
    expect(guestMessages).toEqual([{ type: "action_ack", action: "leave_room", targetPlayerId: "player_guest" }]);
    expect(guestCloses).toEqual([{ code: 1000, reason: "You left the room" }]);
    expect(hostMessages).toContainEqual(
      expect.objectContaining({
        type: "presence",
        members: [
          { playerId: "player_host", nickname: "Host" },
          { playerId: "player_other", nickname: "Other" }
        ]
      })
    );
    expect(otherMessages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "lobby" }));
    expect(dbRuns).toContainEqual(
      expect.objectContaining({
        query: expect.stringContaining("INSERT INTO room_events"),
        binds: ["room_abc", "player_guest", "player_left", JSON.stringify({ nickname: "Guest", phase: "lobby", day: 0 })]
      })
    );
  });

  it("treats active-game leave as socket logout without removing the player", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      hostId: "player_host",
      players: [
        { playerId: "player_host", nickname: "Host", role: "villager", alive: true },
        { playerId: "player_guest", nickname: "Guest", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const { room, stored } = observableRoomObject(game);
    const hostMessages: SentMessage[] = [];
    const guestMessages: SentMessage[] = [];
    const guestCloses: CloseEvent[] = [];
    const hostSocket = fakeSocket(hostMessages);
    const guestSocket = fakeSocket(guestMessages, guestCloses);
    connect(room, hostSocket, "player_host", "Host");
    connect(room, guestSocket, "player_guest", "Guest");

    await sendRaw(room, guestSocket, JSON.stringify({ type: "leave_room" }));

    expect(stored.get("gameState")).toBe(game);
    expect(guestMessages).toEqual([{ type: "action_ack", action: "leave_room", targetPlayerId: "player_guest" }]);
    expect(guestCloses).toEqual([{ code: 1000, reason: "You left the room" }]);
    expect(hostMessages).toContainEqual(
      expect.objectContaining({
        type: "presence",
        members: [{ playerId: "player_host", nickname: "Host" }]
      })
    );
    expect(hostMessages).not.toContainEqual(expect.objectContaining({ type: "game_state" }));
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

  it("publishes saved last words when a player dies through the websocket flow", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
      players: [
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_voter", nickname: "Voter", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const room = roomObject(game, { option_role: "will" });
    const targetMessages: SentMessage[] = [];
    const voterMessages: SentMessage[] = [];
    const wolfMessages: SentMessage[] = [];
    const targetSocket = fakeSocket(targetMessages);
    const voterSocket = fakeSocket(voterMessages);
    const wolfSocket = fakeSocket(wolfMessages);
    connect(room, targetSocket, "player_target", "Target");
    connect(room, voterSocket, "player_voter", "Voter");
    connect(room, wolfSocket, "player_wolf", "Wolf");

    await sendRaw(room, targetSocket, JSON.stringify({ type: "set_last_words", text: "remember me" }));
    await sendRaw(room, targetSocket, JSON.stringify({ type: "vote", targetPlayerId: "player_voter" }));
    await sendRaw(room, voterSocket, JSON.stringify({ type: "vote", targetPlayerId: "player_target" }));
    await sendRaw(room, wolfSocket, JSON.stringify({ type: "vote", targetPlayerId: "player_target" }));

    expect(targetMessages[0]).toEqual({ type: "last_words_ack" });
    for (const messages of [targetMessages, voterMessages, wolfMessages]) {
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: "game_state",
          log: expect.arrayContaining(["Target 的遺言：remember me"])
        })
      );
    }
  });

  it("rejects last words websocket commands outside eligible player states", async () => {
    const baseGame: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 1,
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
    const cases: Array<{ game: GameState; playerId: string; nickname: string; message: string }> = [
      {
        game: { ...baseGame, phase: "lobby", day: 0 },
        playerId: "player_alive",
        nickname: "Alive",
        message: "Last words are only available during active games"
      },
      {
        game: { ...baseGame, phase: "ended", winner: "villagers" },
        playerId: "player_alive",
        nickname: "Alive",
        message: "Last words are only available during active games"
      },
      {
        game: baseGame,
        playerId: "player_dead",
        nickname: "Dead",
        message: "Living player is required"
      }
    ];

    for (const testCase of cases) {
      const room = roomObject(testCase.game, { option_role: "will" });
      const messages: SentMessage[] = [];
      const socket = fakeSocket(messages);
      connect(room, socket, testCase.playerId, testCase.nickname);

      await sendRaw(room, socket, JSON.stringify({ type: "set_last_words", text: "remember me" }));

      expect(messages).toEqual([{ type: "error", message: testCase.message }]);
    }
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
      },
      {
        game: {
          roomId: "room_abc",
          phase: "day",
          day: 1,
          players: [
            { playerId: "player_voter", nickname: "Voter", role: "villager", alive: true },
            { playerId: "player_target", nickname: "Target", role: "werewolf", alive: true },
            { playerId: "player_other", nickname: "Other", role: "villager", alive: true }
          ],
          votes: { player_voter: "player_other" },
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
        playerId: "player_voter",
        nickname: "Voter",
        message: "Day vote is already used this round"
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
        wolves: []
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

  it("sends revealed roles only to dead players during active games when enabled", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "day",
      day: 2,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
        { playerId: "player_seer", nickname: "Seer", role: "seer", alive: false }
      ],
      votes: {},
      openVote: false,
      commonTalkVisible: false,
      deadRoleVisible: true,
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
    const room = roomObject(game, { dellook: 1 });
    const wolfMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const seerMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    const seerSocket = fakeSocket(seerMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, villagerSocket, "player_villager", "Villager");
    connect(room, seerSocket, "player_seer", "Seer");

    await (room as unknown as { broadcastGameState(gameState: GameState): Promise<void> }).broadcastGameState(game);

    for (const messages of [wolfMessages, villagerMessages]) {
      expect(messages).toEqual([expect.objectContaining({ type: "game_state", phase: "day", day: 2 })]);
    }
    expect(seerMessages).toEqual([
      expect.objectContaining({ type: "game_state", phase: "day", day: 2 }),
      expect.objectContaining({
        type: "revealed_roles",
        roles: {
          player_wolf: "werewolf",
          player_villager: "villager",
          player_seer: "seer"
        }
      })
    ]);
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

  it("lets GM toggle common voice through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_gm", nickname: "GM", role: "villager", alive: true },
        { playerId: "player_common", nickname: "Common", role: "common", alive: true },
        { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true }
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
    const { room, stored, dbRuns } = observableRoomObject(game, { option_role: "will" });
    const gmMessages: SentMessage[] = [];
    const villagerMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const villagerSocket = fakeSocket(villagerMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, villagerSocket, "player_villager", "Villager");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_common_voice", enabled: true }));

    const saved = stored.get("gameState") as GameState;
    expect(saved.commonTalkVisible).toBe(true);
    expect(saved.log).toContain("GM 調整共有頻道公開：開啟。");
    expect(dbRuns).toContainEqual({
      query: "UPDATE rooms SET option_role = ? WHERE id = ?",
      binds: ["will comoutl", "room_abc"]
    });
    expect(gmMessages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "gm_set_common_voice" }));
    expect(villagerMessages).toContainEqual(expect.objectContaining({ type: "game_state", commonTalkVisible: true }));
  });

  it("lets GM persist channel restrictions through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_gm", nickname: "GM", role: "villager", alive: true },
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true }
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
    const { room, stored, dbRuns } = observableRoomObject(game, { option_role: "will chdis:ch_common:::" });
    const gmMessages: SentMessage[] = [];
    const wolfMessages: SentMessage[] = [];
    const gmSocket = fakeSocket(gmMessages);
    const wolfSocket = fakeSocket(wolfMessages);
    connect(room, gmSocket, "player_gm", "GM", true);
    connect(room, wolfSocket, "player_wolf", "Wolf");

    await sendRaw(room, gmSocket, JSON.stringify({ type: "gm_set_channel_restrictions", restrictions: { wolf: true, common: false, lovers: true, fox: false } }));

    const saved = stored.get("gameState") as GameState;
    expect(saved.channelRestrictions).toEqual({ wolf: true, common: false, lovers: true, fox: false });
    expect(saved.log).toContain("GM 調整頻道限制：人狼關閉、共有開啟、戀人關閉、妖狐開啟。");
    expect(dbRuns).toContainEqual({
      query: "UPDATE rooms SET option_role = ? WHERE id = ?",
      binds: ["will chdis:ch_wolf::ch_lovers:", "room_abc"]
    });
    expect(gmMessages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "gm_set_channel_restrictions" }));
    expect(wolfMessages).toContainEqual(expect.objectContaining({ type: "game_state", channelRestrictions: { wolf: true, common: false, lovers: true, fox: false } }));
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

  it("publishes anonymized common voice only to non-common sockets when enabled", async () => {
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
      commonTalkVisible: true,
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
    const room = roomObject(game, { option_role: "comoutl" });
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

    await sendRaw(room, commonASocket, JSON.stringify({ type: "common_chat", text: "secret" }));

    expect(commonAMessages).toEqual([
      expect.objectContaining({ type: "common_chat", playerId: "player_common_a", nickname: "Common A", text: "secret" })
    ]);
    expect(commonBMessages).toEqual([
      expect.objectContaining({ type: "common_chat", playerId: "player_common_a", nickname: "Common A", text: "secret" })
    ]);
    expect(villagerMessages).toEqual([
      expect.objectContaining({ type: "common_chat", playerId: "common_voice", nickname: "共有者的聲音", text: "secret" })
    ]);
    expect(deadCommonMessages).toEqual([
      expect.objectContaining({ type: "common_chat", playerId: "common_voice", nickname: "共有者的聲音", text: "secret" })
    ]);
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
    expect(messages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "divine", targetPlayerId: "player_wolf" }));
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

  it("advances the night after one wolf pack kill target through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_big_wolf", nickname: "Big Wolf", role: "big_wolf", alive: true },
        { playerId: "player_target", nickname: "Target", role: "villager", alive: true },
        { playerId: "player_other_1", nickname: "Other 1", role: "villager", alive: true },
        { playerId: "player_other_2", nickname: "Other 2", role: "villager", alive: true },
        { playerId: "player_other_3", nickname: "Other 3", role: "villager", alive: true }
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
    connect(room, socket, "player_wolf", "Wolf");

    await sendRaw(room, socket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_target" }));

    expect(messages).toContainEqual(expect.objectContaining({ type: "action_ack", action: "night_kill", targetPlayerId: "player_target" }));
    expect(messages).toContainEqual(expect.objectContaining({ type: "game_state", phase: "day", day: 2 }));
  });

  it("rejects duplicate night kills from the same wolf through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 1,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_other_wolf", nickname: "Other Wolf", role: "werewolf", alive: true },
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
      nightKills: { player_wolf: "player_target" },
      divinations: {},
      guards: {},
      catRevives: {},
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_wolf", "Wolf");

    await sendRaw(room, socket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_other" }));

    expect(messages).toEqual([{ type: "error", message: "Night kill is already used tonight" }]);
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

  it("sends each pending medium reading to living medium websocket players", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_medium", nickname: "Medium", role: "medium", alive: true },
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
      mediumReadings: [
        { day: 2, targetPlayerId: "player_big_wolf", targetNickname: "Big Wolf", result: "big_wolf" },
        { day: 2, targetPlayerId: "player_child_fox", targetNickname: "Child Fox", result: "child_fox" }
      ],
      log: []
    };
    const room = roomObject(game);
    const wolfMessages: SentMessage[] = [];
    const mediumMessages: SentMessage[] = [];
    const wolfSocket = fakeSocket(wolfMessages);
    const mediumSocket = fakeSocket(mediumMessages);
    connect(room, wolfSocket, "player_wolf", "Wolf");
    connect(room, mediumSocket, "player_medium", "Medium");

    await sendRaw(room, wolfSocket, JSON.stringify({ type: "night_kill", targetPlayerId: "player_other" }));

    expect(mediumMessages.filter((message) => message.type === "medium_result")).toEqual([
      { type: "medium_result", day: 2, targetPlayerId: "player_big_wolf", targetNickname: "Big Wolf", result: "big_wolf" },
      { type: "medium_result", day: 2, targetPlayerId: "player_child_fox", targetNickname: "Child Fox", result: "child_fox" }
    ]);
    expect(wolfMessages.some((message) => message.type === "medium_result")).toBe(false);
  });

  it("rejects guard self-protection through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 2,
      players: [
        { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true },
        { playerId: "player_guard", nickname: "Guard", role: "guard", alive: true },
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
      nightKills: { player_wolf: "player_target" },
      divinations: {},
      guards: {},
      catRevives: {},
      lastWords: {},
      log: []
    };
    const room = roomObject(game);
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);
    connect(room, socket, "player_guard", "Guard");

    await sendRaw(room, socket, JSON.stringify({ type: "guard", targetPlayerId: "player_guard" }));

    expect(messages).toEqual([{ type: "error", message: "Guards cannot protect themselves" }]);
  });

  it("rejects non-wolf night role actions on the dummy boy first night through the websocket handler", async () => {
    const game: GameState = {
      roomId: "room_abc",
      phase: "night",
      day: 0,
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
      dummyBoy: true,
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
        playerId: "player_seer",
        nickname: "Seer",
        command: { type: "divine", targetPlayerId: "player_target" },
        message: "Divination is not available on the first night"
      },
      {
        playerId: "player_child_fox",
        nickname: "Child Fox",
        command: { type: "child_fox_divine", targetPlayerId: "player_target" },
        message: "Child fox divination is not available on the first night"
      },
      {
        playerId: "player_guard",
        nickname: "Guard",
        command: { type: "guard", targetPlayerId: "player_target" },
        message: "Guarding is not available on the first night"
      },
      {
        playerId: "player_cat",
        nickname: "Cat",
        command: { type: "cat_revive", targetPlayerId: "player_dead" },
        message: "Cats cannot revive on the first night"
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
