import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-wrangler-config.mjs");

function wranglerConfig(databaseId, kvId) {
  return `name = "werewolf-cf"
main = "src/index.ts"
compatibility_date = "2026-05-03"

[[durable_objects.bindings]]
name = "ROOM_DO"
class_name = "RoomDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDurableObject"]

[[d1_databases]]
binding = "DB"
database_name = "werewolf-cf"
database_id = "${databaseId}"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "werewolf-cf-assets"

[[kv_namespaces]]
binding = "CONFIG"
id = "${kvId}"
`;
}

function runVerifier(config, args = []) {
  const cwd = mkdtempSync(join(tmpdir(), "werewolf-cf-wrangler-"));
  writeFileSync(join(cwd, "wrangler.toml"), config);
  try {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd,
      encoding: "utf8"
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("wrangler config verifier", () => {
  it("allows local placeholder resource ids for local development", () => {
    const result = runVerifier(wranglerConfig("local-dev-placeholder", "local-dev-placeholder"));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("wrangler.toml local verification passed");
  });

  it("rejects production configs with placeholder resource ids", () => {
    const result = runVerifier(wranglerConfig("local-dev-placeholder", "local-dev-placeholder"), ["--production"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Production config still contains local-dev-placeholder");
  });

  it("accepts production configs with explicit resource ids", () => {
    const result = runVerifier(wranglerConfig("prod-d1-id", "prod-kv-id"), ["--production"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("wrangler.toml production verification passed");
  });
});
