import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { registeredTripHash } from "../src/identity";

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
  roomOptionRoles: Record<string, string> = {},
  roomComments: Record<string, string> = {},
  roomCapacities: Record<string, number> = {},
  deadRoleVisibleRooms: Record<string, boolean> = {},
  roomDummyNames: Record<string, string> = {},
  roomDummyLastWords: Record<string, string> = {},
  registeredTripHashes: Set<string> = new Set(),
  excludedTripHashes: Set<string> = new Set(),
  playerRegisteredTripHashes: Record<string, string> = {}
): Env {
  const assets = new Map<string, StoredAsset>();
  const batches: Array<Array<{ query: string; values: unknown[] }>> = [];
  const runs: Array<{ query: string; values: unknown[] }> = [];

  const env = {
    DB: {
      prepare(query: string) {
        return {
          bind(...values: unknown[]) {
            return {
              query,
              values,
              async first() {
                if (query.includes("SELECT 1 AS ok")) {
                  return { ok: 1 };
                }
                if (query.includes("SELECT registered_trip_hash FROM players")) {
                  const registered_trip_hash = playerRegisteredTripHashes[String(values[0])];
                  return registered_trip_hash ? { registered_trip_hash } : null;
                }
                if (query.includes("SUM(ps.games_played)") && query.includes("WHERE p.registered_trip_hash")) {
                  const rows = Object.entries(stats).filter(([playerId]) => playerRegisteredTripHashes[playerId] === String(values[0]));
                  return {
                    games_played: rows.reduce((sum, [, stat]) => sum + stat.games_played, 0),
                    wins: rows.reduce((sum, [, stat]) => sum + stat.wins, 0),
                    losses: rows.reduce((sum, [, stat]) => sum + stat.losses, 0)
                  };
                }
                if (query.includes("FROM player_stats")) {
                  return stats[String(values[0])] ?? null;
                }
                if (query.includes("FROM registered_trips")) {
                  return registeredTripHashes.has(String(values[0])) ? { trip_hash: values[0] } : null;
                }
                if (query.includes("FROM excluded_trips")) {
                  return excludedTripHashes.has(String(values[0])) ? { trip_hash: values[0] } : null;
                }
                if (query.includes("FROM rooms") && query.includes("name")) {
                  const id = String(values[0]);
                  return roomIds.includes(id)
                    ? {
                        id,
                        name: id.replace(/^room_/, ""),
                        room_comment: roomComments[id] ?? "",
                        max_user: roomCapacities[id] ?? 22,
                        dellook: deadRoleVisibleRooms[id] ? 1 : 0,
                        dummy_name: roomDummyNames[id] ?? "替身君",
                        dummy_last_words: roomDummyLastWords[id] ?? "",
                        status: "lobby",
                        created_at: "2026-05-04 04:00:00",
                        option_role: roomOptionRoles[id] ?? ""
                      }
                    : null;
                }
                return roomIds.includes(String(values[0])) ? { id: values[0] } : null;
              },
              async all() {
                if (query.includes("FROM players") && query.includes("registered_trip_hash")) {
                  return {
                    results: Object.entries(playerRegisteredTripHashes)
                      .filter(([, tripHash]) => tripHash === String(values[0]))
                      .map(([id]) => ({ id }))
                      .sort((a, b) => a.id.localeCompare(b.id))
                  };
                }
                if (query.includes("FROM game_records") && query.includes("result_json LIKE")) {
                  const allRecords = Object.values(records).flat();
                  return {
                    results: allRecords
                      .filter((record) =>
                        values.some((pattern) => {
                          const playerId = String(pattern).match(/"playerId":"([^"]+)"/)?.[1];
                          return playerId ? record.result_json.includes(`"playerId":"${playerId}"`) : false;
                        })
                      )
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .slice(0, 20)
                  };
                }
                if (query.includes("FROM game_records")) {
                  return { results: records[String(values[0])] ?? [] };
                }
                if (query.includes("FROM room_events")) {
                  return { results: events[String(values[0])] ?? [] };
                }
                return { results: [] };
              },
              async run() {
                runs.push({ query, values });
                return {};
              }
            };
          },
          async all() {
            if (query.includes("FROM player_stats")) {
              if (query.includes("GROUP BY COALESCE")) {
                const grouped = new Map<string, { player_id: string; games_played: number; wins: number; losses: number }>();
                for (const [player_id, stat] of Object.entries(stats)) {
                  const key = playerRegisteredTripHashes[player_id] ?? player_id;
                  const current = grouped.get(key);
                  if (current) {
                    current.player_id = [current.player_id, player_id].sort()[0];
                    current.games_played += stat.games_played;
                    current.wins += stat.wins;
                    current.losses += stat.losses;
                  } else {
                    grouped.set(key, { player_id, ...stat });
                  }
                }
                return {
                  results: [...grouped.values()].sort((a, b) => b.wins - a.wins || b.games_played - a.games_played || a.player_id.localeCompare(b.player_id))
                };
              }
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
                  room_comment: roomComments[id] ?? "",
                  max_user: roomCapacities[id] ?? 22,
                  dellook: deadRoleVisibleRooms[id] ? 1 : 0,
                  dummy_name: roomDummyNames[id] ?? "替身君",
                  dummy_last_words: roomDummyLastWords[id] ?? "",
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
      },
      async delete(key: string) {
        assets.delete(key);
      }
    } as unknown as R2Bucket,
    CONFIG: {
      async get(key: string) {
        return config[key] ?? null;
      }
    } as unknown as KVNamespace
  } as unknown as Env;
  (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches = batches;
  (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs = runs;
  return env;
}

describe("worker routes", () => {
  it("returns room options in room listings", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms"),
      envWithRooms(
        ["room_plain", "room_poison"],
        {},
        {},
        {},
        {},
        { room_poison: "poison wfbig authority decide lovers betr fosi foxs cat will open_vote comoutl wish_role istrip as_gm dummy_boy cust_dummy real_time:5:2 votedme votedisplay" },
        { room_poison: "<test comment>" },
        { room_poison: 30 },
        { room_poison: true },
        { room_poison: "Custom Dummy" },
        { room_poison: "Remember the dummy" }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rooms: [
        {
          id: "room_plain",
          name: "plain",
          comment: "",
          maxPlayers: 22,
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
            commonTalkVisible: false,
            deadRoleVisible: false,
            wishRole: false,
            tripRequired: false,
            gmEnabled: false,
            dummyBoy: false,
            customDummy: false,
            dummyName: "替身君",
            dummyLastWords: "",
            realTime: false,
            dayMinutes: 3,
            nightMinutes: 1.5,
            selfVote: false,
            voteStatus: false
          }
        },
        {
          id: "room_poison",
          name: "poison",
          comment: "<test comment>",
          maxPlayers: 30,
          status: "lobby",
          createdAt: "2026-05-04 04:00:00",
          options: {
            poison: true,
            bigWolf: true,
            authority: true,
            decider: true,
            lovers: true,
            betrayer: true,
            childFox: false,
            twoFoxes: false,
            cat: true,
            lastWords: true,
            openVote: true,
            commonTalkVisible: true,
            deadRoleVisible: true,
            wishRole: true,
            tripRequired: true,
            gmEnabled: true,
            dummyBoy: true,
            customDummy: true,
            dummyName: "Custom Dummy",
            dummyLastWords: "Remember the dummy",
            realTime: true,
            dayMinutes: 5,
            nightMinutes: 2,
            selfVote: true,
            voteStatus: true
          }
        }
      ]
    });
  });

  it("normalizes fox room variants from stored option_role tokens", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms"),
      envWithRooms(
        ["room_betr", "room_child", "room_two"],
        {},
        {},
        {},
        {},
        {
          room_betr: "betr fosi foxs",
          room_child: "fosi foxs",
          room_two: "foxs"
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { rooms: Array<{ id: string; options: { betrayer: boolean; childFox: boolean; twoFoxes: boolean } }> };
    expect(body.rooms.find((room) => room.id === "room_betr")?.options).toMatchObject({ betrayer: true, childFox: false, twoFoxes: false });
    expect(body.rooms.find((room) => room.id === "room_child")?.options).toMatchObject({ betrayer: false, childFox: true, twoFoxes: false });
    expect(body.rooms.find((room) => room.id === "room_two")?.options).toMatchObject({ betrayer: false, childFox: false, twoFoxes: true });
  });

  it("returns a single room summary", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms/room_detail"),
      envWithRooms(
        ["room_detail"],
        {},
        {},
        {},
        {},
        { room_detail: "poison real_time:4:2 istrip" },
        { room_detail: "Detail comment" },
        { room_detail: 16 },
        { room_detail: true },
        { room_detail: "Dummy" },
        { room_detail: "Last words" }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      room: {
        id: "room_detail",
        name: "detail",
        comment: "Detail comment",
        maxPlayers: 16,
        status: "lobby",
        createdAt: "2026-05-04 04:00:00",
        options: {
          poison: true,
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
          commonTalkVisible: false,
          deadRoleVisible: true,
          wishRole: false,
          tripRequired: true,
          gmEnabled: false,
          dummyBoy: false,
          customDummy: false,
          dummyName: "Dummy",
          dummyLastWords: "Last words",
          realTime: true,
          dayMinutes: 4,
          nightMinutes: 2,
          selfVote: false,
          voteStatus: false
        }
      }
    });
  });

  it("returns 404 for missing room summaries", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/rooms/room_missing"), envWithRooms([]));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Room not found" });
  });

  it("stores selected room options when creating rooms", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Option Test",
          comment: "Beginners welcome",
          maxPlayers: 16,
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
            commonTalkVisible: true,
            deadRoleVisible: true,
            wishRole: true,
            tripRequired: true,
            gmEnabled: true,
            gmTrip: "gm1234",
            dummyBoy: true,
            customDummy: true,
            dummyName: "Custom Dummy",
            dummyLastWords: "Remember the dummy",
            realTime: true,
            dayMinutes: 5,
            nightMinutes: 2,
            selfVote: true,
            voteStatus: true
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
    expect(roomInsert?.query).toContain("room_comment");
    expect(roomInsert?.query).toContain("max_user");
    expect(roomInsert?.query).toContain("dellook");
    expect(roomInsert?.values).toContain("Beginners welcome");
    expect(roomInsert?.values).toContain(16);
    expect(roomInsert?.values).toContain(1);
    expect(roomInsert?.query).toContain("dummy_name");
    expect(roomInsert?.query).toContain("dummy_last_words");
    expect(roomInsert?.query).toContain("gm_trip_hash");
    expect(roomInsert?.values).toContain("Custom Dummy");
    expect(roomInsert?.values).toContain("Remember the dummy");
    expect(String(roomInsert?.values.at(-2))).toMatch(/^[0-9a-f]{64}$/);
    expect(roomInsert?.values.at(-1)).toBe("poison wfbig authority decide lovers betr cat will open_vote comoutl wish_role istrip as_gm dummy_boy cust_dummy real_time:5:2 votedme votedisplay");
    expect(JSON.parse(String(eventInsert?.values.at(-1)))).toEqual({
      name: "Option Test",
      comment: "Beginners welcome",
      maxPlayers: 16,
      options: {
        poison: true,
        bigWolf: true,
        authority: true,
        decider: true,
        lovers: true,
        betrayer: true,
        childFox: false,
        twoFoxes: false,
        cat: true,
        lastWords: true,
        openVote: true,
        commonTalkVisible: true,
        deadRoleVisible: true,
        wishRole: true,
        tripRequired: true,
        gmEnabled: true,
        dummyBoy: true,
        customDummy: true,
        dummyName: "Custom Dummy",
        dummyLastWords: "Remember the dummy",
        realTime: true,
        dayMinutes: 5,
        nightMinutes: 2,
        selfVote: true,
        voteStatus: true
      }
    });
  });

  it("normalizes fox room variants to one server-side option", async () => {
    const cases = [
      { options: { betrayer: true, childFox: true, twoFoxes: true }, expected: "betr" },
      { options: { childFox: true, twoFoxes: true }, expected: "fosi" },
      { options: { twoFoxes: true }, expected: "foxs" }
    ];

    for (const [index, testCase] of cases.entries()) {
      const env = envWithRooms([]);
      const response = await worker.fetch(
        new Request("http://example.test/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: `Fox Variant ${index}`,
            maxPlayers: 22,
            playerId: `player_owner_${index}`,
            nickname: "Owner",
            options: testCase.options
          })
        }),
        env
      );
      const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
      const roomInsert = batches[0].find((statement) => statement.query.includes("INSERT INTO rooms"));

      expect(response.status).toBe(200);
      expect(roomInsert?.values.at(-1)).toBe(testCase.expected);
    }
  });

  it("rejects GM rooms without a GM Trip", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "GM Test",
          playerId: "player_owner",
          nickname: "Owner",
          options: { gmEnabled: true }
        })
      }),
      envWithRooms([])
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "GM Trip is required" });
  });

  it("registers Trip identities", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trip: "ab12CD" })
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });
    expect(runs[0].query).toContain("INSERT INTO registered_trips");
    expect(String(runs[0].values[0])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("excludes Trip identities", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/trips/exclusions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trip: "ab12CD", reason: "blocked" })
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ excluded: true });
    expect(runs[0].query).toContain("INSERT INTO excluded_trips");
    expect(String(runs[0].values[0])).toMatch(/^[0-9a-f]{64}$/);
    expect(runs[0].values[1]).toBe("blocked");
  });

  it("removes Trip exclusions", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/trips/exclusions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trip: "ab12CD" })
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ excluded: false });
    expect(runs[0].query).toContain("DELETE FROM excluded_trips");
    expect(String(runs[0].values[0])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("claims registered Trip identities for player records", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set([tripHash]));
    const response = await worker.fetch(
      new Request("http://example.test/api/trips/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "player_claim", nickname: "Claimant", trip: "ab12CD" })
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: true });
    expect(runs[0].query).toContain("registered_trip_hash");
    expect(runs[0].values).toEqual(["player_claim", "Claimant", tripHash]);
  });

  it("rejects Trip claims for unregistered or excluded Trips", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const unregistered = await worker.fetch(
      new Request("http://example.test/api/trips/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "player_claim", nickname: "Claimant", trip: "ab12CD" })
      }),
      envWithRooms([])
    );
    const excluded = await worker.fetch(
      new Request("http://example.test/api/trips/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "player_claim", nickname: "Claimant", trip: "ab12CD" })
      }),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set([tripHash]), new Set([tripHash]))
    );

    expect(unregistered.status).toBe(400);
    expect(await unregistered.json()).toEqual({ error: "Trip is not registered" });
    expect(excluded.status).toBe(400);
    expect(await excluded.json()).toEqual({ error: "Trip is excluded" });
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

  it("renders player profile pages", async () => {
    const response = await worker.fetch(new Request("http://example.test/player/player_profile"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("player_profile");
  });

  it("renders rules page", async () => {
    const response = await worker.fetch(new Request("http://example.test/rules"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("基本流程");
    expect(body).toContain("村子選項");
  });

  it("renders version page", async () => {
    const response = await worker.fetch(new Request("http://example.test/version"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("版本資訊");
    expect(body).toContain("目前功能");
  });

  it("renders protocol page", async () => {
    const response = await worker.fetch(new Request("http://example.test/protocol"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("WebSocket 入口");
    expect(body).toContain("GET /ws/room/:roomId");
  });

  it("rejects malformed player profile ids", async () => {
    const response = await worker.fetch(new Request("http://example.test/player/not-valid!"), envWithRooms([]));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid player id" });
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

  it("renders maintenance mode on home from KV config", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/"),
      envWithRooms([], {
        maintenance_mode: "true"
      })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("目前維護中，暫停建立新村。");
    expect(body).toContain('<button id="createRoom" disabled>建立房間</button>');
  });

  it("rejects room creation during maintenance mode", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Maintenance Test",
          playerId: "player_owner",
          nickname: "Owner"
        })
      }),
      envWithRooms([], { maintenance_mode: "true" })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Server is under maintenance" });
  });

  it("returns public runtime config from KV", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/config"),
      envWithRooms([], {
        home_announcement: "Runtime notice",
        maintenance_mode: "true"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      config: {
        homeAnnouncement: "Runtime notice",
        maintenanceMode: true
      }
    });
  });

  it("returns default runtime config when KV keys are absent", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/config"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      config: {
        homeAnnouncement: null,
        maintenanceMode: false
      }
    });
  });

  it("returns health check status for runtime bindings", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/health"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      checks: {
        worker: true,
        db: true,
        kv: true,
        durableObjects: true,
        r2: true
      }
    });
  });

  it("returns version metadata for smoke checks", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/version"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: {
        name: "werewolf-cf",
        appVersion: "0.1.0",
        runtime: "Cloudflare Workers",
        language: "TypeScript",
        bindings: ["ROOM_DO", "DB", "ASSETS", "CONFIG"],
        capabilities: ["rooms", "websockets", "websocket_protocol", "game_loop", "trip_identity", "gm_controls", "player_stats", "avatars", "runtime_config"]
      }
    });
  });

  it("returns websocket protocol metadata", async () => {
    const response = await worker.fetch(new Request("http://example.test/api/protocol"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      websocket: {
        path: "/ws/room/:roomId",
        firstClientMessage: "join",
        clientMessages: [
          "join",
          "chat",
          "wolf_chat",
          "fox_chat",
          "common_chat",
          "lovers_chat",
          "dead_chat",
          "gm_chat",
          "gm_whisper",
          "gm_advance_phase",
          "gm_end_game",
          "gm_set_alive",
          "gm_set_role",
          "gm_set_flag",
          "start_game",
          "kick_player",
          "vote",
          "night_kill",
          "divine",
          "child_fox_divine",
          "guard",
          "cat_revive",
          "set_last_words"
        ],
        serverMessages: [
          "joined",
          "presence",
          "chat",
          "wolf_chat",
          "fox_chat",
          "common_chat",
          "lovers_chat",
          "dead_chat",
          "gm_chat",
          "gm_whisper",
          "revealed_roles",
          "divination_result",
          "child_fox_result",
          "medium_result",
          "last_words_ack",
          "action_ack",
          "game_state",
          "role",
          "error"
        ],
        privateChannels: ["wolf_chat", "fox_chat", "common_chat", "lovers_chat", "dead_chat", "gm_chat", "gm_whisper"],
        enforcedBy: "RoomDurableObject"
      }
    });
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

  it("aggregates player stats by claimed registered Trip", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/players/player_current/stats"),
      envWithRooms(
        [],
        {},
        {
          player_current: { games_played: 3, wins: 2, losses: 1 },
          player_old: { games_played: 4, wins: 1, losses: 3 },
          player_other: { games_played: 5, wins: 5, losses: 0 }
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        new Set(),
        new Set(),
        {
          player_current: "trip_hash_a",
          player_old: "trip_hash_a",
          player_other: "trip_hash_b"
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stats: {
        playerId: "player_current",
        gamesPlayed: 7,
        wins: 3,
        losses: 4
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

  it("aggregates leaderboard rows by claimed registered Trip", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/stats/leaderboard"),
      envWithRooms(
        [],
        {},
        {
          player_b: { games_played: 5, wins: 3, losses: 2 },
          player_a: { games_played: 6, wins: 3, losses: 3 },
          player_c: { games_played: 4, wins: 1, losses: 3 }
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        new Set(),
        new Set(),
        {
          player_a: "trip_hash_a",
          player_b: "trip_hash_a"
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      leaderboard: [
        { rank: 1, playerId: "player_a", gamesPlayed: 11, wins: 6, losses: 5 },
        { rank: 2, playerId: "player_c", gamesPlayed: 4, wins: 1, losses: 3 }
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

  it("returns player record history across claimed Trip identities", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/players/player_current/records"),
      envWithRooms(
        ["room_old", "room_new"],
        {},
        {},
        {
          room_old: [
            {
              id: 1,
              room_id: "room_old",
              result_json: '{"winner":"villagers","day":2,"players":[{"playerId":"player_old","nickname":"Old Name","role":"villager","alive":true}]}',
              created_at: "2026-05-04 03:00:00"
            }
          ],
          room_new: [
            {
              id: 2,
              room_id: "room_new",
              result_json: '{"winner":"werewolves","day":4,"players":[{"playerId":"player_current","nickname":"Current","role":"werewolf","alive":true},{"playerId":"player_other","nickname":"Other","role":"villager","alive":false}]}',
              created_at: "2026-05-04 05:00:00"
            }
          ]
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        new Set(),
        new Set(),
        {
          player_current: "trip_hash_a",
          player_old: "trip_hash_a",
          player_other: "trip_hash_b"
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      records: [
        {
          id: 2,
          roomId: "room_new",
          winner: "werewolves",
          day: 4,
          playerId: "player_current",
          nickname: "Current",
          role: "werewolf",
          alive: true,
          createdAt: "2026-05-04 05:00:00"
        },
        {
          id: 1,
          roomId: "room_old",
          winner: "villagers",
          day: 2,
          playerId: "player_old",
          nickname: "Old Name",
          role: "villager",
          alive: true,
          createdAt: "2026-05-04 03:00:00"
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

  it("removes uploaded avatar images from R2", async () => {
    const env = envWithRooms([]);
    const form = new FormData();
    form.set("playerId", "player_avatar");
    form.set("avatar", new File(["avatar-bytes"], "avatar.png", { type: "image/png" }));

    await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "POST",
        body: form
      }),
      env
    );
    const removal = await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "player_avatar" })
      }),
      env
    );
    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_avatar"), env);

    expect(removal.status).toBe(200);
    expect(await removal.json()).toEqual({ removed: true });
    expect(download.status).toBe(404);
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
