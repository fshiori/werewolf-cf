#!/usr/bin/env node

import { spawn } from "node:child_process";

const defaultBrowserCandidates = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "chrome"
];

function browserCandidates(env = process.env) {
  const configured = env.VISUAL_PARITY_BROWSER_BIN?.trim();
  if (configured) {
    return [configured];
  }

  const candidateList = env.VISUAL_PARITY_BROWSER_CANDIDATES?.trim();
  if (candidateList) {
    return candidateList.split(",").map((candidate) => candidate.trim()).filter(Boolean);
  }

  return defaultBrowserCandidates;
}

function checkVersion(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ command, ok: false, output: error.message });
    });
    child.on("close", (status) => {
      resolve({
        command,
        ok: status === 0,
        output: `${stdout}${stderr}`.trim()
      });
    });
  });
}

const checks = await Promise.all(browserCandidates().map(checkVersion));
const available = checks.find((check) => check.ok);

if (!available) {
  process.stderr.write(
    "Visual parity prerequisite check failed: no browser binary is available for screenshot capture.\n"
  );
  process.stderr.write(
    "Set VISUAL_PARITY_BROWSER_BIN to a Chromium/Chrome executable, or install one of: chromium, chromium-browser, google-chrome, chrome.\n"
  );
  process.stderr.write("Checked candidates:\n");
  for (const check of checks) {
    process.stderr.write(`- ${check.command}: ${check.output || "not available"}\n`);
  }
  process.exit(1);
}

process.stdout.write(`Visual parity browser available: ${available.command}`);
if (available.output) {
  process.stdout.write(` (${available.output})`);
}
process.stdout.write("\n");
