import { describe, expect, it } from "vitest";
import worker from "../src/index";

type StoredAsset = {
  body: ReadableStream;
  contentType: string;
};

type MockPlayerStats = {
  games_played: number;
  wins: number;
  losses: number;
};

type MockGameRecord = {
  id: number;
  room_id: string;
  result_json: string;
  created_at: string;
};

type MockRoomEvent = {
  id: number;
  room_id: string;
  player_id: string | null;
  event_type: string;
  payload_json: string;
  created_at: string;
};

function envWithRooms(
  roomIds: string[],
  config: Record<string, string> = {},
  stats: Record<string, MockPlayerStats> = {},
  records: Record<string, MockGameRecord[]> = {},
  events: Record<string, MockRoomEvent[]> = {},
  roomOptionRoles: Record<string, string> = {}
): Env {
  const assets = new Map<string, StoredAsset>();
  const batches: Array<Array<{ query: string; values: unknown[] }>> = [];

  const env = {
    DB: {
      prepare(query: string) {
        return {
          bind(...values: string[]) {
            return {
              query,
              values,
              async first() {
                if (query.includes("FROM player_stats")) {
                  return stats[values[0]] ?? null;
                }
                return roomIds.includes(values[0]) ? { id: values[0] } : null;
              },
              async all() {
                if (query.includes("FROM game_records")) {
                  return { results: records[values[0]] ?? [] };
                }
                if (query.includes("FROM room_events")) {
                  return { results: events[values[0]] ?? [] };
                }
                return { results: [] };
              },
              async run() {
                return {};
              }
            };
          },
          async all() {
            if (query.includes("FROM player_stats")) {
              return {
                results: Object.entries(stats)
                  .map(([player_id, stat]) => ({ player_id, ...stat }))
                  .sort((a, b) => b.wins - a.wins || b.games_played - a.games_played || a.player_id.localeCompare(b.player_id))
              };
            }
            if (query.includes("FROM rooms")) {
              return {
                results: roomIds.map((id) => ({
                  id,
                  name: id.replace(/^room_/, ""),
                  status: "lobby",
                  created_at: "2026-05-04 04:00:00",
                  option_role: roomOptionRoles[id] ?? ""
                }))
              };
            }
            return { results: [] };
          }
        };
      },
      async batch(statements: Array<{ query: string; values: unknown[] }>) {
        batches.push(statements);
        return [];
      }
    },
    ROOM_DO: {
      idFromName(name: string) {
        return { name } as DurableObjectId;
      },
      get() {
        return {
          async fetch() {
            return new Response("upgraded", { status: 101 });
          }
        } as unknown as DurableObjectStub;
      }
    },
    ASSETS: {
      async put(key: string, body: ReadableStream, options?: R2PutOptions) {
        const metadata = options?.httpMetadata;
        const contentType = metadata instanceof Headers ? metadata.get("content-type") : metadata?.contentType;
        assets.set(key, {
          body,
          contentType: contentType ?? "application/octet-stream"
        });
        return null;
      },
      async get(key: string) {
        const asset = assets.get(key);
        if (!asset) {
          return null;
        }
        return {
          body: asset.body,
          httpEtag: "\"test-etag\"",
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", asset.contentType);
          }
        };
      }
    } as unknown as R2Bucket,
    CONFIG: {
      async get(key: string) {
        return config[key] ?? null;
      }
    } as unknown as KVNamespace
  } as unknown as Env;
  (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches = batches;
  return env;
}

describe("worker routes", () => {
  it("returns room options in room listings", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms"),
      envWithRooms(["room_plain", "room_poison"], {}, {}, {}, {}, { room_poison: "poison wfbig authority decide lovers betr fosi foxs cat will open_vote real_time:5:2" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rooms: [
        {
          id: "room_plain",
          name: "plain",
          status: "lobby",
          createdAt: "2026-05-04 04:00:00",
          options: {
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
            realTime: false,
            dayMinutes: 3,
            nightMinutes: 1.5
          }
        },
        {
          id: "room_poison",
          name: "poison",
          status: "lobby",
          createdAt: "2026-05-04 04:00:00",
          options: {
            poison: true,
            bigWolf: true,
            authority: true,
            decider: true,
            lovers: true,
            betrayer: true,
            childFox: true,
            twoFoxes: true,
            cat: true,
            lastWords: true,
            openVote: true,
            realTime: true,
            dayMinutes: 5,
            nightMinutes: 2
          }
        }
      ]
    });
  });

  it("stores selected room options when creating rooms", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Option Test",
          playerId: "player_owner",
          nickname: "Owner",
          options: {
            poison: true,
            bigWolf: true,
            authority: true,
            decider: true,
            lovers: true,
            betrayer: true,
            childFox: true,
            twoFoxes: true,
            cat: true,
            lastWords: true,
            openVote: true,
            realTime: true,
            dayMinutes: 5,
            nightMinutes: 2
          }
        })
      }),
      env
    );
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    const roomInsert = batches[0].find((statement) => statement.query.includes("INSERT INTO rooms"));
    const eventInsert = batches[0].find((statement) => statement.query.includes("room_created"));

    expect(response.status).toBe(200);
    expect(roomInsert?.query).toContain("option_role");
    expect(roomInsert?.values.at(-1)).toBe("poison wfbig authority decide lovers betr fosi foxs cat will open_vote real_time:5:2");
    expect(JSON.parse(String(eventInsert?.values.at(-1)))).toEqual({
      name: "Option Test",
      options: {
        poison: true,
        bigWolf: true,
        authority: true,
        decider: true,
        lovers: true,
        betrayer: true,
        childFox: true,
        twoFoxes: true,
        cat: true,
        lastWords: true,
        openVote: true,
        realTime: true,
        dayMinutes: 5,
        nightMinutes: 2
      }
    });
  });

  it("returns 404 for formatted room ids missing from D1", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_missing"), envWithRooms([]));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Room not found");
  });

  it("renders room pages that exist in D1", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_exists"), envWithRooms(["room_exists"]));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("[room_exists]");
  });

  it("renders home announcements from KV config", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/"),
      envWithRooms([], { home_announcement: "<b>Runtime notice</b>" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("&lt;b&gt;Runtime notice&lt;/b&gt;");
    expect(body).not.toContain("<b>Runtime notice</b>");
  });

  it("returns player stats from D1", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/players/player_stats/stats"),
      envWithRooms([], {}, { player_stats: { games_played: 3, wins: 2, losses: 1 } })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stats: {
        playerId: "player_stats",
        gamesPlayed: 3,
        wins: 2,
        losses: 1
      }
    });
  });

  it("returns zeroed stats for players without records", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/players/player_new/stats"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stats: {
        playerId: "player_new",
        gamesPlayed: 0,
        wins: 0,
        losses: 0
      }
    });
  });

  it("returns leaderboard rows ordered by wins and games played", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/stats/leaderboard"),
      envWithRooms(
        [],
        {},
        {
          player_b: { games_played: 5, wins: 3, losses: 2 },
          player_a: { games_played: 6, wins: 3, losses: 3 },
          player_c: { games_played: 4, wins: 1, losses: 3 }
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      leaderboard: [
        { rank: 1, playerId: "player_a", gamesPlayed: 6, wins: 3, losses: 3 },
        { rank: 2, playerId: "player_b", gamesPlayed: 5, wins: 3, losses: 2 },
        { rank: 3, playerId: "player_c", gamesPlayed: 4, wins: 1, losses: 3 }
      ]
    });
  });

  it("returns game records for existing rooms", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms/room_records/records"),
      envWithRooms(
        ["room_records"],
        {},
        {},
        {
          room_records: [
            {
              id: 1,
              room_id: "room_records",
              result_json: '{"winner":"villagers","day":3}',
              created_at: "2026-05-04 04:00:00"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      records: [
        {
          id: 1,
          roomId: "room_records",
          result: { winner: "villagers", day: 3 },
          createdAt: "2026-05-04 04:00:00"
        }
      ]
    });
  });

  it("returns 404 for game records from missing rooms", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/rooms/room_missing/records"), envWithRooms([]));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Room not found" });
  });

  it("returns room events for existing rooms", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms/room_events/events"),
      envWithRooms(
        ["room_events"],
        {},
        {},
        {},
        {
          room_events: [
            {
              id: 7,
              room_id: "room_events",
              player_id: "player_owner",
              event_type: "room_created",
              payload_json: '{"name":"Test"}',
              created_at: "2026-05-04 04:30:00"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          id: 7,
          roomId: "room_events",
          playerId: "player_owner",
          eventType: "room_created",
          payload: { name: "Test" },
          createdAt: "2026-05-04 04:30:00"
        }
      ]
    });
  });

  it("returns 404 for room events from missing rooms", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/rooms/room_missing/events"), envWithRooms([]));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Room not found" });
  });

  it("stores uploaded avatar images in R2 and serves them back", async () => {
    const env = envWithRooms([]);
    const form = new FormData();
    form.set("playerId", "player_avatar");
    form.set("avatar", new File(["avatar-bytes"], "avatar.png", { type: "image/png" }));

    const upload = await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "POST",
        body: form
      }),
      env
    );

    expect(upload.status).toBe(200);
    expect(await upload.json()).toEqual({ key: "avatars/player_avatar" });

    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_avatar"), env);

    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("image/png");
    expect(await download.text()).toBe("avatar-bytes");
  });

  it("rejects non-image avatars and reports missing avatars", async () => {
    const env = envWithRooms([]);
    const form = new FormData();
    form.set("playerId", "player_avatar");
    form.set("avatar", new File(["text"], "avatar.txt", { type: "text/plain" }));

    const upload = await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "POST",
        body: form
      }),
      env
    );

    expect(upload.status).toBe(400);
    expect(await upload.json()).toEqual({ error: "Avatar must be an image" });

    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_missing"), env);

    expect(download.status).toBe(404);
    expect(await download.text()).toBe("Avatar not found");
  });
});
