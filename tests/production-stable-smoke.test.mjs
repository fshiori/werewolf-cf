import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-production-stable.mjs");

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

async function createSmokeScriptDir() {
  const scriptDir = await mkdtemp(join(tmpdir(), "werewolf-production-stable-smoke-"));
  const logPath = join(scriptDir, "calls.ndjson");
  const scriptBody = `import { appendFile } from "node:fs/promises";

const name = new URL(import.meta.url).pathname.split("/").at(-1);
await appendFile(process.env.CALL_LOG, JSON.stringify({ name, args: process.argv.slice(2) }) + "\\n");
if (process.env.FAIL_ON === name) {
  console.error(name + " failed intentionally");
  process.exit(7);
}
console.log(name + " ok");
`;

  await Promise.all([
    writeFile(join(scriptDir, "smoke-production-readonly.mjs"), scriptBody),
    writeFile(join(scriptDir, "smoke-local-ui.mjs"), scriptBody),
    writeFile(join(scriptDir, "smoke-production-write.mjs"), scriptBody),
    writeFile(join(scriptDir, "smoke-game-loop.mjs"), scriptBody)
  ]);

  return { scriptDir, logPath };
}

async function readCalls(logPath) {
  const contents = await readFile(logPath, "utf8");
  return contents.trim().split("\n").map((line) => JSON.parse(line));
}

describe("production stable smoke script", () => {
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

  it("rejects non-HTTPS Worker URLs", async () => {
    const result = await runScript(["http://worker.example.test", "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must use https");
  });

  it("rejects local Worker URLs", async () => {
    const result = await runScript(["https://127.0.0.1:8787", "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not point at a local host");
  });

  it("runs read-only, UI, write, and game smoke scripts in order", async () => {
    const { scriptDir, logPath } = await createSmokeScriptDir();
    const env = {
      ...process.env,
      PRODUCTION_STABLE_SMOKE_SCRIPT_DIR: scriptDir,
      CALL_LOG: logPath
    };
    const result = await runScript(["--label=Staging", "https://worker.example.test", "--yes"], env);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Staging smoke passed");

    const calls = await readCalls(logPath);
    expect(calls.map((call) => call.name)).toEqual([
      "smoke-production-readonly.mjs",
      "smoke-local-ui.mjs",
      "smoke-production-write.mjs",
      "smoke-game-loop.mjs"
    ]);
    expect(calls[0].args).toEqual(["--label=Staging", "https://worker.example.test/"]);
    expect(calls[1].args).toEqual(["--label=Staging", "https://worker.example.test/"]);
    expect(calls[2].args).toEqual(["--label=Staging", "https://worker.example.test/", "--yes"]);
    expect(calls[3].args).toEqual(["--label=Staging", "https://worker.example.test/", "--yes"]);
  });

  it("fails when a child smoke script fails", async () => {
    const { scriptDir, logPath } = await createSmokeScriptDir();
    const env = {
      ...process.env,
      PRODUCTION_STABLE_SMOKE_SCRIPT_DIR: scriptDir,
      CALL_LOG: logPath,
      FAIL_ON: "smoke-production-write.mjs"
    };
    const result = await runScript(["https://worker.example.test", "--yes"], env);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("smoke-production-write.mjs failed intentionally");
    expect(result.stderr).toContain("Production stable smoke failed");

    const calls = await readCalls(logPath);
    expect(calls.map((call) => call.name)).toEqual([
      "smoke-production-readonly.mjs",
      "smoke-local-ui.mjs",
      "smoke-production-write.mjs"
    ]);
  });
});
