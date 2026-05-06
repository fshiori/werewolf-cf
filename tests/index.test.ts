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

type MockBbsTopic = {
  id: number;
  name: string;
  title: string;
  message: string;
  trip_hash: string | null;
  reply_count: number;
  pinned: number;
  locked: number;
  digest: number;
  created_at: string;
  updated_at: string;
};

type MockBbsReply = {
  id: number;
  topic_id: number;
  name: string;
  message: string;
  trip_hash: string | null;
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
  playerRegisteredTripHashes: Record<string, string> = {},
  bbsTopics: MockBbsTopic[] = [],
  bbsReplies: MockBbsReply[] = []
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
                if (query.includes("FROM bbs_topics")) {
                  return bbsTopics.find((topic) => topic.id === Number(values[0])) ?? null;
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
                        status: config[`room_status:${id}`] ?? "lobby",
                        created_at: "2026-05-04 04:00:00",
                        option_role: roomOptionRoles[id] ?? ""
                      }
                    : null;
                }
                if (query.includes("SELECT status FROM rooms")) {
                  const id = String(values[0]);
                  return roomIds.includes(id) ? { status: config[`room_status:${id}`] ?? "lobby" } : null;
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
                if (query.includes("FROM bbs_replies")) {
                  return { results: bbsReplies.filter((reply) => reply.topic_id === Number(values[0])) };
                }
                if (query.includes("FROM bbs_topics")) {
                  return { results: query.includes("WHERE digest = 1") ? bbsTopics.filter((topic) => topic.digest === 1) : bbsTopics };
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
            if (query.includes("FROM bbs_replies")) {
              return { results: bbsReplies };
            }
            if (query.includes("FROM bbs_topics")) {
              return { results: query.includes("WHERE digest = 1") ? bbsTopics.filter((topic) => topic.digest === 1) : bbsTopics };
            }
            if (query.includes("FROM game_records")) {
              return { results: Object.values(records).flat().sort((a, b) => b.created_at.localeCompare(a.created_at)) };
            }
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

  it("renders Trip lookup page", async () => {
    const response = await worker.fetch(new Request("http://example.test/trips"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Trip查詢");
    expect(body).toContain("Trip公開資料");
    expect(body).toContain("/api/trips/lookup?trip=");
  });

  it("returns public Trip lookup data without exposing Trip hashes", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const response = await worker.fetch(
      new Request("http://example.test/api/trips/lookup?trip=ab12CD"),
      envWithRooms(
        [],
        {},
        {
          player_a: { games_played: 3, wins: 2, losses: 1 },
          player_b: { games_played: 4, wins: 1, losses: 3 }
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        new Set([tripHash]),
        new Set(),
        {
          player_a: tripHash,
          player_b: tripHash
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      trip: {
        registered: true,
        excluded: false,
        players: ["player_a", "player_b"],
        stats: { gamesPlayed: 7, wins: 3, losses: 4 }
      }
    });
    expect(JSON.stringify(body)).not.toContain(tripHash);
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

  it("serves the external room client script", async () => {
    const response = await worker.fetch(new Request("http://example.test/assets/room-client.js"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    const body = await response.text();
    expect(body).toContain("new WebSocket");
    expect(body).toContain('document.querySelector("[data-room-id]")');
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

  it("renders script info page", async () => {
    const response = await worker.fetch(new Request("http://example.test/script-info"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Script Info");
    expect(body).toContain("時間設定");
    expect(body).toContain("突然死警告");
  });

  it("renders status page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/status"),
      envWithRooms([], { home_announcement: "<Runtime notice>" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("伺服器狀態");
    expect(body).toContain("正常運作");
    expect(body).toContain("Binding 檢查");
    expect(body).toContain("&lt;Runtime notice&gt;");
  });

  it("renders room admin login without a valid token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/rooms"),
      envWithRooms(["room_admin"], { room_admin_token: "secret" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("廢村管理");
    expect(body).toContain("roomAdminToken");
    expect(body).not.toContain("room_admin村");
  });

  it("renders active rooms on the room admin page with a valid token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/rooms?token=secret"),
      envWithRooms(["room_admin"], { room_admin_token: "secret" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("請選擇要廢除的村");
    expect(body).toContain("room_admin");
    expect(body).toContain("adminEndRoom");
    expect(body).toContain("/api/admin/rooms/");
  });

  it("lets room admins mark rooms ended", async () => {
    const env = envWithRooms(["room_admin"], { room_admin_token: "secret" });
    const response = await worker.fetch(
      new Request("http://example.test/api/admin/rooms/room_admin", {
        method: "PATCH",
        headers: { "x-room-admin-token": "secret" }
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ roomId: "room_admin", status: "ended" });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs).toContainEqual(
      expect.objectContaining({
        query: "UPDATE rooms SET status = 'ended' WHERE id = ?",
        values: ["room_admin"]
      })
    );
    expect(runs).toContainEqual(
      expect.objectContaining({
        query: "INSERT INTO room_events (room_id, event_type, payload_json) VALUES (?, 'admin_room_ended', ?)",
        values: ["room_admin", JSON.stringify({ status: "ended" })]
      })
    );
  });

  it("rejects room admin actions without the configured token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/admin/rooms/room_admin", {
        method: "PATCH",
        headers: { "x-room-admin-token": "wrong" }
      }),
      envWithRooms(["room_admin"], { room_admin_token: "secret" })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Room admin token is invalid" });
  });

  it("renders leaderboard page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/leaderboard"),
      envWithRooms([], {}, {
        player_top: { games_played: 8, wins: 5, losses: 3 }
      })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("戰績排行榜");
    expect(body).toContain("/player/player_top");
    expect(body).toContain("player_top");
  });

  it("renders win-rate analysis page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/stats"),
      envWithRooms([], {}, {}, {
        room_a: [
          { id: 1, room_id: "room_a", result_json: "{\"winner\":\"villagers\"}", created_at: "2026-05-06 12:00:00" },
          { id: 2, room_id: "room_a", result_json: "{\"winner\":\"werewolves\"}", created_at: "2026-05-06 12:01:00" },
          { id: 3, room_id: "room_a", result_json: "{\"winner\":\"villagers\"}", created_at: "2026-05-06 12:02:00" }
        ]
      })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("勝率分析");
    expect(body).toContain("－人勝－");
    expect(body).toContain("2 / 3");
    expect(body).toContain("勝率 66.67 %");
  });

  it("renders federated list page from local rooms", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/list"),
      envWithRooms(["room_list"], {}, {}, {}, {}, { room_list: "real_time:3:1" }, { room_list: "Friendly" }, { room_list: 22 })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("聯合遊戲列表");
    expect(body).toContain("服務中");
    expect(body).toContain("本伺服器");
    expect(body).toContain("[room_list]");
    expect(body).toContain("list村");
    expect(body).toContain("Friendly");
    expect(body).toContain("人數22");
  });

  it("renders federated list page with configured remote rooms", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        rooms: [
          {
            id: "remote_room",
            name: "Remote",
            comment: "Away",
            maxPlayers: 16,
            status: "playing",
            createdAt: "2026-05-06 12:00:00"
          }
        ]
      }), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const response = await worker.fetch(
        new Request("http://example.test/list"),
        envWithRooms(
          ["room_list"],
          { federated_servers: JSON.stringify([{ name: "遠端伺服器", url: "https://remote.example/base" }]) },
          {},
          {},
          {},
          { room_list: "real_time:3:1" }
        )
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(requestedUrls).toEqual(["https://remote.example/api/rooms"]);
      expect(body).toContain("[room_list]");
      expect(body).toContain("[remote_room]");
      expect(body).toContain("Remote村");
      expect(body).toContain("遠端伺服器");
      expect(body).toContain("https://remote.example/room/remote_room");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders BBS topic list page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Hello",
          trip_hash: "trip_hash",
          reply_count: 2,
          pinned: 1,
          locked: 0,
          digest: 1,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:30:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("主題列表");
    expect(body).toContain("/bbs?digest=1");
    expect(body).toContain("[置頂] Welcome (精華)");
    expect(body).toContain("Alice◆Trip");
  });

  it("renders BBS digest topic list page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs?go=dige"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Digest",
          message: "Digest body",
          trip_hash: null,
          reply_count: 0,
          pinned: 0,
          locked: 0,
          digest: 1,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:30:00"
        },
        {
          id: 2,
          name: "Bob",
          title: "Normal",
          message: "Normal body",
          trip_hash: null,
          reply_count: 0,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:05:00",
          updated_at: "2026-05-06 12:35:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("精華主題列表");
    expect(body).toContain("Digest (精華)");
    expect(body).not.toContain("Normal");
  });

  it("returns BBS topics", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Hello",
          trip_hash: null,
          reply_count: 0,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:00:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      topics: [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Hello",
          trip: false,
          replyCount: 0,
          pinned: false,
          locked: false,
          digest: false,
          createdAt: "2026-05-06 12:00:00",
          updatedAt: "2026-05-06 12:00:00"
        }
      ]
    });
  });

  it("returns BBS digest topics", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics?digest=1"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Digest",
          message: "Digest body",
          trip_hash: null,
          reply_count: 0,
          pinned: 0,
          locked: 0,
          digest: 1,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:30:00"
        },
        {
          id: 2,
          name: "Bob",
          title: "Normal",
          message: "Normal body",
          trip_hash: null,
          reply_count: 0,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:05:00",
          updated_at: "2026-05-06 12:35:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { topics: Array<{ title: string }> };
    expect(body.topics.map((topic) => topic.title)).toEqual(["Digest"]);
  });

  it("renders BBS topic detail page with replies", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs?view=1"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Topic body",
          trip_hash: "trip_hash",
          reply_count: 1,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:10:00"
        }
      ], [
        {
          id: 1,
          topic_id: 1,
          name: "Bob",
          message: "Reply body",
          trip_hash: null,
          created_at: "2026-05-06 12:10:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Topic body");
    expect(body).toContain("回覆列表");
    expect(body).toContain("Bob");
    expect(body).toContain("Reply body");
    expect(body).toContain("/api/bbs/topics/1/replies");
    expect(body).toContain("主題管理");
    expect(body).toContain("/api/bbs/topics/1/moderation");
  });

  it("returns BBS topic details", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Topic body",
          trip_hash: null,
          reply_count: 1,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:10:00"
        }
      ], [
        {
          id: 1,
          topic_id: 1,
          name: "Bob",
          message: "Reply body",
          trip_hash: "trip_hash",
          created_at: "2026-05-06 12:10:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      topic: {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip: false,
        replyCount: 1,
        pinned: false,
        locked: false,
        digest: false,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:10:00"
      },
      replies: [
        {
          id: 1,
          topicId: 1,
          name: "Bob",
          message: "Reply body",
          trip: true,
          createdAt: "2026-05-06 12:10:00"
        }
      ]
    });
  });

  it("creates BBS topics", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice", title: "Welcome", message: "Hello", trip: "ab12CD" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posted: true });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("INSERT INTO bbs_topics");
    expect(runs[0].values.slice(0, 3)).toEqual(["Alice", "Welcome", "Hello"]);
    expect(typeof runs[0].values[3]).toBe("string");
  });

  it("creates BBS replies", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bob", message: "Reply body", trip: "ab12CD" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posted: true });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("INSERT INTO bbs_replies");
    expect(batches[0][0].values.slice(0, 3)).toEqual([1, "Bob", "Reply body"]);
    expect(batches[0][1].query).toContain("UPDATE bbs_topics SET reply_count = reply_count + 1");
  });

  it("rejects replies to locked BBS topics", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 0,
        pinned: 0,
        locked: 1,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bob", message: "Reply body" })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS topic is locked" });
  });

  it("moderates BBS topic flags with the configured admin token", async () => {
    const env = envWithRooms([], { bbs_admin_token: "secret" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-bbs-admin-token": "secret" },
        body: JSON.stringify({ pinned: true, locked: true, digest: true })
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      topic: expect.objectContaining({ id: 1, pinned: true, locked: true, digest: true })
    });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_topics SET pinned = ?, locked = ?, digest = ?");
    expect(runs[0].values).toEqual([1, 1, 1, 1]);
  });

  it("rejects BBS moderation without the configured admin token", async () => {
    const env = envWithRooms([], { bbs_admin_token: "secret" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-bbs-admin-token": "wrong" },
        body: JSON.stringify({ pinned: true })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS moderation token is invalid" });
  });

  it("renders default icon catalog page", async () => {
    const response = await worker.fetch(new Request("http://example.test/icons"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("頭像一覽");
    expect(body).toContain("/assets/reference/user_icon/001.gif");
    expect(body).toContain("32 x 32");
  });

  it("renders room records page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/room/room_records/records"),
      envWithRooms(
        ["room_records"],
        {},
        {},
        {
          room_records: [
            {
              id: 1,
              room_id: "room_records",
              result_json: "{\"winner\":\"villagers\",\"day\":3,\"players\":[{\"playerId\":\"player_a\"}]}",
              created_at: "2026-05-06 12:00:00"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("村子對局紀錄");
    expect(body).toContain("村民勝利");
    expect(body).toContain("第 3 日");
  });

  it("renders room events page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/room/room_events/events"),
      envWithRooms(
        ["room_events"],
        {},
        {},
        {},
        {
          room_events: [
            {
              id: 1,
              room_id: "room_events",
              player_id: "player_host",
              event_type: "game_started",
              payload_json: "{\"day\":1,\"players\":4}",
              created_at: "2026-05-06 12:00:00"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("村子事件履歷");
    expect(body).toContain("game_started");
    expect(body).toContain("player_host");
  });

  it("renders room transcript page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/room/room_log/log"),
      envWithRooms(
        ["room_log"],
        {},
        {},
        {
          room_log: [
            {
              id: 1,
              room_id: "room_log",
              result_json: "{\"winner\":\"villagers\",\"day\":3,\"players\":[{\"playerId\":\"player_a\",\"nickname\":\"Alice\",\"role\":\"seer\",\"alive\":true},{\"playerId\":\"player_b\",\"nickname\":\"Bob\",\"role\":\"werewolf\",\"alive\":false}]}",
              created_at: "2026-05-06 12:00:00"
            }
          ]
        },
        {
          room_log: [
            {
              id: 1,
              room_id: "room_log",
              player_id: "player_host",
              event_type: "game_started",
              payload_json: "{\"day\":1,\"players\":4}",
              created_at: "2026-05-06 12:00:01"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("村子完整紀錄");
    expect(body).toContain("村民勝利");
    expect(body).toContain("Alice (player_a)");
    expect(body).toContain("占卜師");
    expect(body).toContain("遊戲開始");
    expect(body).toContain("player_host");
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
          "self_talk",
          "gm_chat",
          "gm_whisper",
          "gm_advance_phase",
          "gm_end_game",
          "gm_set_alive",
          "gm_set_role",
          "gm_set_flag",
          "start_game",
          "start_vote",
          "kick_player",
          "kick_vote",
          "leave_room",
          "vote",
          "night_kill",
          "divine",
          "child_fox_divine",
          "guard",
          "cat_revive",
          "set_last_words",
          "objection"
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
          "self_talk",
          "gm_chat",
          "gm_whisper",
          "lobby_start_vote",
          "lobby_kick_vote",
          "revealed_roles",
          "divination_result",
          "child_fox_result",
          "medium_result",
          "last_words_ack",
          "objection",
          "action_ack",
          "game_state",
          "role",
          "error"
        ],
        privateChannels: ["wolf_chat", "fox_chat", "common_chat", "lovers_chat", "dead_chat", "self_talk", "gm_chat", "gm_whisper"],
        channelVariants: {
          common_chat: {
            publicVoicePlayerId: "common_voice",
            publicVoiceNickname: "共有者的聲音",
            description: "When commonTalkVisible is enabled, living non-common players and dead common partners receive an anonymous common_chat voice."
          }
        },
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

  it("returns win-rate analysis from game records", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/stats/win-rate"),
      envWithRooms([], {}, {}, {
        room_a: [
          { id: 1, room_id: "room_a", result_json: "{\"winner\":\"villagers\"}", created_at: "2026-05-06 12:00:00" },
          { id: 2, room_id: "room_a", result_json: "{\"winner\":\"werewolves\"}", created_at: "2026-05-06 12:01:00" },
          { id: 3, room_id: "room_a", result_json: "{\"winner\":\"villagers\"}", created_at: "2026-05-06 12:02:00" },
          { id: 4, room_id: "room_a", result_json: "{\"winner\":\"foxes\"}", created_at: "2026-05-06 12:03:00" }
        ]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      winRates: [
        { winner: "villagers", label: "人勝", wins: 2, total: 4, rate: 50 },
        { winner: "werewolves", label: "狼勝", wins: 1, total: 4, rate: 25 },
        { winner: "foxes", label: "狐勝", wins: 1, total: 4, rate: 25 },
        { winner: "lovers", label: "戀勝", wins: 0, total: 4, rate: 0 }
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

  it("hides private room events before the room has ended", async () => {
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
              id: 8,
              room_id: "room_events",
              player_id: "player_wolf",
              event_type: "wolf_chat",
              payload_json: '{"visibility":"private","nickname":"Wolf","text":"secret"}',
              created_at: "2026-05-04 04:31:00"
            },
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
    await expect(response.json()).resolves.toEqual({
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

  it("shows private room events after the room has ended", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/rooms/room_events/events"),
      envWithRooms(
        ["room_events"],
        { "room_status:room_events": "ended" },
        {},
        {},
        {
          room_events: [
            {
              id: 8,
              room_id: "room_events",
              player_id: "player_wolf",
              event_type: "wolf_chat",
              payload_json: '{"visibility":"private","nickname":"Wolf","text":"secret"}',
              created_at: "2026-05-04 04:31:00"
            }
          ]
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          id: 8,
          roomId: "room_events",
          playerId: "player_wolf",
          eventType: "wolf_chat",
          payload: { visibility: "private", nickname: "Wolf", text: "secret" },
          createdAt: "2026-05-04 04:31:00"
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

  it("serves copied reference assets from R2", async () => {
    const env = envWithRooms([]);
    await env.ASSETS.put("reference/img/top_title.jpg", new Blob(["title-bytes"]).stream(), {
      httpMetadata: { contentType: "image/jpeg" }
    });

    const response = await worker.fetch(new Request("http://example.test/assets/reference/img/top_title.jpg"), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await response.text()).toBe("title-bytes");
  });

  it("rejects unsafe reference asset paths and reports missing reference assets", async () => {
    const env = envWithRooms([]);
    const traversal = await worker.fetch(new Request("http://example.test/assets/reference/img/../setting.php"), env);
    const unsupported = await worker.fetch(new Request("http://example.test/assets/reference/img/Thumbs.db"), env);
    const missing = await worker.fetch(new Request("http://example.test/assets/reference/img/top_title.jpg"), env);

    expect(traversal.status).toBe(400);
    expect(await traversal.json()).toEqual({ error: "Invalid reference asset path" });
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toEqual({ error: "Invalid reference asset path" });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Reference asset not found");
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

  it("rejects unsupported avatars and reports missing avatars", async () => {
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
    expect(await upload.json()).toEqual({ error: "Avatar must be a PNG, JPEG, GIF, or WebP image" });

    const svgForm = new FormData();
    svgForm.set("playerId", "player_avatar");
    svgForm.set("avatar", new File(["<svg></svg>"], "avatar.svg", { type: "image/svg+xml" }));
    const svgUpload = await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "POST",
        body: svgForm
      }),
      env
    );

    expect(svgUpload.status).toBe(400);
    expect(await svgUpload.json()).toEqual({ error: "Avatar must be a PNG, JPEG, GIF, or WebP image" });

    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_missing"), env);

    expect(download.status).toBe(404);
    expect(await download.text()).toBe("Avatar not found");
  });

  it("rejects oversized avatars", async () => {
    const env = envWithRooms([]);
    const form = new FormData();
    form.set("playerId", "player_avatar");
    form.set("avatar", new File([new Uint8Array(512 * 1024 + 1)], "avatar.png", { type: "image/png" }));

    const upload = await worker.fetch(
      new Request("http://example.test/api/assets/avatar", {
        method: "POST",
        body: form
      }),
      env
    );

    expect(upload.status).toBe(400);
    expect(await upload.json()).toEqual({ error: "Avatar is too large" });
  });
});
