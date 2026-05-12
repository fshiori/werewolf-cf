import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function packageScripts() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  return packageJson.scripts;
}

describe("package release scripts", () => {
  it("keeps the local stable gate wired to deploy checks and runtime smoke", async () => {
    const scripts = await packageScripts();

    expect(scripts["check:stable"]).toBe("npm run check:deploy && npm run smoke:local:stable");
  });

  it("keeps the production-ready gate wired to local stable checks and Cloudflare access", async () => {
    const scripts = await packageScripts();

    expect(scripts["check:production-ready"]).toBe("npm run check:stable && npm run check:production-access");
  });

  it("blocks deploys through the production-ready predeploy gate", async () => {
    const scripts = await packageScripts();

    expect(scripts.predeploy).toBe("npm run check:production-ready");
    expect(scripts.deploy).toBe("wrangler deploy --config wrangler.production.toml");
  });

  it("keeps the production stable smoke suite available after deploy", async () => {
    const scripts = await packageScripts();

    expect(scripts["smoke:production:stable"]).toBe("node scripts/smoke-production-stable.mjs");
  });

  it("keeps production D1 migration pointed at the production config", async () => {
    const scripts = await packageScripts();

    expect(scripts["migrate:production"]).toBe("wrangler d1 migrations apply werewolf-cf-db --remote --config wrangler.production.toml");
  });
});
