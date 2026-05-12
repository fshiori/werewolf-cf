import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-game-loop.mjs");

function runScript(args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { env: { ...env, GAME_LOOP_SMOKE_ID: "game" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

describe("game-loop smoke script", () => {
  it("requires explicit write confirmation", async () => {
    const result = await runScript(["http://127.0.0.1:8787"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pass --yes");
  });

  it("requires a Worker URL after write confirmation", async () => {
    const result = await runScript(["--yes"], { ...process.env, WORKER_HOST: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set WORKER_HOST");
  });
});
