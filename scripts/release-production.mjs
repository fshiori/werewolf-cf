#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes") || process.env.PRODUCTION_RELEASE_CONFIRM === "true";
const host = args.find((arg) => arg !== "--yes" && !arg.startsWith("--label=")) ?? process.env.WORKER_HOST;
const npmBin = process.env.PRODUCTION_RELEASE_NPM_BIN ?? "npm";

if (!confirmed) {
  console.error("Production release runs remote migration, R2 uploads, deploy, and write smoke. Pass --yes or set PRODUCTION_RELEASE_CONFIRM=true to continue.");
  process.exit(1);
}

if (!host) {
  console.error("Set WORKER_HOST or pass the Worker URL as the first argument before starting the production release.");
  process.exit(1);
}

let workerUrl;
try {
  workerUrl = new URL(host);
} catch {
  console.error(`Invalid Worker URL: ${host}`);
  process.exit(1);
}

if (workerUrl.protocol !== "https:") {
  console.error(`Production Worker URL must use https: ${host}`);
  process.exit(1);
}

const blockedProductionHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
if (blockedProductionHosts.has(workerUrl.hostname)) {
  console.error(`Production Worker URL must not point at a local host: ${host}`);
  process.exit(1);
}

function runNpmScript(script, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const commandArgs = ["run", script, ...extraArgs];
    const child = spawn(npmBin, commandArgs, {
      env: { ...process.env, WORKER_HOST: workerUrl.toString() },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      if (status === 0) {
        resolve();
        return;
      }
      reject(new Error(`${npmBin} ${commandArgs.join(" ")} failed with ${signal ?? `exit ${status}`}`));
    });
  });
}

const steps = [
  ["Production-ready gate", "check:production-ready"],
  ["Remote D1 migration", "migrate:production"],
  ["Remote D1 schema check", "check:d1-schema:remote"],
  ["Reference asset upload", "assets:reference:upload"],
  ["Worker deploy", "deploy:production:direct"],
  ["Production stable smoke", "smoke:production:stable", ["--", workerUrl.toString(), "--yes"]]
];

try {
  for (const [label, script, extraArgs = []] of steps) {
    console.log(`\n== ${label} ==`);
    await runNpmScript(script, extraArgs);
  }
  console.log("\nProduction release passed");
} catch (error) {
  console.error(`\nProduction release failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
