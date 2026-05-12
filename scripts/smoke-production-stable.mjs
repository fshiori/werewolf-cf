#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const labelArg = args.find((arg) => arg.startsWith("--label="));
const smokeLabel = labelArg?.slice("--label=".length) || "Production stable";
const confirmed = args.includes("--yes") || process.env.PRODUCTION_STABLE_SMOKE_CONFIRM === "true";
const host = args.find((arg) => arg !== "--yes" && !arg.startsWith("--label=")) ?? process.env.WORKER_HOST;
const scriptDir = process.env.PRODUCTION_STABLE_SMOKE_SCRIPT_DIR ?? "scripts";

if (!confirmed) {
  console.error("Production stable smoke creates temporary room/player/game-record data. Pass --yes or set PRODUCTION_STABLE_SMOKE_CONFIRM=true to continue.");
  process.exit(1);
}

if (!host) {
  console.error("Set WORKER_HOST or pass the Worker URL as the first argument");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(host);
} catch {
  console.error(`Invalid Worker URL: ${host}`);
  process.exit(1);
}

if (baseUrl.protocol !== "https:") {
  console.error(`Production stable smoke Worker URL must use https: ${host}`);
  process.exit(1);
}

const blockedProductionHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
if (blockedProductionHosts.has(baseUrl.hostname)) {
  console.error(`Production stable smoke Worker URL must not point at a local host: ${host}`);
  process.exit(1);
}

function runCommand(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { env: process.env, stdio: "inherit" });
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

async function runSmoke(name, script, extraArgs = []) {
  console.log(`\n== ${name} ==`);
  await runCommand(process.execPath, [`${scriptDir}/${script}`, `--label=${smokeLabel}`, baseUrl.toString(), ...extraArgs]);
}

try {
  await runSmoke("Read-only smoke", "smoke-production-readonly.mjs");
  await runSmoke("Rendered UI smoke", "smoke-local-ui.mjs");
  await runSmoke("Write smoke", "smoke-production-write.mjs", ["--yes"]);
  await runSmoke("Game-loop smoke", "smoke-game-loop.mjs", ["--yes"]);
  console.log(`\n${smokeLabel} smoke passed`);
} catch (error) {
  console.error(`\n${smokeLabel} smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
