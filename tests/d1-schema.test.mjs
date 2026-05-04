import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-d1-schema.mjs");

function runWithTables(tables) {
  const cwd = mkdtempSync(join(tmpdir(), "werewolf-cf-d1-schema-"));
  const inputPath = join(cwd, "tables.json");
  writeFileSync(inputPath, JSON.stringify([{ results: tables.map((name) => ({ name })) }]));
  try {
    return spawnSync(process.execPath, [scriptPath, "--input", inputPath], { encoding: "utf8" });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("D1 schema verifier", () => {
  it("accepts the required production tables", () => {
    const result = runWithTables(["rooms", "players", "player_stats", "game_records", "room_events", "registered_trips", "excluded_trips"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("D1 local schema verification passed");
  });

  it("reports missing required tables", () => {
    const result = runWithTables(["rooms", "players"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing table: game_records");
    expect(result.stderr).toContain("Missing table: registered_trips");
  });

  it("rejects non-JSON D1 output", () => {
    const cwd = mkdtempSync(join(tmpdir(), "werewolf-cf-d1-schema-"));
    const inputPath = join(cwd, "tables.txt");
    writeFileSync(inputPath, "not json");
    try {
      const result = spawnSync(process.execPath, [scriptPath, "--input", inputPath], { encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unable to parse D1 table query output as JSON");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
