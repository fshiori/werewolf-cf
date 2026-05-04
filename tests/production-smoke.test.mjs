import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-production-readonly.mjs");
const servers = [];

function responseFor(path) {
  if (path === "/api/health") {
    return { contentType: "application/json", body: JSON.stringify({ ok: true }) };
  }
  if (path === "/api/version") {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        version: {
          bindings: ["ROOM_DO", "DB", "ASSETS", "CONFIG"],
          capabilities: ["websocket_protocol"]
        }
      })
    };
  }
  if (path === "/api/protocol") {
    return { contentType: "application/json", body: JSON.stringify({ path: "/ws/room/:roomId", firstClientMessage: "join" }) };
  }
  if (path === "/api/config") {
    return { contentType: "application/json", body: JSON.stringify({ maintenanceMode: false }) };
  }
  if (path === "/api/rooms") {
    return { contentType: "application/json", body: JSON.stringify({ rooms: [] }) };
  }
  if (["/", "/rules", "/protocol", "/version"].includes(path)) {
    return { contentType: "text/html", body: "<!doctype html><title>Werewolf</title>" };
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

  it("requires a Worker URL", async () => {
    const result = await runScript([], { ...process.env, WORKER_HOST: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Set WORKER_HOST");
  });
});
