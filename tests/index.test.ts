import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { bbsPasswordHash, registeredTripHash } from "../src/identity";

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
  password_hash?: string | null;
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
  password_hash?: string | null;
  created_at: string;
};

type MockTripScore = {
  id: number;
  reviewer_trip: string;
  room_id: string;
  target_trip: string;
  message: string;
  score: number;
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
  bbsReplies: MockBbsReply[] = [],
  tripScores: MockTripScore[] = []
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
                if (query.includes("COUNT(*) AS count") && query.includes("FROM trip_scores")) {
                  return { count: tripScores.filter((score) => score.target_trip === String(values[0])).length };
                }
                if (query.includes("COUNT(*) AS count") && query.includes("FROM bbs_topics")) {
                  return { count: query.includes("WHERE digest = 1") ? bbsTopics.filter((topic) => topic.digest === 1).length : bbsTopics.length };
                }
                if (query.includes("COUNT(*) AS count") && query.includes("FROM bbs_replies")) {
                  return { count: bbsReplies.filter((reply) => reply.topic_id === Number(values[0])).length };
                }
                if (query.includes("SELECT password_hash FROM bbs_topics")) {
                  const topic = bbsTopics.find((value) => value.id === Number(values[0]));
                  return topic ? { password_hash: topic.password_hash ?? null } : null;
                }
                if (query.includes("SELECT password_hash FROM bbs_replies")) {
                  const reply = bbsReplies.find((value) => value.id === Number(values[0]) && value.topic_id === Number(values[1]));
                  return reply ? { password_hash: reply.password_hash ?? null } : null;
                }
                if (query.includes("FROM bbs_replies") && query.includes("WHERE id = ? LIMIT 1")) {
                  return bbsReplies.find((reply) => reply.id === Number(values[0])) ?? null;
                }
                if (query.includes("FROM bbs_replies")) {
                  return bbsReplies.find((reply) => reply.id === Number(values[0]) && reply.topic_id === Number(values[1])) ?? null;
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
                  const hasCapacityFilter = query.includes("JOIN rooms") && query.includes("rooms.max_user = ?");
                  const patterns = hasCapacityFilter ? values.slice(0, -1) : values;
                  const filteredCapacity = hasCapacityFilter ? Number(values[values.length - 1]) : undefined;
                  return {
                    results: allRecords
                      .filter((record) =>
                        patterns.some((pattern) => {
                          const playerId = String(pattern).match(/"playerId":"([^"]+)"/)?.[1];
                          return playerId ? record.result_json.includes(`"playerId":"${playerId}"`) : false;
                        }) && (filteredCapacity === undefined || (roomCapacities[record.room_id] ?? 22) === filteredCapacity)
                      )
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .slice(0, 20)
                  };
                }
                if (query.includes("FROM game_records") && query.includes("room_id IN")) {
                  const roomIds = new Set(values.map(String));
                  return {
                    results: Object.values(records)
                      .flat()
                      .filter((record) => roomIds.has(record.room_id))
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  };
                }
                if (query.includes("FROM game_records")) {
                  return { results: records[String(values[0])] ?? [] };
                }
                if (query.includes("FROM room_events")) {
                  const rows = events[String(values[0])] ?? [];
                  return { results: query.includes("LIMIT 50") ? rows.slice(0, 50) : rows };
                }
                if (query.includes("FROM trip_scores") && query.includes("GROUP BY score")) {
                  const rows = tripScores.filter((score) => score.target_trip === String(values[0]));
                  return {
                    results: [1, 2].map((scoreValue) => ({
                      score: scoreValue,
                      count: rows.filter((score) => score.score === scoreValue).length
                    })).filter((row) => row.count > 0)
                  };
                }
                if (query.includes("FROM trip_scores")) {
                  const rows = tripScores
                    .filter((score) => score.target_trip === String(values[0]))
                    .sort((a, b) => b.id - a.id);
                  const limit = typeof values[1] === "number" ? values[1] : rows.length;
                  const offset = typeof values[2] === "number" ? values[2] : 0;
                  return { results: rows.slice(offset, offset + limit) };
                }
                if (query.includes("FROM bbs_replies")) {
                  const rows = bbsReplies.filter((reply) => reply.topic_id === Number(values[0]));
                  const limit = typeof values[1] === "number" ? values[1] : rows.length;
                  const offset = typeof values[2] === "number" ? values[2] : 0;
                  return { results: rows.slice(offset, offset + limit) };
                }
                if (query.includes("FROM bbs_topics")) {
                  const rows = query.includes("WHERE digest = 1") ? bbsTopics.filter((topic) => topic.digest === 1) : bbsTopics;
                  const limit = typeof values[0] === "number" ? values[0] : rows.length;
                  const offset = typeof values[1] === "number" ? values[1] : 0;
                  return { results: rows.slice(offset, offset + limit) };
                }
                return { results: [] };
              },
              async run() {
                runs.push({ query, values });
                if (query.includes("INSERT INTO bbs_topics")) {
                  return { meta: { last_row_id: bbsTopics.length + 1 } };
                }
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
                  status: config[`room_status:${id}`] ?? "lobby",
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
      },
      async put(key: string, value: string) {
        config[key] = value;
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
        { room_poison: "poison wfbig authority decide lovers betr fosi foxs cat will open_vote comoutl wish_role istrip as_gm dummy_boy cust_dummy real_time:5:2 votedme votedisplay chdis:ch_wolf::ch_lovers:" },
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
            channelRestrictions: {
              wolf: true,
              common: false,
              lovers: true,
              fox: false
            },
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
            channelRestrictions: {
              wolf: true,
              common: false,
              lovers: true,
              fox: false
            },
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
    expect(roomInsert?.values.at(-1)).toBe("poison wfbig authority decide lovers betr cat will open_vote comoutl wish_role istrip as_gm dummy_boy cust_dummy real_time:5:2 votedme votedisplay chdis:ch_wolf::ch_lovers:");
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
        channelRestrictions: {
          wolf: true,
          common: false,
          lovers: true,
          fox: false
        },
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

  it("creates rooms from the legacy room_manager.php form fields", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/room_manager.php", {
        method: "POST",
        body: new URLSearchParams({
          command: "CREATE_ROOM",
          player_id: "player_legacy_owner",
          nickname: "Legacy Owner",
          room_name: "Legacy Room",
          room_comment: "Legacy comment",
          max_user: "16",
          game_option_wish_role: "wish_role",
          game_option_real_time: "real_time",
          game_option_real_time_day: "4",
          game_option_real_time_night: "2",
          game_option_dummy_boy: "dummy_boy",
          game_option_cust_dummy: "cust_dummy",
          dummy_name: "Legacy Dummy",
          dummy_lw: "Legacy last words",
          game_option_open_vote: "open_vote",
          game_option_comm_out: "comoutl",
          dellook: "1",
          game_option_will: "will",
          game_option_vote_me: "votedme",
          game_option_trip: "istrip",
          game_option_votedisplay: "votedisplay",
          game_option_manager_trip: "gm1234",
          game_option_gm: "as_gm",
          option_role_lovers: "lovers",
          option_role_decide: "decide",
          option_role_authority: "authority",
          option_wfbig_poison: "wfbig",
          option_role_poison: "poison",
          option_role_foxs: "betr",
          option_role_pobe: "pobe"
        })
      }),
      env
    );
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    const roomInsert = batches[0].find((statement) => statement.query.includes("INSERT INTO rooms"));
    const playerInsert = batches[0].find((statement) => statement.query.includes("INSERT INTO players"));
    const eventInsert = batches[0].find((statement) => statement.query.includes("room_created"));
    const roomId = String(roomInsert?.values[0]);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`/login.php?room_no=${roomId}`);
    expect(roomId).toMatch(/^room_[0-9a-f]{16}$/);
    expect(playerInsert?.values).toContain("player_legacy_owner");
    expect(playerInsert?.values).toContain("Legacy Owner");
    expect(roomInsert?.values).toContain("Legacy Room");
    expect(roomInsert?.values).toContain("Legacy comment");
    expect(roomInsert?.values).toContain(16);
    expect(roomInsert?.values).toContain(1);
    expect(roomInsert?.values).toContain("Legacy Dummy");
    expect(roomInsert?.values).toContain("Legacy last words");
    expect(String(roomInsert?.values.at(-2))).toMatch(/^[0-9a-f]{64}$/);
    expect(roomInsert?.values.at(-1)).toBe("poison wfbig authority decide lovers betr will open_vote comoutl wish_role istrip as_gm dummy_boy cust_dummy real_time:4:2 votedme votedisplay");
    expect(JSON.parse(String(eventInsert?.values.at(-1)))).toMatchObject({
      name: "Legacy Room",
      comment: "Legacy comment",
      maxPlayers: 16,
      options: {
        poison: true,
        bigWolf: true,
        authority: true,
        decider: true,
        lovers: true,
        betrayer: true,
        cat: false,
        deadRoleVisible: true,
        wishRole: true,
        tripRequired: true,
        gmEnabled: true,
        dummyBoy: true,
        customDummy: true,
        dummyName: "Legacy Dummy",
        dummyLastWords: "Legacy last words",
        realTime: true,
        dayMinutes: 4,
        nightMinutes: 2,
        selfVote: true,
        voteStatus: true
      }
    });

    const invalidCommand = await worker.fetch(new Request("http://example.test/room_manager.php", {
      method: "POST",
      body: new URLSearchParams({ command: "DELETE_ROOM", room_name: "Bad", room_comment: "Bad", max_user: "16" })
    }), env);
    expect(invalidCommand.status).toBe(400);
    expect(await invalidCommand.json()).toEqual({ error: "Invalid room_manager.php command" });
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

  it("accepts legacy Trip registration form posts", async () => {
    const env = envWithRooms([]);
    const body = new FormData();
    body.set("name", "ab12CD");
    body.set("password", "secret");

    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=post", {
        method: "POST",
        body
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/trip.php");
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

  it("accepts legacy Trip exclusion form posts", async () => {
    const env = envWithRooms([]);
    const body = new FormData();
    body.set("name", "ab12CD");
    body.set("password", "secret");
    body.set("aname", "Blocked nickname");

    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=out", {
        method: "POST",
        body
      }),
      env
    );
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/trip.php");
    expect(runs[0].query).toContain("INSERT INTO excluded_trips");
    expect(String(runs[0].values[0])).toMatch(/^[0-9a-f]{64}$/);
    expect(runs[0].values[1]).toBe("Blocked nickname");
  });

  it("returns legacy Trip unsupported password-model compatibility result pages", async () => {
    for (const [go, title] of [["edit", "修改Trip"], ["edit2", "修改紀錄"], ["accadd", "認領帳號"]] as const) {
      const body = new FormData();
      body.set("name", "ab12CD");
      body.set("password", "secret");
      body.set("aname", "Claimant");
      body.set("apassword", "old-password");

      const response = await worker.fetch(
        new Request(`http://example.test/trip.php?go=${go}`, {
          method: "POST",
          body
        }),
        envWithRooms([])
      );
      const html = await response.text();

      expect(response.status).toBe(501);
      expect(html).toContain(`<legend><strong>${title}</strong></legend>`);
      expect(html).toContain("此 Cloudflare 版本不保存");
      expect(html).toContain(`/trip.php?go=${go}`);
      expect(html).toContain("Trip頁面");
    }
  });

  it("renders the legacy Trip icon upload alias", async () => {
    const response = await worker.fetch(new Request("http://example.test/trip.php?go=icon"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("頭像一覽");
    expect(body).toContain("上傳頭像");
    expect(body).toContain("/assets/reference/img/icon_upload_title.jpg");
    expect(body).toContain("iconUploadButton");
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
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("Trip查詢");
    expect(body).toContain("Trip公開資料");
    expect(body).toContain("/api/trips/lookup?trip=");
  });

  it("renders Trip registration page", async () => {
    const response = await worker.fetch(new Request("http://example.test/trip"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("身份登錄");
    expect(body).toContain("/trip.php?go=post");
    expect(body).toContain("/trip.php?go=edit2");
    expect(body).toContain("/trip.php?go=edit");
    expect(body).toContain("/trip.php?go=accadd");
    expect(body).toContain("/trip.php?go=out");
    expect(body).toContain("/trip.php?go=icon");
    expect(body).toContain("registerTripButton");
    expect(body).toContain("claimTripButton");
    expect(body).toContain("excludeTripButton");
    expect(body).toContain('form name="trip" method="post" action="/trip.php?go=post"');
    expect(body).toContain('form name="trip" method="post" action="/trip.php?go=out"');
    expect(body).toContain('type="text" name="name" maxlength="32" size="24" value=""');
    expect(body).toContain('type="password" name="password" maxlength="128" size="24" value=""');
    expect(body).toContain('type="text" name="aname" maxlength="120" size="24" value=""');
    expect(body).toContain('id="submit" name="submit" type="submit" value="送出"');
    expect(body).toContain('form name="trip" method="post" action="/trip.php?go=edit"');
    expect(body).toContain('form name="trip" method="post" action="/trip.php?go=edit2"');
    expect(body).toContain('form name="trip" method="post" action="/trip.php?go=accadd"');
    expect(body).toContain('type="text" name="nname" size="24" value=""');
    expect(body).toContain('type="text" name="lname" size="24" value=""');
    expect(body).toContain('type="password" name="lpassword" size="24" value=""');
    expect(body).toContain('type="password" name="apassword" size="24" value=""');
    expect(body).toContain('id="tripClaimLegacySubmit" name="submit" type="submit" value="送出" disabled');
    expect(body).toContain('name="lpassword"');
    expect(body).toContain("Trip公開資料");
    expect(body).toContain("/api/trips/lookup?trip=");
  });

  it("supports legacy exact Trip search redirects", async () => {
    const response = await worker.fetch(new Request("http://example.test/trip.php?go=search&sname=ab12CD"), envWithRooms([]));

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/trip.php?go=trip&id=ab12CD");
  });

  it("renders Trip lookup for empty legacy Trip searches", async () => {
    const response = await worker.fetch(new Request("http://example.test/trip.php?go=search"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Trip查詢");
    expect(body).toContain('form name="trip" action="/trip.php" method="get"');
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
        },
        [],
        [],
        [
          { id: 1, reviewer_trip: "ef34GH", room_id: "room_a", target_trip: "ab12CD", message: "good", score: 1, created_at: "2026-05-06 12:00:00" },
          { id: 2, reviewer_trip: "ij56KL", room_id: "room_b", target_trip: "ab12CD", message: "bad", score: 2, created_at: "2026-05-06 12:01:00" },
          { id: 3, reviewer_trip: "mn78OP", room_id: "room_c", target_trip: "ab12CD", message: "great", score: 1, created_at: "2026-05-06 12:02:00" }
        ]
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      trip: {
        registered: true,
        excluded: false,
        players: ["player_a", "player_b"],
        scores: { positive: 2, negative: 1 },
        stats: { gamesPlayed: 7, wins: 3, losses: 4 }
      }
    });
    expect(JSON.stringify(body)).not.toContain(tripHash);
  });

  it("renders legacy Trip detail pages without exposing Trip hashes", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=trip&id=ab12CD"),
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
        },
        [],
        [],
        [
          { id: 1, reviewer_trip: "ef34GH", room_id: "room_a", target_trip: "ab12CD", message: "good", score: 1, created_at: "2026-05-06 12:00:00" },
          { id: 2, reviewer_trip: "ij56KL", room_id: "room_b", target_trip: "ab12CD", message: "bad", score: 2, created_at: "2026-05-06 12:01:00" }
        ]
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("Trip公開資料");
    expect(body).toContain("ab12CD");
    expect(body).toContain("已登記");
    expect(body).toContain("player_a");
    expect(body).toContain("player_b");
    expect(body).toContain("正:3/負:4/場:7");
    expect(body).toContain("(正:1/負:1)");
    expect(body).toContain("/trip.php?go=room&id=ab12CD");
    expect(body).toContain("/trip.php?go=smess&id=ab12CD");
    expect(body).toContain("參與紀錄");
    expect(body).not.toContain(tripHash);
  });

  it("renders legacy Trip comment surface", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=smess&id=ab12CD"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [], [], [
        { id: 1, reviewer_trip: "ef34GH", room_id: "room_a", target_trip: "ab12CD", message: "good", score: 1, created_at: "2026-05-06 12:00:00" },
        { id: 2, reviewer_trip: "ij56KL", room_id: "room_b", target_trip: "ab12CD", message: "bad", score: 2, created_at: "2026-05-06 12:01:00" }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("評語");
    expect(body).toContain("村莊ID");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_b");
    expect(body).toContain("/trip.php?go=trip&id=ij56KL");
    expect(body).toContain("負");
    expect(body).toContain("bad");
  });

  it("renders legacy Trip rating surface", async () => {
    const response = await worker.fetch(new Request("http://example.test/trip.php?go=sce&room=room_abc&trip=ab12CD"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("評分");
    expect(body).toContain('action="/trip.php?go=sce&amp;room=room_abc&amp;trip=ab12CD"');
    expect(body).toContain('name="sceis" value="1" disabled');
    expect(body).toContain("trip_score");
  });

  it("returns the legacy Trip rating compatibility result page", async () => {
    const body = new FormData();
    body.set("sceis", "1");
    body.set("mess", "good");

    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=sce&room=room_abc&trip=ab12CD", {
        method: "POST",
        body
      }),
      envWithRooms([])
    );
    const html = await response.text();

    expect(response.status).toBe(501);
    expect(html).toContain("<legend><strong>評分</strong></legend>");
    expect(html).toContain("尚未提供 PHP session 驗證的 Trip 評分寫入");
    expect(html).toContain("/trip.php?go=sce&amp;room=room_abc&amp;trip=ab12CD");
  });

  it("renders legacy Trip room record pages without exposing Trip hashes", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=room&id=ab12CD"),
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
              result_json: '{"winner":"werewolves","day":4,"players":[{"playerId":"player_current","nickname":"Current","role":"werewolf","alive":false},{"playerId":"player_other","nickname":"Other","role":"villager","alive":true}]}',
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
        new Set([tripHash]),
        new Set(),
        {
          player_current: tripHash,
          player_old: tripHash,
          player_other: "other_trip_hash"
        }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("Trip參與紀錄");
    expect(body).toContain("/trip.php?go=room&id=ab12CD");
    expect(body).toContain("/trip.php?go=room&id=ab12CD&amp;play=8");
    expect(body).toContain("/trip.php?go=room&id=ab12CD&amp;play=16");
    expect(body).toContain("/trip.php?go=room&id=ab12CD&amp;play=22");
    expect(body).toContain("/trip.php?go=room&id=ab12CD&amp;play=30");
    expect(body).toContain("room_new");
    expect(body).toContain("room_old");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_new");
    expect(body).toContain('target="_blank"');
    expect(body).toContain("Current");
    expect(body).toContain("Old Name");
    expect(body).toContain("人狼");
    expect(body).toContain("村民");
    expect(body).toContain("/assets/reference/img/victory_role_wolf.gif");
    expect(body).toContain("/assets/reference/img/victory_role_human.gif");
    expect(body).not.toContain("Other");
    expect(body).not.toContain(tripHash);
  });

  it("filters legacy Trip room records by reference play capacity", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=room&id=ab12CD&play=16"),
      envWithRooms(
        ["room_16", "room_22"],
        {},
        {},
        {
          room_16: [
            {
              id: 1,
              room_id: "room_16",
              result_json: '{"winner":"villagers","day":2,"players":[{"playerId":"player_current","nickname":"Filtered","role":"villager","alive":true}]}',
              created_at: "2026-05-04 03:00:00"
            }
          ],
          room_22: [
            {
              id: 2,
              room_id: "room_22",
              result_json: '{"winner":"werewolves","day":4,"players":[{"playerId":"player_current","nickname":"Too Large","role":"werewolf","alive":false}]}',
              created_at: "2026-05-04 05:00:00"
            }
          ]
        },
        {},
        {},
        {},
        { room_16: 16, room_22: 22 },
        {},
        {},
        {},
        new Set([tripHash]),
        new Set(),
        { player_current: tripHash }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("room_16");
    expect(body).toContain("Filtered");
    expect(body).not.toContain("room_22");
    expect(body).not.toContain("Too Large");
  });

  it("paginates legacy Trip room records and preserves play filters", async () => {
    const tripHash = await registeredTripHash("ab12CD");
    const roomIds = Array.from({ length: 16 }, (_, index) => `room_${String(index + 1).padStart(2, "0")}`);
    const records = Object.fromEntries(roomIds.map((roomId, index) => [
      roomId,
      [{
        id: index + 1,
        room_id: roomId,
        result_json: `{"winner":"villagers","day":2,"players":[{"playerId":"player_current","nickname":"Player ${index + 1}","role":"villager","alive":true}]}`,
        created_at: `2026-05-04 ${String(23 - index).padStart(2, "0")}:00:00`
      }]
    ]));
    const response = await worker.fetch(
      new Request("http://example.test/trip.php?go=room&id=ab12CD&play=16&page=2"),
      envWithRooms(
        roomIds,
        {},
        {},
        records,
        {},
        {},
        {},
        Object.fromEntries(roomIds.map((id) => [id, 16])),
        {},
        {},
        {},
        new Set([tripHash]),
        new Set(),
        { player_current: tripHash }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("bbs-pagination");
    expect(body).toContain('<a href="/trip.php?go=room&id=ab12CD&play=16&page=1">[1]</a>');
    expect(body).toContain("<strong>[2]</strong>");
    expect(body).toContain("room_16");
    expect(body).toContain("Player 16");
    expect(body).not.toContain("room_15");
    expect(body).not.toContain(tripHash);
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

  it("passes PHP-style room auto reload query into the room page", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_exists?auto_reload=20"), envWithRooms(["room_exists"]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<meta http-equiv="refresh" content="20">');
    expect(body).toContain("目前：20秒");
  });

  it("passes room view query into the room page", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_exists?view=heaven&auto_reload=20"), envWithRooms(["room_exists"]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-room-view="heaven"');
    expect(body).toContain("靈界視點");
    expect(body).toContain("/room/room_exists?view=heaven&amp;auto_reload=15");
  });

  it("renders PHP-style live room page aliases", async () => {
    const env = envWithRooms(["room_exists"]);
    const cases = [
      ["/game_view.php?room_no=room_exists&auto_reload=20", "spectator", "旁觀視點", "full", "完整頁面", "汝等是人是狼？[觀戰]"],
      ["/game_play.php?room_no=room_exists&auto_reload=20", "player", "玩家視點", "full", "完整頁面"],
      ["/game_up.php?room_no=room_exists&auto_reload=20", "player", "玩家視點", "up", "上方更新", "汝等是人是狼？＜發言＞"],
      ["/game_vote.php?room_no=room_exists&auto_reload=20", "player", "玩家視點", "vote", "投票入口", "汝等是人是狼？＜投票＞"],
      ["/login.php?room_no=room_exists&auto_reload=20", "player", "玩家視點", "full", "完整頁面"],
      ["/user_manager.php?room_no=room_exists&auto_reload=20", "player", "玩家視點", "full", "完整頁面"]
    ] as const;

    for (const [path, viewMode, label, pageMode, pageLabel, title] of cases) {
      const response = await worker.fetch(new Request(`http://example.test${path}`), env);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("[room_exists]");
      expect(body).toContain('<a id="game_top" name="game_top"></a>');
      expect(body).toContain(`data-room-view="${viewMode}"`);
      expect(body).toContain(`data-room-page="${pageMode}"`);
      expect(body).toContain(label);
      expect(body).toContain(pageLabel);
      if (title) {
        expect(body).toContain(`<title>${title}</title>`);
      }
      const expectedReloadView = viewMode === "player" ? "" : `&amp;view=${viewMode}`;
      expect(body).toContain(`<a href="/${path.slice(1).split("?")[0]}?room_no=room_exists&amp;auto_reload=15${expectedReloadView}">15秒</a>`);
      if (pageMode !== "full") {
        expect(body).toContain(`data-legacy-entry="${path.slice(1).split("?")[0]}"`);
      }
      if (pageMode === "vote") {
        expect(body).toContain("body.room-page-vote .room-panel-actions,");
        expect(body).toContain("body.room-page-vote .room-panel-members,");
        expect(body).toContain("body.room-page-vote .legacy-entry-map,");
        expect(body).toContain("body.room-page-vote .page-vote-only { display: none; }");
        expect(body).toContain("body.room-page-vote .game-header .full-room-only,");
      }
      expect(body).toContain("<strong>[住民登錄]</strong>");
      expect(body).toContain('<meta http-equiv="refresh" content="20">');
      expect(body).toContain("/game_play.php?room_no=room_exists&amp;auto_reload=20");
      expect(body).toContain("/game_view.php?room_no=room_exists&amp;auto_reload=20");
      expect(body).toContain("/game_view.php?room_no=room_exists&amp;auto_reload=20&amp;view=heaven");
    }

    const upResponse = await worker.fetch(new Request("http://example.test/game_up.php?room_no=room_exists&auto_reload=20"), env);
    expect(upResponse.status).toBe(200);
    const upBody = await upResponse.text();
    expect(upBody).toContain('form class="legacy-send-form" name="send" action="/game_play.php?room_no=room_exists&amp;auto_reload=20&amp;frame=bottom#game_top" method="POST" target="bottom" onsubmit="return false"');
    expect(upBody).toContain('<span class="page-up-inline-only legacy-up-vote-link">[<a href="/game_vote.php?room_no=room_exists&amp;auto_reload=20#game_top" target="bottom">投票/能力</a>]</span>');
    expect(upBody).toContain('<input id="chatText" name="sentence" maxlength="500" size="72">');

    const frameResponse = await worker.fetch(new Request("http://example.test/game_frame.php?room_no=room_exists&auto_reload=20"), env);
    expect(frameResponse.status).toBe(200);
    const frameBody = await frameResponse.text();
    expect(frameBody).toContain("<title>汝等是人是狼？＜遊戲＞</title>");
    expect(frameBody).toContain('<frameset rows="85,*" border="0" frameborder="0" framespacing="0" data-legacy-entry="game_frame.php">');
    expect(frameBody).toContain('<frame name="up" src="/game_up.php?room_no=room_exists&amp;auto_reload=20#game_top" scrolling="no" noresize>');
    expect(frameBody).toContain('<frame name="bottom" src="/game_play.php?room_no=room_exists&amp;auto_reload=20&amp;frame=bottom#game_top">');
    expect(frameBody).not.toContain('data-room-page="frame"');

    const bottomResponse = await worker.fetch(new Request("http://example.test/game_play.php?room_no=room_exists&frame=bottom&auto_reload=20"), env);
    expect(bottomResponse.status).toBe(200);
    const bottomBody = await bottomResponse.text();
    expect(bottomBody).toContain('data-room-page="bottom"');
    expect(bottomBody).toContain("body.room-page-bottom .room-chat-controls { display: none; }");
    expect(bottomBody).toContain("body.room-page-bottom .legacy-entry-map,");
    expect(bottomBody).toContain("body.room-page-bottom .page-bottom-only { display: none; }");
    expect(bottomBody).toContain("下方遊戲");
    expect(bottomBody).toContain("game_play.php 下框");
    expect(bottomBody).toContain('<a href="/game_play.php?room_no=room_exists&amp;auto_reload=15&amp;frame=bottom">15秒</a>');

    const missingRoomNo = await worker.fetch(new Request("http://example.test/game_view.php"), env);
    expect(missingRoomNo.status).toBe(400);
    expect(await missingRoomNo.json()).toEqual({ error: "game_view.php requires room_no" });

    const explicitSpectator = await worker.fetch(new Request("http://example.test/login.php?room_no=room_exists&view=spectator&auto_reload=20"), env);
    expect(await explicitSpectator.text()).toContain("/login.php?room_no=room_exists&amp;auto_reload=15&amp;view=spectator");
  });

  it("supports the legacy game_play.php logout alias", async () => {
    const env = envWithRooms(["room_exists"]);
    const response = await worker.fetch(new Request("http://example.test/game_play.php?go=out&room_no=room_exists"), env);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/game_view.php?room_no=room_exists");

    const missingRoomNo = await worker.fetch(new Request("http://example.test/game_play.php?go=out"), env);
    expect(missingRoomNo.status).toBe(400);
    expect(await missingRoomNo.json()).toEqual({ error: "game_play.php out requires room_no" });

    const missingRoom = await worker.fetch(new Request("http://example.test/game_play.php?go=out&room_no=room_missing"), env);
    expect(missingRoom.status).toBe(404);
  });

  it("supports the legacy game_vote.php POST alias without mutating game state", async () => {
    const env = envWithRooms(["room_exists"]);
    const form = new URLSearchParams({
      command: "vote",
      situation: "VOTE_KILL",
      vote_times: "1",
      target_no: "player_target"
    });
    const response = await worker.fetch(new Request("http://example.test/game_vote.php?room_no=room_exists", { method: "POST", body: form }), env);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/game_vote.php?room_no=room_exists#game_top");

    const formRoomNo = await worker.fetch(new Request("http://example.test/game_vote.php", {
      method: "POST",
      body: new URLSearchParams({ command: "vote", room_no: "room_exists", situation: "VOTE_KILL", target_no: "player_target" })
    }), env);
    expect(formRoomNo.status).toBe(303);
    expect(formRoomNo.headers.get("Location")).toBe("/game_vote.php?room_no=room_exists#game_top");

    const missingRoomNo = await worker.fetch(new Request("http://example.test/game_vote.php", {
      method: "POST",
      body: new URLSearchParams({ command: "vote", situation: "VOTE_KILL" })
    }), env);
    expect(missingRoomNo.status).toBe(400);
    expect(await missingRoomNo.json()).toEqual({ error: "game_vote.php vote requires room_no" });

    const missingRoom = await worker.fetch(new Request("http://example.test/game_vote.php?room_no=room_missing", {
      method: "POST",
      body: new URLSearchParams({ command: "vote", situation: "VOTE_KILL" })
    }), env);
    expect(missingRoom.status).toBe(404);

    const invalidCommand = await worker.fetch(new Request("http://example.test/game_vote.php?room_no=room_exists", {
      method: "POST",
      body: new URLSearchParams({ command: "delete", situation: "VOTE_KILL" })
    }), env);
    expect(invalidCommand.status).toBe(400);
    expect(await invalidCommand.json()).toEqual({ error: "Invalid game_vote.php command" });
  });

  it("supports the legacy user_manager.php registration POST alias", async () => {
    const env = envWithRooms(["room_exists"]);
    const form = new URLSearchParams({
      command: "regist",
      handle_name: "Alice",
      tripn: "trip",
      role: "seer",
      icon_no: "user_icon/001.gif"
    });
    const response = await worker.fetch(new Request("http://example.test/user_manager.php?room_no=room_exists", { method: "POST", body: form }), env);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/login.php?room_no=room_exists");

    const formRoomNo = await worker.fetch(new Request("http://example.test/user_manager.php", {
      method: "POST",
      body: new URLSearchParams({ command: "regist", room_no: "room_exists", handle_name: "Alice" })
    }), env);
    expect(formRoomNo.status).toBe(303);
    expect(formRoomNo.headers.get("Location")).toBe("/login.php?room_no=room_exists");

    const missingRoomNo = await worker.fetch(new Request("http://example.test/user_manager.php", {
      method: "POST",
      body: new URLSearchParams({ command: "regist", handle_name: "Alice" })
    }), env);
    expect(missingRoomNo.status).toBe(400);
    expect(await missingRoomNo.json()).toEqual({ error: "user_manager.php regist requires room_no" });

    const missingRoom = await worker.fetch(new Request("http://example.test/user_manager.php?room_no=room_missing", {
      method: "POST",
      body: new URLSearchParams({ command: "regist", handle_name: "Alice" })
    }), env);
    expect(missingRoom.status).toBe(404);

    const invalidCommand = await worker.fetch(new Request("http://example.test/user_manager.php?room_no=room_exists", {
      method: "POST",
      body: new URLSearchParams({ command: "delete", handle_name: "Alice" })
    }), env);
    expect(invalidCommand.status).toBe(400);
    expect(await invalidCommand.json()).toEqual({ error: "Invalid user_manager.php command" });
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
    expect(body).toContain('<a href="/index.php">←返回</a><br>');
    expect(body).toContain('<img class="title-img" src="/assets/reference/img/rule_title.jpg" alt="Rules">');
    expect(body).not.toContain('<p><img class="title-img" src="/assets/reference/img/rule_title.jpg" alt="Rules"></p>');
    expect(body).toContain("＜參加遊戲時必須注意的事情＞");
    expect(body).toContain("村子選項");
  });

  it("renders PHP-style legacy page aliases", async () => {
    const env = envWithRooms(
      ["room_finished"],
      { "room_status:room_finished": "ended" },
      {},
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
      {},
      [
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
      ]
    );
    const cases = [
      ["/index.php", "建立村子"],
      ["/room_manager.php", "建立村子"],
      ["/list.php", "聯合遊戲列表"],
      ["/old_log.php", "過去紀錄"],
      ["/bbs.php", "主題列表"],
      ["/icon_view.php", "頭像一覽"],
      ["/icon_upload.php", "上傳頭像"],
      ["/upload.php", "上傳頭像"],
      ["/upload2.php", "上傳頭像"],
      ["/rule.php", "汝等是人是狼？ Werewolf Cloudflare Port 說明"],
      ["/lang/jpn/rule.php", "汝等是人是狼？ Werewolf Cloudflare Port 說明"],
      ["/script_info.php", "汝等是人是狼？ Werewolf Cloudflare Port 系統特點"],
      ["/lang/jpn/script_info.php", "汝等是人是狼？ Werewolf Cloudflare Port 系統特點"],
      ["/stats.php", "勝率分析"],
      ["/trip.php", "身份登錄"],
      ["/version.php", "汝等是人是狼？[版本紀錄]"],
      ["/lang/cht/version.htm", "汝等是人是狼？[版本紀錄]"],
      ["/admin.php", "管理選單"],
      ["/game_log.php?room_no=room_finished", "村子完整紀錄"]
    ] as const;

    for (const [path, expected] of cases) {
      const response = await worker.fetch(new Request(`http://example.test${path}`), env);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(expected);
    }
  });

  it("marks icon upload aliases active in the legacy menu", async () => {
    for (const path of ["/icon_upload.php", "/upload.php", "/upload2.php"] as const) {
      const response = await worker.fetch(new Request(`http://example.test${path}`), envWithRooms([]));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain("<title>用戶圖像上傳</title>");
      expect(body).toContain('<td><b><a href="/icon_upload.php">頭像上傳</a></b></td>');
      expect(body).toContain('<td><a href="/icon_view.php">頭像一覽</a></td>');
    }
  });

  it("renders manual page", async () => {
    const response = await worker.fetch(new Request("http://example.test/manual"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("說明書");
    expect(body).toContain("登錄入村");
    expect(body).toContain("身份與紀錄");
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
    expect(body).toContain('<a href="/index.php">←返回</a><br>');
    expect(body).toContain('<img class="title-img" src="/assets/reference/img/script_info_title.jpg" alt="Script Info"><br><br>');
    expect(body).not.toContain('<p><img class="title-img" src="/assets/reference/img/script_info_title.jpg" alt="Script Info"></p>');
    expect(body).toContain("＜加入遊戲的系統必備條件＞");
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

  it("supports the legacy admin.php status alias", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=status"),
      envWithRooms([], { home_announcement: "<Runtime notice>" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("伺服器狀態");
    expect(body).toContain("Binding 檢查");
    expect(body).toContain("&lt;Runtime notice&gt;");
  });

  it("supports the modern admin status alias", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/status"),
      envWithRooms([], { home_announcement: "<Runtime notice>" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("伺服器狀態");
    expect(body).toContain("Binding 檢查");
    expect(body).toContain("&lt;Runtime notice&gt;");
  });

  it("renders admin navigation page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin"),
      envWithRooms([])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("管理選單");
    expect(body).toContain("/admin.php?go=rooms");
    expect(body).toContain("/admin.php?go=config");
    expect(body).toContain("/admin.php?go=bbs");
    expect(body).toContain("/admin.php?go=status");
    expect(body).toContain("/admin/status");
    expect(body).toContain('action="/admin.php?go=in"');
    expect(body).toContain('name="apass"');
    expect(body).not.toContain('name="adpass"');
    expect(body).toContain("各管理功能仍需輸入對應管理密碼");
  });

  it("supports the legacy admin.php login form", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=in", {
        method: "POST",
        body: new URLSearchParams({ apass: "secret token" })
      }),
      envWithRooms([])
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/admin.php?token=secret%20token");
    expect(response.headers.get("Set-Cookie")).toContain("adpass=secret%20token");
  });

  it("keeps accepting the older adpass admin login field", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=in", {
        method: "POST",
        body: new URLSearchParams({ adpass: "fallback token" })
      }),
      envWithRooms([])
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/admin.php?token=fallback%20token");
    expect(response.headers.get("Set-Cookie")).toContain("adpass=fallback%20token");
  });

  it("supports the legacy admin.php logout link", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=out"),
      envWithRooms([])
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/index.php");
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("renders config admin login without a valid token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/config"),
      envWithRooms([], { config_admin_token: "secret" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("系統設定管理");
    expect(body).toContain("configAdminToken");
    expect(body).not.toContain("configHomeAnnouncement");
  });

  it("supports the legacy admin.php config alias", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=config&token=secret"),
      envWithRooms([], { config_admin_token: "secret", home_announcement: "Runtime notice", maintenance_mode: "false" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("首頁公告");
    expect(body).toContain("Runtime notice");
  });

  it("renders runtime config admin page with a valid token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/config?token=secret"),
      envWithRooms([], { config_admin_token: "secret", home_announcement: "<Runtime notice>", maintenance_mode: "true" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("首頁公告");
    expect(body).toContain("&lt;Runtime notice&gt;");
    expect(body).toContain("configMaintenanceMode");
    expect(body).toContain("/api/admin/config");
  });

  it("lets config admins update runtime config", async () => {
    const env = envWithRooms([], { config_admin_token: "secret" });
    const response = await worker.fetch(
      new Request("http://example.test/api/admin/config", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-config-admin-token": "secret" },
        body: JSON.stringify({ homeAnnouncement: "New notice", maintenanceMode: true })
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ config: { homeAnnouncement: "New notice", maintenanceMode: true } });
    const configResponse = await worker.fetch(new Request("http://example.test/api/config"), env);
    await expect(configResponse.json()).resolves.toEqual({ config: { homeAnnouncement: "New notice", maintenanceMode: true } });
  });

  it("rejects config admin actions without the configured token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api/admin/config", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-config-admin-token": "wrong" },
        body: JSON.stringify({ homeAnnouncement: "New notice", maintenanceMode: true })
      }),
      envWithRooms([], { config_admin_token: "secret" })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Config admin token is invalid" });
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

  it("supports the legacy admin.php room list alias", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=rooms&token=secret"),
      envWithRooms(["room_admin"], { room_admin_token: "secret" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("請選擇要廢除的村");
    expect(body).toContain("room_admin");
    expect(body).toContain("/admin.php?go=del&amp;id=room_admin&amp;token=secret");
    expect(body).toContain("/game_view.php?room_no=room_admin");
    expect(body).toContain("/game_log.php?room_no=room_admin&amp;log_mode=on");
  });

  it("accepts the legacy admin adpass cookie for room administration", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=rooms", {
        headers: { Cookie: "adpass=secret%20cookie" }
      }),
      envWithRooms(["room_admin"], { room_admin_token: "secret cookie" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("room_admin");
    expect(body).toContain("/admin.php?go=del&amp;id=room_admin&amp;token=secret%20cookie");
  });

  it("renders the legacy admin.php room list when the adpass cookie is present", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php", {
        headers: { Cookie: "adpass=secret%20cookie" }
      }),
      envWithRooms(["room_admin"], { room_admin_token: "secret cookie" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("請選擇要廢除的村");
    expect(body).toContain("room_admin");
    expect(body).toContain("/admin.php?go=del&amp;id=room_admin&amp;token=secret%20cookie");
    expect(body).not.toContain("<legend><strong>管理選單</strong></legend>");
  });

  it("renders the legacy admin.php room list when a token query is present", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?token=secret"),
      envWithRooms(["room_admin"], { room_admin_token: "secret" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("請選擇要廢除的村");
    expect(body).toContain("room_admin");
    expect(body).toContain("/admin.php?go=del&amp;id=room_admin&amp;token=secret");
    expect(body).not.toContain("<legend><strong>管理選單</strong></legend>");
  });

  it("renders active rooms on the room admin page with a valid token", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/rooms?token=secret"),
      envWithRooms(["room_admin", "room_ended"], { room_admin_token: "secret", "room_status:room_ended": "ended" })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("請選擇要廢除的村");
    expect(body).toContain("表示：");
    expect(body).toContain("room_admin");
    expect(body).not.toContain("room_ended村");
    expect(body).toContain("參照");
    expect(body).toContain("/game_view.php?room_no=room_admin");
    expect(body).toContain("/game_log.php?room_no=room_admin&amp;log_mode=on");
    expect(body).toContain("/room/room_admin/events");
    expect(body).toContain("/admin.php?go=del&amp;id=room_admin&amp;token=secret");
    expect(body).toContain("adminEndRoom");
    expect(body).toContain("/api/admin/rooms/");
  });

  it("filters room admin pages by room status", async () => {
    const ended = await worker.fetch(
      new Request("http://example.test/admin/rooms?token=secret&status=ended"),
      envWithRooms(["room_admin", "room_ended"], { room_admin_token: "secret", "room_status:room_ended": "ended" })
    );

    expect(ended.status).toBe(200);
    const endedBody = await ended.text();
    expect(endedBody).toContain("room_ended");
    expect(endedBody).toContain("已結束");
    expect(endedBody).not.toContain("room_admin村");

    const all = await worker.fetch(
      new Request("http://example.test/admin/rooms?token=secret&status=all"),
      envWithRooms(["room_admin", "room_ended"], { room_admin_token: "secret", "room_status:room_ended": "ended" })
    );

    expect(all.status).toBe(200);
    const allBody = await all.text();
    expect(allBody).toContain("room_admin");
    expect(allBody).toContain("room_ended");
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

  it("supports the legacy admin.php room end link", async () => {
    const env = envWithRooms(["room_admin"], { room_admin_token: "secret" });
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=del&id=room_admin&token=secret"),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/admin.php?token=secret&ended=room_admin");
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

  it("preserves legacy admin cookie auth after room end links", async () => {
    const env = envWithRooms(["room_admin"], { room_admin_token: "secret cookie" });
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=del&id=room_admin", {
        headers: { Cookie: "adpass=secret%20cookie" }
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/admin.php?token=secret+cookie&ended=room_admin");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs).toContainEqual(
      expect.objectContaining({
        query: "UPDATE rooms SET status = 'ended' WHERE id = ?",
        values: ["room_admin"]
      })
    );
  });

  it("supports the legacy game_play.php room end link", async () => {
    const env = envWithRooms(["room_admin"], { room_admin_token: "secret" });
    const response = await worker.fetch(
      new Request("http://example.test/game_play.php?go=del&id=room_admin&room_no=room_admin&token=secret"),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/admin/rooms?token=secret&ended=room_admin");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs).toContainEqual(
      expect.objectContaining({
        query: "UPDATE rooms SET status = 'ended' WHERE id = ?",
        values: ["room_admin"]
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
      new Request("http://example.test/list.php?back_page=/index.php?from=list"),
      envWithRooms(["room_list"], {}, {}, {}, {}, { room_list: "real_time:3:1" }, { room_list: "Friendly" }, { room_list: 22 })
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("聯合遊戲列表");
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("服務中");
    expect(body).toContain("本伺服器");
    expect(body).toContain('<a href="/index.php?from=list">←返回</a>');
    expect(body).toContain("/login.php?room_no=room_list");
    expect(body).toContain("[room_list]");
    expect(body).toContain("list村");
    expect(body).toContain("Friendly");
    expect(body).toContain("人數22");

    const unsafeResponse = await worker.fetch(
      new Request("http://example.test/list.php?back_page=javascript:alert(1)"),
      envWithRooms([])
    );
    expect(unsafeResponse.status).toBe(200);
    expect(await unsafeResponse.text()).not.toContain("javascript:alert");
  });

  it("serves PHP-style federated api feed", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/api.php"),
      envWithRooms(
        ["room_waiting", "room_playing", "room_finished"],
        { "room_status:room_playing": "playing", "room_status:room_finished": "ended" },
        {},
        {},
        {},
        {},
        { room_waiting: "Friendly\tTabbed", room_playing: "Running\nNow" },
        { room_waiting: 16, room_playing: 30 }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    const body = await response.text();
    expect(body).toContain("werewolf-cf room_waiting\twaiting\tFriendly Tabbed\twaiting\t16\thttp://example.test/");
    expect(body).toContain("werewolf-cf room_playing\tplaying\tRunning Now\tplaying\t30\thttp://example.test/");
    expect(body).not.toContain("room_finished");
  });

  it("renders old log index with ended rooms", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/logs"),
      envWithRooms(
        ["room_active", "room_finished"],
        { "room_status:room_finished": "ended" },
        {},
        {
          room_finished: [
            {
              id: 1,
              room_id: "room_finished",
              result_json: '{"winner":"werewolves"}',
              created_at: "2026-05-06 12:00:00"
            }
          ]
        },
        {},
        { room_finished: "poison real_time:5:3 open_vote" },
        {},
        { room_finished: 16 }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("過去紀錄");
    expect(body).toContain("<title>汝等是人是狼？[過去紀錄]</title>");
    expect(body).toContain('<img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"><br>');
    expect(body).not.toContain('<p><img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"></p>');
    expect(body).toContain("room_finished");
    expect(body).toContain('<a href="/index.php">←返回</a> <a href="/old_log.php?all=1">[全部顯示]</a><br><br>');
    expect(body).not.toContain('<p><a href="/index.php">←返回</a> <a href="/old_log.php?all=1">[全部顯示]</a></p>');
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_finished&amp;reverse_log=on");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_finished&amp;heaven_talk=on");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_finished&amp;heaven_only=on");
    expect(body).toContain("/assets/reference/img/victory_role_wolf.gif");
    expect(body).toContain("人狼勝利");
    expect(body).toContain("埋毒");
    expect(body).not.toContain("room_active");
  });

  it("filters old log index with the reference search query", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/old_log.php?search=alpha"),
      envWithRooms(
        ["room_alpha", "room_beta"],
        { "room_status:room_alpha": "ended", "room_status:room_beta": "ended" },
        {},
        {},
        {},
        {},
        { room_alpha: "First finished", room_beta: "Second finished" }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("搜尋");
    expect(body).toContain('value="alpha"');
    expect(body).toContain("alpha 村");
    expect(body).not.toContain("beta 村");
  });

  it("paginates old log index like the reference", async () => {
    const roomIds = Array.from({ length: 26 }, (_, index) => `room_${String(index + 1).padStart(2, "0")}`);
    const response = await worker.fetch(
      new Request("http://example.test/old_log.php?page=2"),
      envWithRooms(roomIds, Object.fromEntries(roomIds.map((id) => [`room_status:${id}`, "ended"])))
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("bbs-pagination");
    expect(body).toContain('<a href="/old_log.php?page=1">[1]</a>');
    expect(body).toContain("<strong>[2]</strong>");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_26&amp;page=2");
    expect(body).toContain("room_26");
    expect(body).not.toContain("room_25");

    const allResponse = await worker.fetch(
      new Request("http://example.test/old_log.php?all=1"),
      envWithRooms(roomIds, Object.fromEntries(roomIds.map((id) => [`room_status:${id}`, "ended"])))
    );
    const allBody = await allResponse.text();
    expect(allBody).toContain("room_01");
    expect(allBody).toContain("room_26");
    expect(allBody).not.toContain("bbs-pagination");
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
      expect(requestedUrls).toEqual(["https://remote.example/base/api/rooms"]);
      expect(body).toContain("[room_list]");
      expect(body).toContain("[remote_room]");
      expect(body).toContain("Remote村");
      expect(body).toContain("遠端伺服器");
      expect(body).toContain('<table border="0" cellpadding="0" cellspacing="0" style="width: 100%">');
      expect(body).toContain('<tr><td colspan="5"><hr></td></tr>');
      expect(body).toContain("https://remote.example/base/room/remote_room");
      expect(body).toContain('<a href="https://remote.example/base">服務中</a>');
      expect(body).toContain('<td colspan="4"><a href="https://remote.example/base">https://remote.example/base</a></td>');
      expect(body).toContain("聯合伺服器狀態");
      expect(body).toContain("服務中");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders configured federated peer failures", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    try {
      const response = await worker.fetch(
        new Request("http://example.test/list"),
        envWithRooms(
          [],
          { federated_servers: JSON.stringify([{ name: "故障伺服器", url: "https://broken.example/base" }]) }
        )
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("聯合伺服器狀態");
      expect(body).toContain("故障伺服器");
      expect(body).toContain("https://broken.example/base");
      expect(body).toContain('<a href="https://broken.example/base">失聯中</a>');
      expect(body).toContain('<td colspan="4"><a href="https://broken.example/base">https://broken.example/base</a></td>');
      expect(body).toContain("連線失敗");
      expect(body).not.toContain("network down");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders configured legacy federated api.php peers", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      if (String(input).endsWith("/api/rooms")) {
        return new Response("not found", { status: 404 });
      }
      return new Response("legacy 123\tLegacy\tOld peer\tplaying\t16\thttps://legacy.example/base/\n", {
        headers: { "content-type": "text/plain" }
      });
    }) as typeof fetch;
    try {
      const response = await worker.fetch(
        new Request("http://example.test/list"),
        envWithRooms(
          [],
          { federated_servers: JSON.stringify([{ name: "舊式伺服器", url: "https://legacy.example/base" }]) }
        )
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(requestedUrls).toEqual(["https://legacy.example/base/api/rooms", "https://legacy.example/base/api.php"]);
      expect(body).toContain("[123]");
      expect(body).toContain("Legacy村");
      expect(body).toContain("Old peer");
      expect(body).toContain("舊式伺服器");
      expect(body).toContain("https://legacy.example/base/login.php?room_no=123");
      expect(body).toContain("服務中");
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
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("主題列表");
    expect(body).toContain('<a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php?go=dige">精華區</a>');
    expect(body).not.toContain('<p><a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php">全部主題</a> <a href="/bbs.php?go=dige">精華區</a></p>');
    expect(body).toContain('<table border="1" class="table1" bordercolor="#CCCCCC" align="center">');
    expect(body).toContain('<td align="center" width="150">最後時間</td>');
    expect(body).toContain('form name="bbs" method="post" action="/bbs.php?go=post"');
    expect(body).toContain('type="text" name="bname" maxlength="32" size="24"');
    expect(body).toContain('type="password" name="bpass" maxlength="128" size="24"');
    expect(body).toContain('id="submit" name="submit" type="submit" value="發表"');
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
    expect(body).toContain('<a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php">全部主題</a>');
    expect(body).not.toContain('<a href="/bbs.php?go=dige">精華區</a>');
    expect(body).toContain("Digest (精華)");
    expect(body).not.toContain("Normal");
  });

  it("renders paginated BBS topic list pages", async () => {
    const topics = Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      name: "Alice",
      title: `Topic ${index + 1}`,
      message: "Topic body",
      trip_hash: null,
      reply_count: 0,
      pinned: 0,
      locked: 0,
      digest: 0,
      created_at: "2026-05-06 12:00:00",
      updated_at: "2026-05-06 12:00:00"
    }));
    const response = await worker.fetch(
      new Request("http://example.test/bbs?page=2"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, topics)
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Topic 16");
    expect(body).not.toContain("Topic 1</a>");
    expect(body).toContain('<a href="/bbs.php?page=1">[1]</a>');
    expect(body).toContain("<strong>[2]</strong>");
  });

  it("renders BBS admin topic index", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin/bbs"),
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
    expect(body).toContain("討論管理");
    expect(body).toContain("Welcome");
    expect(body).toContain("Alice◆Trip");
    expect(body).toContain("/bbs.php?view=1#bbsModerationForm");
    expect(body).toContain("BBS 管理密碼");
  });

  it("renders BBS admin pagination", async () => {
    const topics = Array.from({ length: 31 }, (_, index) => ({
      id: index + 1,
      name: `Author ${index + 1}`,
      title: `Topic ${index + 1}`,
      message: "Hello",
      trip_hash: null,
      reply_count: 0,
      pinned: 0,
      locked: 0,
      digest: 0,
      created_at: "2026-05-06 12:00:00",
      updated_at: "2026-05-06 12:30:00"
    }));
    const response = await worker.fetch(
      new Request("http://example.test/admin/bbs?page=2"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, topics)
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("bbs-pagination");
    expect(body).toContain('<a href="/admin.php?go=bbs&page=1">[1]</a>');
    expect(body).toContain("<strong>[2]</strong>");
    expect(body).toContain('<a href="/admin.php?go=bbs&page=3">[3]</a>');
    expect(body).toContain("Topic 16");
    expect(body).not.toContain("Topic 1</a>");
  });

  it("supports the legacy admin.php BBS alias", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/admin.php?go=bbs"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Admin",
          title: "Pinned",
          message: "Hello",
          trip_hash: null,
          reply_count: 0,
          pinned: 1,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:00:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("討論管理");
    expect(body).toContain("Pinned");
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
          message: "Topic [b]body[/b]\n[color=blue]blue[/color]",
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
          message: "Reply [url]https://example.test[/url]",
          trip_hash: null,
          created_at: "2026-05-06 12:10:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain('Topic <b>body</b><br /><font color="blue">blue</font>');
    expect(body).toContain("文章列表");
    expect(body).toContain('<div id="table5">');
    expect(body).toContain('<table border="1" class="table1" width="100%" align="center">');
    expect(body).toContain('<td class="table2"><a href="/bbs.php?go=edit&amp;id=1">NO.1</a> &lt;..&gt; [2026-05-06 12:00:00]</td>');
    expect(body).toContain("Bob");
    expect(body).toContain('<a href="https://example.test" target="_blank">https://example.test</a>');
    expect(body).toContain('<table class="table1" style="width: 600px" align="right">');
    expect(body).toContain('form name="bbs" method="post" action="/bbs.php?go=postre"');
    expect(body).toContain('type="text" name="bname" maxlength="32" size="24"');
    expect(body).toContain('type="password" name="bpass" maxlength="128" size="24"');
    expect(body).toContain('type="hidden" name="id" value="1"');
    expect(body).toContain('id="submit" name="submit" type="submit" value="回覆"');
    expect(body).toContain("/api/bbs/topics/1/replies");
    expect(body).toContain("主題管理");
    expect(body).toContain("/api/bbs/topics/1/moderation");
    expect(body).toContain('<a href="/bbs.php?go=postre&amp;id=1">回覆主題</a> <a href="/bbs.php">回列表</a>');
    expect(body).not.toContain('<p><a href="/bbs.php?go=postre&amp;id=1">回覆主題</a> <a href="/bbs.php">回列表</a></p>');
  });

  it("renders BBS topic detail from legacy reply entry query", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=postre&id=1"),
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
          updated_at: "2026-05-06 12:30:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Welcome");
    expect(body).toContain("回覆主題");
    expect(body).toContain("/api/bbs/topics/1/replies");
  });

  it("renders BBS topic detail from legacy edit entry query", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=1"),
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
          updated_at: "2026-05-06 12:30:00"
        }
      ])
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Welcome");
    expect(body).toContain("bbsModerationForm");
    expect(body).toContain('form name="bbs" method="post" action="/bbs.php?go=edit&amp;id=1"');
    expect(body).toContain('name="editis"');
    expect(body).toContain('type="password" name="password" maxlength="128" size="24" value=""');
    expect(body).toContain('id="submit" name="submit" type="submit" value="送出"');
    expect(body).toContain("bbsTopicEditButton");
    expect(body).toContain("/api/bbs/topics/1/content");
  });

  it("renders BBS topic detail page from path route", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/bbs/1"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Topic body",
          trip_hash: "trip_hash",
          reply_count: 1,
          pinned: 1,
          locked: 0,
          digest: 1,
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
    expect(body).toContain("Reply body");
    expect(body).toContain("bbs-topic-pinned");
    expect(body).toContain("bbs-topic-digest");
  });

  it("renders paginated BBS topic replies from path route", async () => {
    const replies = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      topic_id: 1,
      name: "Bob",
      message: `Reply ${index + 1}`,
      trip_hash: null,
      created_at: "2026-05-06 12:10:00"
    }));
    const response = await worker.fetch(
      new Request("http://example.test/bbs/1?page=2"),
      envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
        {
          id: 1,
          name: "Alice",
          title: "Welcome",
          message: "Topic body",
          trip_hash: null,
          reply_count: 11,
          pinned: 0,
          locked: 0,
          digest: 0,
          created_at: "2026-05-06 12:00:00",
          updated_at: "2026-05-06 12:10:00"
        }
      ], replies)
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Reply 11");
    expect(body).not.toContain("Reply 1</div>");
    expect(body).toContain('<a href="/bbs.php?view=1&page=1">[1]</a>');
    expect(body).toContain("<strong>[2]</strong>");
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
    expect(await response.json()).toEqual({ posted: true, topicId: 1 });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("INSERT INTO bbs_topics");
    expect(runs[0].query).toContain("password_hash");
    expect(runs[0].values.slice(0, 3)).toEqual(["Alice", "Welcome", "Hello"]);
    expect(typeof runs[0].values[3]).toBe("string");
    expect(runs[0].values[4]).toBeNull();
  });

  it("stores hashed BBS topic passwords", async () => {
    const env = envWithRooms([]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Alice", title: "Welcome", message: "Hello", password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(typeof runs[0].values[4]).toBe("string");
    expect(runs[0].values[4]).not.toBe("secret");
  });

  it("accepts legacy BBS topic form posts", async () => {
    const env = envWithRooms([]);
    const body = new FormData();
    body.set("bname", "Alice");
    body.set("bpass", "secret");
    body.set("title", "Welcome");
    body.set("mess", "Hello from PHP form");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=post", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("INSERT INTO bbs_topics");
    expect(runs[0].values.slice(0, 3)).toEqual(["Alice", "Welcome", "Hello from PHP form"]);
    expect(runs[0].values[3]).toBeNull();
    expect(typeof runs[0].values[4]).toBe("string");
    expect(runs[0].values[4]).not.toBe("secret");
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
    expect(await response.json()).toEqual({ posted: true, replyCount: 1, page: 1 });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("INSERT INTO bbs_replies");
    expect(batches[0][0].query).toContain("password_hash");
    expect(batches[0][0].values.slice(0, 3)).toEqual([1, "Bob", "Reply body"]);
    expect(typeof batches[0][0].values[3]).toBe("string");
    expect(batches[0][0].values[4]).toBeNull();
    expect(batches[0][1].query).toContain("UPDATE bbs_topics SET reply_count = reply_count + 1");
  });

  it("stores hashed BBS reply passwords", async () => {
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
        body: JSON.stringify({ name: "Bob", message: "Reply body", password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(typeof batches[0][0].values[4]).toBe("string");
    expect(batches[0][0].values[4]).not.toBe("secret");
  });

  it("returns the target BBS reply page after creating replies", async () => {
    const replies = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      topic_id: 1,
      name: "Bob",
      message: `Reply ${index + 1}`,
      trip_hash: null,
      created_at: "2026-05-06 12:10:00"
    }));
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 10,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ], replies);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bob", message: "Reply body" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posted: true, replyCount: 11, page: 2 });
  });

  it("accepts legacy BBS reply form posts", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        reply_count: 10,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const body = new FormData();
    body.set("id", "1");
    body.set("bname", "Bob");
    body.set("bpass", "secret");
    body.set("mess", "Reply from PHP form");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=postre", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1&page=2");
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("INSERT INTO bbs_replies");
    expect(batches[0][0].values.slice(0, 3)).toEqual([1, "Bob", "Reply from PHP form"]);
    expect(batches[0][0].values[3]).toBeNull();
    expect(typeof batches[0][0].values[4]).toBe("string");
    expect(batches[0][0].values[4]).not.toBe("secret");
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

  it("edits BBS topic content with the configured admin token", async () => {
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
      new Request("http://example.test/api/bbs/topics/1/content", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-bbs-admin-token": "secret" },
        body: JSON.stringify({ title: "Edited", message: "Edited body" })
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      topic: expect.objectContaining({ id: 1, title: "Edited", message: "Edited body" })
    });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_topics SET title = ?, message = ?");
    expect(runs[0].values).toEqual(["Edited", "Edited body", 1]);
  });

  it("edits BBS topic content with the post password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/content", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Edited", message: "Edited body", password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      topic: expect.objectContaining({ id: 1, title: "Edited", message: "Edited body" })
    });
  });

  it("accepts legacy BBS topic edit form posts", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const body = new FormData();
    body.set("editis", "editok");
    body.set("password", "secret");
    body.set("bbst", "1");
    body.set("title", "Edited");
    body.set("mess", "Edited from PHP form");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=1", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_topics SET title = ?, message = ?");
    expect(runs[0].values).toEqual(["Edited", "Edited from PHP form", 1]);
  });

  it("rejects BBS topic content edits with the wrong post password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 0,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/content", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Edited", message: "Edited body", password: "wrong" })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS edit password is invalid" });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs).toEqual([]);
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

  it("deletes BBS topics and replies with the configured admin token", async () => {
    const env = envWithRooms([], { bbs_admin_token: "secret" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/moderation", {
        method: "DELETE",
        headers: { "x-bbs-admin-token": "secret" }
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, topicId: 1 });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("DELETE FROM bbs_replies");
    expect(batches[0][0].values).toEqual([1]);
    expect(batches[0][1].query).toContain("DELETE FROM bbs_topics");
    expect(batches[0][1].values).toEqual([1]);
  });

  it("accepts legacy BBS topic delete form posts", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 1,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const body = new FormData();
    body.set("editis", "del");
    body.set("password", "secret");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=1", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php");
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("DELETE FROM bbs_replies");
    expect(batches[0][0].values).toEqual([1]);
    expect(batches[0][1].query).toContain("DELETE FROM bbs_topics");
    expect(batches[0][1].values).toEqual([1]);
  });

  it("deletes BBS topics and replies with the post password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 1,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/moderation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, topicId: 1 });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("DELETE FROM bbs_replies");
    expect(batches[0][0].values).toEqual([1]);
    expect(batches[0][1].query).toContain("DELETE FROM bbs_topics");
    expect(batches[0][1].values).toEqual([1]);
  });

  it("rejects BBS topic deletion with the wrong post password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        reply_count: 1,
        pinned: 0,
        locked: 0,
        digest: 0,
        created_at: "2026-05-06 12:00:00",
        updated_at: "2026-05-06 12:00:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/moderation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong" })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS topic delete password is invalid" });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches).toEqual([]);
  });

  it("accepts legacy BBS admin flag form posts", async () => {
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
    const body = new FormData();
    body.set("editis", "tolock");
    body.set("password", "secret");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=1", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_topics SET pinned = ?, locked = ?, digest = ?");
    expect(runs[0].values).toEqual([0, 1, 0, 1]);
  });

  it("accepts legacy BBS reply edit form posts", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const body = new FormData();
    body.set("editis", "editok");
    body.set("password", "secret");
    body.set("mess", "Edited reply from PHP form");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=2", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1");
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_replies SET message = ?");
    expect(runs[0].values).toEqual(["Edited reply from PHP form", 2, 1]);
  });

  it("accepts legacy BBS reply delete form posts", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const body = new FormData();
    body.set("editis", "del");
    body.set("password", "secret");

    const response = await worker.fetch(
      new Request("http://example.test/bbs.php?go=edit&id=2", {
        method: "POST",
        body
      }),
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/bbs.php?view=1");
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("DELETE FROM bbs_replies WHERE id = ? AND topic_id = ?");
    expect(batches[0][0].values).toEqual([2, 1]);
    expect(batches[0][1].query).toContain("UPDATE bbs_topics SET reply_count = MAX(reply_count - 1, 0)");
    expect(batches[0][1].values).toEqual([1]);
  });

  it("deletes BBS replies with the configured admin token", async () => {
    const env = envWithRooms([], { bbs_admin_token: "secret" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "DELETE",
        headers: { "x-bbs-admin-token": "secret" }
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, topicId: 1, replyId: 2 });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches[0][0].query).toContain("DELETE FROM bbs_replies WHERE id = ? AND topic_id = ?");
    expect(batches[0][0].values).toEqual([2, 1]);
    expect(batches[0][1].query).toContain("UPDATE bbs_topics SET reply_count = MAX(reply_count - 1, 0)");
    expect(batches[0][1].values).toEqual([1]);
  });

  it("deletes BBS replies with the reply password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, topicId: 1, replyId: 2 });
  });

  it("rejects BBS reply deletion with the wrong reply password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong" })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS reply delete password is invalid" });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches).toEqual([]);
  });

  it("edits BBS replies with the configured admin token", async () => {
    const env = envWithRooms([], { bbs_admin_token: "secret" }, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-bbs-admin-token": "secret" },
        body: JSON.stringify({ message: "Edited reply" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: { id: 2, topicId: 1, message: "Edited reply" } });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs[0].query).toContain("UPDATE bbs_replies SET message = ?");
    expect(runs[0].values).toEqual(["Edited reply", 2, 1]);
  });

  it("edits BBS replies with the reply password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Edited reply", password: "secret" })
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: { id: 2, topicId: 1, message: "Edited reply" } });
  });

  it("rejects BBS reply edits with the wrong reply password", async () => {
    const env = envWithRooms([], {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, new Set(), new Set(), {}, [
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
        updated_at: "2026-05-06 12:00:00"
      }
    ], [
      {
        id: 2,
        topic_id: 1,
        name: "Bob",
        message: "Reply body",
        trip_hash: null,
        password_hash: await bbsPasswordHash("secret"),
        created_at: "2026-05-06 12:10:00"
      }
    ]);
    const response = await worker.fetch(
      new Request("http://example.test/api/bbs/topics/1/replies/2/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Edited reply", password: "wrong" })
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "BBS reply edit password is invalid" });
    const runs = (env as unknown as { runs: Array<{ query: string; values: unknown[] }> }).runs;
    expect(runs).toEqual([]);
  });

  it("rejects deleting missing BBS replies", async () => {
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
      new Request("http://example.test/api/bbs/topics/1/replies/99/moderation", {
        method: "DELETE",
        headers: { "x-bbs-admin-token": "secret" }
      }),
      env
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "BBS reply not found" });
    const batches = (env as unknown as { batches: Array<Array<{ query: string; values: unknown[] }>> }).batches;
    expect(batches).toEqual([]);
  });

  it("renders default icon catalog page", async () => {
    const response = await worker.fetch(new Request("http://example.test/icons"), envWithRooms([]));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<title>用戶圖像一覽</title>");
    expect(body).toContain("頭像一覽");
    expect(body).toContain('<a href="/index.php">←返回</a><br>');
    expect(body).not.toContain('<p><a href="/index.php">←返回</a></p>');
    expect(body).toContain('<img class="title-img" src="/assets/reference/img/icon_view_title.jpg" alt="頭像一覽"><br>');
    expect(body).not.toContain('<p><img class="title-img" src="/assets/reference/img/icon_view_title.jpg" alt="頭像一覽"></p>');
    expect(body).toContain("/icon_upload.php#upload");
    expect(body).toContain('<img class="title-img" src="/assets/reference/img/icon_upload_title.jpg" alt="上傳頭像"><br>');
    expect(body).not.toContain('<p><img class="title-img" src="/assets/reference/img/icon_upload_title.jpg" alt="上傳頭像"></p>');
    expect(body).toContain("/icon_view.php");
    expect(body).toContain("/assets/reference/user_icon/001.gif");
    expect(body).toContain('<table border="0" style="font-size:12pt;margin:12px auto 18px;">');
    expect(body).toContain('border="2" style="border-color:#DDDDDD;"');
    expect(body).toContain("32 x 32");
    expect(body).toContain("iconPickButton");
    expect(body).toContain("werewolf_cf_default_icon");
    expect(body).toContain("上傳頭像");
    expect(body).toContain("iconUploadButton");
    expect(body).toContain('action="/upload.php"');
    expect(body).toContain('name="icon_file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="80"');
    expect(body).toContain('name="icon_name" type="text" maxlength="20" size="20"');
    expect(body).toContain('name="submit" type="submit" value="登錄"');
    expect(body).toContain('name="color" value="#6699cc"');
    expect(body).toContain('action="/upload2.php"');
    expect(body).toContain("/api/assets/avatar");
  });

  it("renders room records page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/room/room_records/records?search=alpha&page=2"),
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
    expect(body).toContain('<a href="/old_log.php?search=alpha&amp;page=2">←返回</a>');
    expect(body).toContain("/game_view.php?room_no=room_records");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_records");
    expect(body).toContain("/game_log.php?room_no=room_records&amp;log_mode=on");
    expect(body).toContain("村民勝利");
    expect(body).toContain("第 3 日");
  });

  it("renders room events page", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/room/room_events/events?all=1&page=2"),
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
    expect(body).toContain('<a href="/old_log.php?all=1">←返回</a>');
    expect(body).toContain("/game_view.php?room_no=room_events");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_events");
    expect(body).toContain("/game_log.php?room_no=room_events&amp;log_mode=on");
    expect(body).toContain("遊戲開始");
    expect(body).not.toContain(">game_started<");
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
    expect(body).toContain("/game_view.php?room_no=room_log");
    expect(body).toContain("村民勝利");
    expect(body).toContain("Alice (player_a)");
    expect(body).toContain("占卜師");
    expect(body).toContain("遊戲開始");
    expect(body).toContain("player_host");
    expect(body).toContain("表示");
    expect(body).toContain("heaven_talk=on");
    expect(body).toContain("heaven_only=on");
  });

  it("renders full room transcript history beyond the recent event API window", async () => {
    const events = Array.from({ length: 55 }, (_, index) => {
      const id = 55 - index;
      return {
        id,
        room_id: "room_log",
        player_id: `player_${id}`,
        event_type: "public_chat",
        payload_json: JSON.stringify({ nickname: `Player ${id}`, text: `entry ${id}`, phase: "day", day: 1 }),
        created_at: `2026-05-06 12:${String(id).padStart(2, "0")}:00`
      };
    });
    const env = envWithRooms(["room_log"], {}, {}, {}, { room_log: events });

    const transcript = await worker.fetch(new Request("http://example.test/room/room_log/log"), env);
    const transcriptBody = await transcript.text();
    expect(transcript.status).toBe(200);
    expect(transcriptBody).toContain("entry 55");
    expect(transcriptBody).toContain("entry 1");

    const api = await worker.fetch(new Request("http://example.test/api/rooms/room_log/events"), env);
    const apiBody = await api.json() as { events: unknown[] };
    expect(api.status).toBe(200);
    expect(apiBody.events).toHaveLength(50);
    expect(JSON.stringify(apiBody)).toContain("entry 55");
    expect(apiBody.events).not.toContainEqual(expect.objectContaining({ id: 1 }));
  });

  it("renders legacy game_log.php transcript alias", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {},
      {
        room_log: [
          {
            id: 1,
            room_id: "room_log",
            player_id: "player_dead",
            event_type: "dead_chat",
            payload_json: '{"visibility":"private","nickname":"Dead","text":"heaven","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          }
        ]
      }
    );

    const response = await worker.fetch(new Request("http://example.test/game_log.php?room_no=room_log&heaven_talk=on&reverse_log=on"), env);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("村子完整紀錄");
    expect(body).toContain("heaven");
    expect(body).toContain("逆&amp;靈");
    expect(body).toContain("/game_log.php?room_no=room_log&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_log&amp;reverse_log=on&amp;heaven_talk=on");
    expect(body).toContain('<a href="/game_log.php?room_no=room_log&amp;log_mode=on">通常</a>');
    expect(body).toContain('<a href="/game_log.php?room_no=room_log&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=public">旁觀</a>');
    expect(body).toContain('<a href="/old_log.php">←返回</a>');

    const missingRoom = await worker.fetch(new Request("http://example.test/game_log.php"), env);
    expect(missingRoom.status).toBe(400);
    expect(await missingRoom.json()).toEqual({ error: "game_log.php requires room_no" });
  });

  it("renders legacy old_log.php transcript alias", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {},
      {
        room_log: [
          {
            id: 1,
            room_id: "room_log",
            player_id: "player_dead",
            event_type: "dead_chat",
            payload_json: '{"visibility":"private","nickname":"Dead","text":"heaven","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          }
        ]
      }
    );

    const response = await worker.fetch(new Request("http://example.test/old_log.php?log_mode=on&room_no=room_log&heaven_talk=on&reverse_log=on&search=alpha&page=2"), env);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("村子完整紀錄");
    expect(body).toContain("heaven");
    expect(body).toContain("逆&amp;靈");
    expect(body).toContain("/game_log.php?room_no=room_log&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on");
    expect(body).toContain("/old_log.php?log_mode=on&amp;room_no=room_log&amp;reverse_log=on&amp;heaven_talk=on");
    expect(body).toContain('<a href="/old_log.php?log_mode=on&amp;room_no=room_log">通常</a>');
    expect(body).toContain('<a href="/old_log.php?log_mode=on&amp;room_no=room_log&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=public">旁觀</a>');
    expect(body).toContain('<form method="get" action="/old_log.php"');
    expect(body).toContain('<input type="hidden" name="log_mode" value="on">');
    expect(body).toContain('<input type="hidden" name="room_no" value="room_log">');
    expect(body).toContain('<a href="/old_log.php?search=alpha&amp;page=2">←返回</a>');

    const missingRoom = await worker.fetch(new Request("http://example.test/old_log.php?log_mode=on"), env);
    expect(missingRoom.status).toBe(400);
    expect(await missingRoom.json()).toEqual({ error: "old_log.php requires room_no" });
  });

  it("applies viewer masking on legacy transcript aliases", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {},
      {
        room_log: [
          {
            id: 3,
            room_id: "room_log",
            player_id: "player_wolf",
            event_type: "wolf_chat",
            payload_json: '{"visibility":"private","nickname":"Wolf","text":"howl","phase":"night","day":2}',
            created_at: "2026-05-06 12:03:00"
          },
          {
            id: 2,
            room_id: "room_log",
            player_id: "player_dead",
            event_type: "dead_chat",
            payload_json: '{"visibility":"private","nickname":"Dead","text":"heaven","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          },
          {
            id: 1,
            room_id: "room_log",
            player_id: null,
            event_type: "game_started",
            payload_json: '{"day":1,"players":4}',
            created_at: "2026-05-06 12:01:00"
          }
        ]
      }
    );

    const publicView = await worker.fetch(new Request("http://example.test/old_log.php?log_mode=on&room_no=room_log&viewer=public&heaven_talk=on"), env);
    const publicBody = await publicView.text();
    expect(publicView.status).toBe(200);
    expect(publicBody).toContain("旁觀");
    expect(publicBody).toContain("遊戲開始");
    expect(publicBody).not.toContain("內容:howl");
    expect(publicBody).not.toContain("內容:heaven");

    const deadView = await worker.fetch(new Request("http://example.test/game_log.php?room_no=room_log&viewer=dead&heaven_talk=on"), env);
    const deadBody = await deadView.text();
    expect(deadView.status).toBe(200);
    expect(deadBody).toContain("靈界");
    expect(deadBody).toContain("heaven");
    expect(deadBody).not.toContain("內容:howl");
    expect(deadBody).toContain("/old_log.php?log_mode=on&amp;room_no=room_log&amp;heaven_talk=on&amp;viewer=dead");

    const gmView = await worker.fetch(new Request("http://example.test/game_log.php?room_no=room_log&viewer=gm&heaven_talk=on"), env);
    const gmBody = await gmView.text();
    expect(gmView.status).toBe(200);
    expect(gmBody).toContain("GM");
    expect(gmBody).toContain("howl");
    expect(gmBody).toContain("heaven");
    expect(gmBody).toContain("/game_log.php?room_no=room_log&amp;log_mode=on&amp;heaven_talk=on&amp;viewer=gm");
    expect(gmBody).toContain('<form method="get" action="/game_log.php"');
    expect(gmBody).toContain('<input type="hidden" name="room_no" value="room_log">');
    expect(gmBody).toContain('<input type="hidden" name="log_mode" value="on">');

    const playerView = await worker.fetch(new Request("http://example.test/old_log.php?log_mode=on&room_no=room_log&viewer=player&viewer_player_id=player_wolf&reverse_log=on&heaven_talk=on"), env);
    const playerBody = await playerView.text();
    expect(playerView.status).toBe(200);
    expect(playerBody).toContain("玩家 Wolf (player_wolf)");
    expect(playerBody).toContain("howl");
    expect(playerBody).not.toContain("內容:heaven");
    expect(playerBody).toContain("/old_log.php?log_mode=on&amp;room_no=room_log&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(playerBody).toContain("/game_log.php?room_no=room_log&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(playerBody).toContain('<form method="get" action="/old_log.php"');
    expect(playerBody).toContain('<input type="hidden" name="log_mode" value="on">');
    expect(playerBody).toContain('<input type="hidden" name="room_no" value="room_log">');
    expect(playerBody).toContain('<input type="hidden" name="viewer" value="player">');
    expect(playerBody).toContain('<input type="hidden" name="reverse_log" value="on">');
    expect(playerBody).toContain('<input type="hidden" name="heaven_talk" value="on">');
    expect(playerBody).toContain('<option value="player_wolf" selected>Wolf (player_wolf)</option>');
  });

  it("applies old-log heaven filters on room transcript page", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {},
      {
        room_log: [
          {
            id: 3,
            room_id: "room_log",
            player_id: "player_wolf",
            event_type: "wolf_chat",
            payload_json: '{"visibility":"private","nickname":"Wolf","text":"howl","phase":"night","day":2}',
            created_at: "2026-05-06 12:03:00"
          },
          {
            id: 2,
            room_id: "room_log",
            player_id: "player_dead",
            event_type: "dead_chat",
            payload_json: '{"visibility":"private","nickname":"Dead","text":"heaven","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          },
          {
            id: 1,
            room_id: "room_log",
            player_id: null,
            event_type: "game_started",
            payload_json: '{"day":1,"players":4}',
            created_at: "2026-05-06 12:01:00"
          }
        ]
      }
    );

    const normal = await worker.fetch(new Request("http://example.test/room/room_log/log"), env);
    const normalBody = await normal.text();
    expect(normalBody).toContain("howl");
    expect(normalBody).not.toContain("內容:heaven");

    const withHeaven = await worker.fetch(new Request("http://example.test/room/room_log/log?heaven_talk=on"), env);
    const withHeavenBody = await withHeaven.text();
    expect(withHeavenBody).toContain("howl");
    expect(withHeavenBody).toContain("heaven");

    const heavenOnly = await worker.fetch(new Request("http://example.test/room/room_log/log?heaven_only=on"), env);
    const heavenOnlyBody = await heavenOnly.text();
    expect(heavenOnlyBody).toContain("heaven");
    expect(heavenOnlyBody).toContain("遊戲開始");
    expect(heavenOnlyBody).not.toContain("內容:howl");
  });

  it("applies explicit viewer masking on room transcript page", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {},
      {
        room_log: [
          {
            id: 1,
            room_id: "room_log",
            player_id: null,
            event_type: "game_started",
            payload_json: '{"day":1,"players":4}',
            created_at: "2026-05-06 12:01:00"
          },
          {
            id: 2,
            room_id: "room_log",
            player_id: "player_wolf",
            event_type: "wolf_chat",
            payload_json: '{"visibility":"private","nickname":"Wolf","text":"howl","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          },
          {
            id: 3,
            room_id: "room_log",
            player_id: "player_seer",
            event_type: "self_talk",
            payload_json: '{"visibility":"private","nickname":"Seer","text":"mutter","phase":"night","day":2}',
            created_at: "2026-05-06 12:03:00"
          },
          {
            id: 4,
            room_id: "room_log",
            player_id: "player_wolf",
            event_type: "day_vote",
            payload_json: '{"visibility":"private","nickname":"Wolf","targetPlayerId":"player_target","targetNickname":"Target","phase":"day","day":2}',
            created_at: "2026-05-06 12:04:00"
          }
        ]
      }
    );

    const publicView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=public&heaven_talk=on"), env);
    const publicBody = await publicView.text();
    expect(publicBody).toContain("旁觀");
    expect(publicBody).toContain("遊戲開始");
    expect(publicBody).not.toContain("howl");
    expect(publicBody).not.toContain("mutter");

    const playerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_wolf&heaven_talk=on"), env);
    const playerBody = await playerView.text();
    expect(playerBody).toContain("玩家 Wolf (player_wolf)");
    expect(playerBody).toContain("玩家視點");
    expect(playerBody).toContain('<option value="player_wolf" selected>Wolf (player_wolf)</option>');
    expect(playerBody).toContain("/room/room_log/log?heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(playerBody).toContain("howl");
    expect(playerBody).not.toContain("mutter");

    const targetPlayerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_target&heaven_talk=on"), env);
    const targetPlayerBody = await targetPlayerView.text();
    expect(targetPlayerView.status).toBe(200);
    expect(targetPlayerBody).toContain("玩家 Target (player_target)");
    expect(targetPlayerBody).toContain('<option value="player_target" selected>Target (player_target)</option>');
    expect(targetPlayerBody).not.toContain("howl");

    const missingPlayerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player"), env);
    expect(missingPlayerView.status).toBe(400);
    expect(await missingPlayerView.json()).toEqual({ error: "Player transcript viewer requires viewer_player_id" });

    const invalidPlayerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=bad"), env);
    expect(invalidPlayerView.status).toBe(400);

    const unknownPlayerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_unknown"), env);
    expect(unknownPlayerView.status).toBe(400);
    expect(await unknownPlayerView.json()).toEqual({ error: "Player transcript viewer is not part of this room history" });
  });

  it("shows teammate private channel rows in player transcript view", async () => {
    const env = envWithRooms(
      ["room_log"],
      { "room_status:room_log": "ended" },
      {},
      {
        room_log: [
          {
            id: 1,
            room_id: "room_log",
            result_json: '{"winner":"villagers","day":3,"players":[{"playerId":"player_wolf_a","nickname":"Wolf A","role":"werewolf","alive":true},{"playerId":"player_wolf_b","nickname":"Wolf B","role":"big_wolf","alive":true},{"playerId":"player_fox_a","nickname":"Fox A","role":"fox","alive":true},{"playerId":"player_fox_b","nickname":"Fox B","role":"fox","alive":true},{"playerId":"player_seer","nickname":"Seer","role":"seer","alive":true}]}',
            created_at: "2026-05-06 12:00:00"
          }
        ]
      },
      {
        room_log: [
          {
            id: 1,
            room_id: "room_log",
            player_id: "player_wolf_b",
            event_type: "wolf_chat",
            payload_json: '{"visibility":"private","nickname":"Wolf B","text":"pack message","phase":"night","day":2}',
            created_at: "2026-05-06 12:02:00"
          },
          {
            id: 2,
            room_id: "room_log",
            player_id: "player_fox_b",
            event_type: "fox_chat",
            payload_json: '{"visibility":"private","nickname":"Fox B","text":"fox message","phase":"night","day":2}',
            created_at: "2026-05-06 12:03:00"
          }
        ]
      }
    );

    const wolfView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_wolf_a&heaven_talk=on"), env);
    const wolfBody = await wolfView.text();
    expect(wolfBody).toContain("pack message");
    expect(wolfBody).not.toContain("fox message");
    expect(wolfBody).toContain("可聽見的同陣營密談");

    const foxView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_fox_a&heaven_talk=on"), env);
    const foxBody = await foxView.text();
    expect(foxBody).toContain("fox message");
    expect(foxBody).not.toContain("pack message");

    const seerView = await worker.fetch(new Request("http://example.test/room/room_log/log?viewer=player&viewer_player_id=player_seer&heaven_talk=on"), env);
    const seerBody = await seerView.text();
    expect(seerBody).not.toContain("pack message");
    expect(seerBody).not.toContain("fox message");
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
    expect(body).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(body).toContain("&lt;b&gt;Runtime notice&lt;/b&gt;");
    expect(body).not.toContain("<b>Runtime notice</b>");
  });

  it("serves legacy announcement.txt from KV config", async () => {
    const response = await worker.fetch(
      new Request("http://example.test/announcement.txt"),
      envWithRooms([], { home_announcement: "Runtime notice" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("Runtime notice\n");
  });

  it("serves default legacy announcement.txt when KV is absent", async () => {
    const response = await worker.fetch(new Request("http://example.test/announcement.txt"), envWithRooms([]));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("目前支援建立村子");
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
          "gm_set_common_voice",
          "gm_set_channel_restrictions",
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
          "objection",
          "room_end_vote"
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
        gameStateFields: [
          "roomId",
          "phase",
          "day",
          "hostId",
          "revoteCount",
          "commonTalkVisible",
          "channelRestrictions",
          "players",
          "openVote",
          "selfVote",
          "voteStatus",
          "votes",
          "votedPlayerIds",
          "ownNightActionTarget",
          "lobbyStartVotedPlayerIds",
          "lobbyKickVoteTargets",
          "objectionCounts",
          "roomEndVotedPlayerIds",
          "winner",
          "phaseEndsAt",
          "suddenDeathWarningAt",
          "log"
        ],
        privateChannels: ["wolf_chat", "fox_chat", "common_chat", "lovers_chat", "dead_chat", "self_talk", "gm_chat", "gm_whisper"],
        channelVariants: {
          common_chat: {
            publicVoicePlayerId: "common_voice",
            publicVoiceNickname: "共有者的聲音",
            description: "When commonTalkVisible is enabled, living non-common players and dead common partners receive an anonymous common_chat voice."
          }
        },
        channelRestrictionOption: "chdis:ch_wolf:ch_common:ch_lovers:ch_fox",
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
          { id: 4, room_id: "room_a", result_json: "{\"winner\":\"foxes\"}", created_at: "2026-05-06 12:03:00" },
          { id: 5, room_id: "room_a", result_json: "{\"winner\":\"draw\"}", created_at: "2026-05-06 12:04:00" }
        ]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      winRates: [
        { winner: "villagers", label: "人勝", wins: 2, total: 5, rate: 40 },
        { winner: "werewolves", label: "狼勝", wins: 1, total: 5, rate: 20 },
        { winner: "foxes", label: "狐勝", wins: 1, total: 5, rate: 20 },
        { winner: "lovers", label: "戀勝", wins: 0, total: 5, rate: 0 },
        { winner: "draw", label: "平手", wins: 1, total: 5, rate: 20 }
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

  it("supports legacy avatar upload.php field names", async () => {
    const env = envWithRooms([]);
    const form = new FormData();
    form.set("player_id", "player_avatar");
    form.set("icon_file", new File(["legacy-avatar"], "legacy.gif", { type: "image/gif" }));

    const upload = await worker.fetch(
      new Request("http://example.test/upload.php", {
        method: "POST",
        body: form
      }),
      env
    );

    expect(upload.status).toBe(200);
    expect(upload.headers.get("content-type")).toContain("text/html");
    const uploadBody = await upload.text();
    expect(uploadBody).toContain("圖像上傳結果");
    expect(uploadBody).toContain("上傳完成");
    expect(uploadBody).toContain("/assets/avatar/player_avatar");
    expect(uploadBody).toContain("/icon_view.php");

    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_avatar"), env);

    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("image/gif");
    expect(await download.text()).toBe("legacy-avatar");
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

  it("supports legacy avatar upload2.php removal forms", async () => {
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

    const removalForm = new FormData();
    removalForm.set("player_id", "player_avatar");
    const removal = await worker.fetch(
      new Request("http://example.test/upload2.php", {
        method: "POST",
        body: removalForm
      }),
      env
    );
    const download = await worker.fetch(new Request("http://example.test/assets/avatar/player_avatar"), env);

    expect(removal.status).toBe(200);
    expect(removal.headers.get("content-type")).toContain("text/html");
    const removalBody = await removal.text();
    expect(removalBody).toContain("アイコン削除完了");
    expect(removalBody).toContain('<meta http-equiv=refresh content="1;URL=icon_upload.php">');
    expect(removalBody).toContain('削除完了：登錄ページに飛びます畫面切換中<a href="icon_upload.php">按我繼續</a>');
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
