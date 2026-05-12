#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const wranglerBin = process.env.PRODUCTION_ACCESS_WRANGLER_BIN ?? fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url));

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", (error) => {
      resolve({ status: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status, signal) => {
      resolve({ status: status ?? 1, signal, stdout, stderr });
    });
  });
}

const configResult = await runCommand(process.execPath, [
  "scripts/check-wrangler-config.mjs",
  "--production",
  "--config",
  "wrangler.production.toml"
]);
if (configResult.status !== 0) {
  process.exit(configResult.status);
}

const whoami = await runCommand(process.execPath, [wranglerBin, "whoami"], { capture: true });
if (whoami.status !== 0 || /not authenticated/i.test(`${whoami.stdout}\n${whoami.stderr}`)) {
  process.stderr.write(
    "Production access check failed: Wrangler is not authenticated. Run `wrangler login` or export `CLOUDFLARE_API_TOKEN` before remote D1 migration, deploy, or production smoke.\n"
  );
  if (whoami.stdout.trim()) {
    process.stderr.write(`${whoami.stdout.trim()}\n`);
  }
  if (whoami.stderr.trim()) {
    process.stderr.write(`${whoami.stderr.trim()}\n`);
  }
  process.exit(1);
}

process.stdout.write("Production access check passed\n");

