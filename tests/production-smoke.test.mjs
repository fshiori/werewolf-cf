import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-production-readonly.mjs");
const servers = [];

function protocolMetadata() {
  return {
    websocket: {
      path: "/ws/room/:roomId",
      firstClientMessage: "join",
      channelVariants: {
        common_chat: {
          publicVoicePlayerId: "common_voice",
          publicVoiceNickname: "共有者的聲音"
        }
      }
    }
  };
}

function responseFor(path) {
  if (path === "/api/health") {
    return { contentType: "application/json", body: JSON.stringify({ ok: true }) };
  }
  if (path === "/api/version") {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        version: {
          name: "werewolf-cf",
          appVersion: "0.1.0",
          runtime: "Cloudflare Workers",
          language: "TypeScript",
          bindings: ["ROOM_DO", "DB", "ASSETS", "CONFIG"],
          capabilities: ["websocket_protocol"]
        }
      })
    };
  }
  if (path === "/api/protocol") {
    return { contentType: "application/json", body: JSON.stringify(protocolMetadata()) };
  }
  if (path === "/api/config") {
    return { contentType: "application/json", body: JSON.stringify({ config: { maintenanceMode: false } }) };
  }
  if (path === "/api/rooms") {
    return { contentType: "application/json", body: JSON.stringify({ rooms: [] }) };
  }
  if (path === "/") {
    return { contentType: "text/html", body: "<!doctype html><title>汝等是人是狼？</title>" };
  }
  if (path === "/rules") {
    return { contentType: "text/html", body: "<!doctype html><title>規則</title>" };
  }
  if (path === "/protocol") {
    return { contentType: "text/html", body: "<!doctype html><title>WebSocket 入口 common_voice</title>" };
  }
  if (path === "/version") {
    return { contentType: "text/html", body: "<!doctype html><title>版本資訊</title>" };
  }
  return { status: 404, contentType: "text/plain", body: "not found" };
}

async function startServer(overrides = {}) {
  const server = createServer((request, response) => {
    const path = request.url?.split("?")[0] ?? "/";
    const result = overrides[path] ?? responseFor(path);
    response.writeHead(result.status ?? 200, { "content-type": result.contentType });
    response.end(result.body);
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

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

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("production read-only smoke script", () => {
  it("passes against healthy read-only endpoints", async () => {
    const host = await startServer();
    const result = await runScript([host]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Production read-only smoke passed");
  });

  it("uses a custom smoke label when provided", async () => {
    const host = await startServer();
    const result = await runScript(["--label=Local", host]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Local smoke passed");
  });

  it("fails when required endpoint metadata is missing", async () => {
    const host = await startServer({
      "/api/version": {
        contentType: "application/json",
        body: JSON.stringify({ version: { bindings: ["ROOM_DO"], capabilities: [] } })
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/api/version");
  });

  it("fails when version metadata identifies the wrong app", async () => {
    const host = await startServer({
      "/api/version": {
        contentType: "application/json",
        body: JSON.stringify({
          version: {
            name: "other-worker",
            appVersion: "0.1.0",
            runtime: "Cloudflare Workers",
            language: "TypeScript",
            bindings: ["ROOM_DO", "DB", "ASSETS", "CONFIG"],
            capabilities: ["websocket_protocol"]
          }
        })
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/api/version");
    expect(result.stderr).toContain("werewolf-cf version metadata");
  });

  it("fails when protocol common voice metadata is missing", async () => {
    const host = await startServer({
      "/api/protocol": {
        contentType: "application/json",
        body: JSON.stringify({ websocket: { path: "/ws/room/:roomId", firstClientMessage: "join" } })
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/api/protocol");
    expect(result.stderr).toContain("common voice variant");
  });

  it("fails when an HTML page does not contain the expected page text", async () => {
    const host = await startServer({
      "/protocol": {
        contentType: "text/html",
        body: "<!doctype html><title>Wrong page</title>"
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/protocol");
    expect(result.stderr).toContain("WebSocket 入口");
  });

  it("fails when the protocol page omits common voice documentation", async () => {
    const host = await startServer({
      "/protocol": {
        contentType: "text/html",
        body: "<!doctype html><title>WebSocket 入口</title>"
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/protocol");
    expect(result.stderr).toContain("common_voice");
  });

  it("requires a Worker URL", async () => {
    const result = await runScript([], { ...process.env, WORKER_HOST: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set WORKER_HOST");
  });
});
