import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-visual-parity-prereqs.mjs");

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

async function createFakeBrowser(body) {
  const dir = await mkdtemp(join(tmpdir(), "werewolf-visual-prereq-"));
  const browserPath = join(dir, "browser.mjs");
  await writeFile(browserPath, `#!/usr/bin/env node\n${body}`);
  await chmod(browserPath, 0o755);
  return browserPath;
}

describe("visual parity prerequisite checker", () => {
  it("fails with an actionable message when no browser candidate exists", async () => {
    const result = await runScript({
      ...process.env,
      VISUAL_PARITY_BROWSER_BIN: "/definitely/missing/browser"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no browser binary is available");
    expect(result.stderr).toContain("VISUAL_PARITY_BROWSER_BIN");
    expect(result.stderr).toContain("/definitely/missing/browser");
  });

  it("passes when a configured browser executable reports a version", async () => {
    const browserPath = await createFakeBrowser(`
if (process.argv.includes("--version")) {
  console.log("Chromium 126.0.0.0");
  process.exit(0);
}
process.exit(1);
`);
    const result = await runScript({
      ...process.env,
      VISUAL_PARITY_BROWSER_BIN: browserPath
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Visual parity browser available");
    expect(result.stdout).toContain("Chromium 126.0.0.0");
  });
});
