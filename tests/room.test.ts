import { describe, expect, it } from "vitest";
import { RoomDurableObject } from "../src/room";
import type { GameState } from "../src/types";

type SentMessage = {
  type: string;
  message: string;
  action?: string;
  targetPlayerId?: string;
  phase?: string;
  day?: number;
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
});
