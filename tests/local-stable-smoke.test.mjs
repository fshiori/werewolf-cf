import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-local-stable.mjs");
const busyServers = [];

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

async function reservePort(port) {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("busy");
  });
  busyServers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function createRunnerFixtures() {
  const scriptDir = await mkdtemp(join(tmpdir(), "werewolf-local-stable-smoke-"));
  const logPath = join(scriptDir, "calls.ndjson");
  const wranglerPath = join(scriptDir, "fake-wrangler.mjs");
  const smokeScriptBody = `import { appendFile } from "node:fs/promises";

const name = new URL(import.meta.url).pathname.split("/").at(-1);
await appendFile(process.env.CALL_LOG, JSON.stringify({ name, args: process.argv.slice(2), workerHost: process.env.WORKER_HOST }) + "\\n");
console.log(name + " ok");
`;
  const wranglerBody = `import { createServer } from "node:http";

const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
const server = createServer((request, response) => {
  if (request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});
server.listen(port, "127.0.0.1", () => console.log("fake wrangler ready " + port));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

  await Promise.all([
    writeFile(wranglerPath, wranglerBody),
    writeFile(join(scriptDir, "smoke-production-readonly.mjs"), smokeScriptBody),
    writeFile(join(scriptDir, "smoke-local-ui.mjs"), smokeScriptBody),
    writeFile(join(scriptDir, "smoke-production-write.mjs"), smokeScriptBody),
    writeFile(join(scriptDir, "smoke-game-loop.mjs"), smokeScriptBody)
  ]);

  return { scriptDir, logPath, wranglerPath };
}

async function readCalls(logPath) {
  const contents = await readFile(logPath, "utf8");
  return contents.trim().split("\n").map((line) => JSON.parse(line));
}

afterEach(async () => {
  await Promise.all(
    busyServers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("local stable smoke script", () => {
  it("rejects invalid ports", async () => {
    const result = await runScript(["--port=0"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid --port value");
  });

  it("fails when an explicit port is already in use", async () => {
    await reservePort(8787);
    const result = await runScript(["--port=8787"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Requested port 8787 is already in use");
  });

  it("falls back to the next open port and runs all smoke scripts in order", async () => {
    await reservePort(8787);
    const { scriptDir, logPath, wranglerPath } = await createRunnerFixtures();
    const env = {
      ...process.env,
      LOCAL_STABLE_SMOKE_SCRIPT_DIR: scriptDir,
      LOCAL_STABLE_SMOKE_WRANGLER_BIN: wranglerPath,
      CALL_LOG: logPath
    };
    const result = await runScript([], env);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Using local stable smoke port 8788");
    expect(result.stdout).toContain("Local stable smoke passed");

    const calls = await readCalls(logPath);
    expect(calls.map((call) => call.name)).toEqual([
      "smoke-production-readonly.mjs",
      "smoke-local-ui.mjs",
      "smoke-production-write.mjs",
      "smoke-game-loop.mjs"
    ]);
    expect(calls.every((call) => call.workerHost === "http://127.0.0.1:8788")).toBe(true);
    expect(calls[0].args).toEqual(["--label=Local", "http://127.0.0.1:8788"]);
    expect(calls[1].args).toEqual(["--label=Local", "http://127.0.0.1:8788"]);
    expect(calls[2].args).toEqual(["--label=Local", "http://127.0.0.1:8788", "--yes"]);
    expect(calls[3].args).toEqual(["--label=Local", "http://127.0.0.1:8788", "--yes"]);
  });
});

