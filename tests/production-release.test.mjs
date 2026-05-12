import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/release-production.mjs");

function runScript(args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { env });
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

async function createFakeNpm() {
  const dir = await mkdtemp(join(tmpdir(), "werewolf-production-release-"));
  const logPath = join(dir, "calls.ndjson");
  const npmPath = join(dir, "npm.mjs");
  await writeFile(npmPath, `#!/usr/bin/env node
import { appendFile } from "node:fs/promises";

const script = process.argv[3] ?? "";
await appendFile(process.env.CALL_LOG, JSON.stringify({
  args: process.argv.slice(2),
  workerHost: process.env.WORKER_HOST
}) + "\\n");

if (process.env.FAIL_SCRIPT === script) {
  console.error(script + " failed intentionally");
  process.exit(9);
}

console.log(script + " ok");
`);
  await chmod(npmPath, 0o755);
  return { npmPath, logPath };
}

async function readCalls(logPath) {
  const contents = await readFile(logPath, "utf8");
  return contents.trim().split("\n").map((line) => JSON.parse(line));
}

describe("production release script", () => {
  it("requires explicit confirmation before remote writes", async () => {
    const result = await runScript(["https://worker.example.test"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pass --yes");
    expect(result.stderr).toContain("remote migration");
  });

  it("requires a Worker URL before starting release steps", async () => {
    const result = await runScript(["--yes"], { ...process.env, WORKER_HOST: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set WORKER_HOST");
  });

  it("rejects non-HTTPS production Worker URLs", async () => {
    const result = await runScript(["http://worker.example.test", "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must use https");
  });

  it("rejects local production Worker URLs", async () => {
    const result = await runScript(["https://127.0.0.1:8787", "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not point at a local host");
  });

  it("runs the production release steps in order", async () => {
    const { npmPath, logPath } = await createFakeNpm();
    const result = await runScript(["https://worker.example.test", "--yes"], {
      ...process.env,
      PRODUCTION_RELEASE_NPM_BIN: npmPath,
      CALL_LOG: logPath
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production release passed");

    const calls = await readCalls(logPath);
    expect(calls.map((call) => call.args)).toEqual([
      ["run", "check:production-ready"],
      ["run", "migrate:production"],
      ["run", "check:d1-schema:remote"],
      ["run", "assets:reference:upload"],
      ["run", "deploy:production:direct"],
      ["run", "smoke:production:stable", "--", "https://worker.example.test/", "--yes"]
    ]);
    expect(calls.every((call) => call.workerHost === "https://worker.example.test/")).toBe(true);
  });

  it("stops on the first failed release step", async () => {
    const { npmPath, logPath } = await createFakeNpm();
    const result = await runScript(["https://worker.example.test", "--yes"], {
      ...process.env,
      PRODUCTION_RELEASE_NPM_BIN: npmPath,
      CALL_LOG: logPath,
      FAIL_SCRIPT: "assets:reference:upload"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("assets:reference:upload failed intentionally");
    expect(result.stderr).toContain("Production release failed");

    const calls = await readCalls(logPath);
    expect(calls.map((call) => call.args[1])).toEqual([
      "check:production-ready",
      "migrate:production",
      "check:d1-schema:remote",
      "assets:reference:upload"
    ]);
  });
});
