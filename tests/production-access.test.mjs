import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-production-access.mjs");

function runScript(env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { env });
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

async function createFakeWrangler(body) {
  const dir = await mkdtemp(join(tmpdir(), "werewolf-production-access-"));
  const wranglerPath = join(dir, "wrangler.mjs");
  await writeFile(wranglerPath, body);
  return wranglerPath;
}

describe("production access checker", () => {
  it("fails when Wrangler reports unauthenticated", async () => {
    const wranglerPath = await createFakeWrangler(`
console.log("You are not authenticated. Please run wrangler login.");
process.exit(0);
`);
    const result = await runScript({ ...process.env, PRODUCTION_ACCESS_WRANGLER_BIN: wranglerPath });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Wrangler is not authenticated");
    expect(result.stderr).toContain("wrangler login");
  });

  it("passes when Wrangler reports an authenticated user", async () => {
    const wranglerPath = await createFakeWrangler(`
console.log("Logged in as deploy@example.test");
process.exit(0);
`);
    const result = await runScript({ ...process.env, PRODUCTION_ACCESS_WRANGLER_BIN: wranglerPath });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production access check passed");
  });
});

