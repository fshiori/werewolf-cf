import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-d1-schema.mjs");

const requiredColumns = {
  rooms: ["id", "name", "status", "created_at", "updated_at", "option_role", "room_comment", "max_user", "dellook", "dummy_name", "dummy_last_words", "gm_trip_hash"],
  players: ["id", "nickname", "created_at", "last_seen_at", "trip_hash", "registered_trip_hash"],
  player_stats: ["player_id", "games_played", "wins", "losses", "updated_at"],
  game_records: ["id", "room_id", "result_json", "created_at"],
  room_events: ["id", "room_id", "player_id", "event_type", "payload_json", "created_at"],
  registered_trips: ["trip_hash", "created_at"],
  excluded_trips: ["trip_hash", "reason", "created_at"]
};

function rowsForSchema(schema) {
  return [
    ...Object.keys(schema).map((name) => ({ name, table_name: null, column_name: null })),
    ...Object.entries(schema).flatMap(([tableName, columns]) =>
      columns.map((columnName) => ({ name: null, table_name: tableName, column_name: columnName }))
    )
  ];
}

function runWithSchema(schema) {
  const cwd = mkdtempSync(join(tmpdir(), "werewolf-cf-d1-schema-"));
  const inputPath = join(cwd, "tables.json");
  writeFileSync(inputPath, JSON.stringify([{ results: rowsForSchema(schema) }]));
  try {
    return spawnSync(process.execPath, [scriptPath, "--input", inputPath], { encoding: "utf8" });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("D1 schema verifier", () => {
  it("accepts the required production tables and columns", () => {
    const result = runWithSchema(requiredColumns);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("D1 local schema verification passed");
  });

  it("reports missing required tables", () => {
    const result = runWithSchema({
      rooms: requiredColumns.rooms,
      players: requiredColumns.players
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing table: game_records");
    expect(result.stderr).toContain("Missing table: registered_trips");
  });

  it("reports missing required columns", () => {
    const schema = {
      ...requiredColumns,
      rooms: requiredColumns.rooms.filter((column) => column !== "gm_trip_hash"),
      players: requiredColumns.players.filter((column) => column !== "registered_trip_hash")
    };
    const result = runWithSchema(schema);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing column: rooms.gm_trip_hash");
    expect(result.stderr).toContain("Missing column: players.registered_trip_hash");
  });

  it("rejects non-JSON D1 output", () => {
    const cwd = mkdtempSync(join(tmpdir(), "werewolf-cf-d1-schema-"));
    const inputPath = join(cwd, "tables.txt");
    writeFileSync(inputPath, "not json");
    try {
      const result = spawnSync(process.execPath, [scriptPath, "--input", inputPath], { encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unable to parse D1 schema query output as JSON");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
