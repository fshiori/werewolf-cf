#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const labelArg = args.find((arg) => arg.startsWith("--label="));
const smokeLabel = labelArg?.slice("--label=".length) || "Production stable";
const confirmed = args.includes("--yes") || process.env.PRODUCTION_STABLE_SMOKE_CONFIRM === "true";
const host = args.find((arg) => arg !== "--yes" && !arg.startsWith("--label=")) ?? process.env.WORKER_HOST;

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

if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
  console.error(`Worker URL must use http or https: ${host}`);
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
  await runCommand(process.execPath, [script, `--label=${smokeLabel}`, baseUrl.toString(), ...extraArgs]);
}

try {
  await runSmoke("Read-only smoke", "scripts/smoke-production-readonly.mjs");
  await runSmoke("Write smoke", "scripts/smoke-production-write.mjs", ["--yes"]);
  await runSmoke("Game-loop smoke", "scripts/smoke-game-loop.mjs", ["--yes"]);
  console.log(`\n${smokeLabel} smoke passed`);
} catch (error) {
  console.error(`\n${smokeLabel} smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

