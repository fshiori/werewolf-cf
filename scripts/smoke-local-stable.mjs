#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith("--port="));
const explicitPortValue = portArg?.slice("--port=".length) ?? process.env.LOCAL_STABLE_SMOKE_PORT;
const defaultPort = 8787;
let port = Number(explicitPortValue ?? defaultPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid --port value: ${explicitPortValue ?? defaultPort}`);
  process.exit(1);
}

let server;
let host;
let smokeEnv;

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit"
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      if (status === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} failed with ${signal ?? `exit ${status}`}`));
    });
  });
}

function isPortAvailable(candidatePort) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => {
      resolve(false);
    });
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(candidatePort, "127.0.0.1");
  });
}

async function selectPort() {
  if (explicitPortValue) {
    if (!(await isPortAvailable(port))) {
      throw new Error(`Requested port ${port} is already in use`);
    }
    return;
  }

  for (let candidate = defaultPort; candidate < defaultPort + 100; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      port = candidate;
      return;
    }
  }

  throw new Error(`No available local port found from ${defaultPort} to ${defaultPort + 99}`);
}

function startServer() {
  const wranglerBin = fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url));
  server = spawn(process.execPath, [wranglerBin, "dev", "--local", "--port", String(port)], {
    env: process.env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
  server.on("exit", (status, signal) => {
    if (status !== 0 && signal !== "SIGTERM") {
      console.error(`wrangler dev exited unexpectedly with ${signal ?? `exit ${status}`}`);
    }
  });
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${host}/api/health`, { headers: { accept: "application/json" } });
      if (response.ok) {
        const body = await response.json();
        if (body?.ok === true) {
          console.log(`ok local Worker ready at ${host}`);
          return;
        }
        lastError = "/api/health did not return ok: true";
      } else {
        lastError = `/api/health HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for local Worker at ${host}: ${lastError}`);
}

async function stopServer() {
  if (!server || server.killed) {
    return;
  }
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (process.platform === "win32") {
        server.kill("SIGKILL");
      } else {
        try {
          process.kill(-server.pid, "SIGKILL");
        } catch {
          server.kill("SIGKILL");
        }
      }
      resolve();
    }, 5000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    if (process.platform === "win32") {
      server.kill("SIGTERM");
    } else {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  });
}

async function runSmoke(name, script, extraArgs = []) {
  console.log(`\n== ${name} ==`);
  await runCommand(process.execPath, [script, "--label=Local", host, ...extraArgs], { env: smokeEnv });
}

try {
  await selectPort();
  host = `http://127.0.0.1:${port}`;
  smokeEnv = { ...process.env, WORKER_HOST: host };
  console.log(`Using local stable smoke port ${port}`);
  startServer();
  await waitForHealth();
  await runSmoke("Read-only smoke", "scripts/smoke-production-readonly.mjs");
  await runSmoke("Rendered UI smoke", "scripts/smoke-local-ui.mjs");
  await runSmoke("Write smoke", "scripts/smoke-production-write.mjs", ["--yes"]);
  await runSmoke("Game-loop smoke", "scripts/smoke-game-loop.mjs", ["--yes"]);
  console.log("\nLocal stable smoke passed");
} catch (error) {
  console.error(`\nLocal stable smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopServer();
}
