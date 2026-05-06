import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-local-ui.mjs");
const servers = [];

function responseFor(path, method = "GET") {
  if (path === "/" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>汝等是人是狼？ 建立村子 戰績排行榜</title>" };
  }
  if (path === "/leaderboard" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>戰績排行榜</title>" };
  }
  if (path === "/list" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>聯合遊戲列表 本伺服器</title>" };
  }
  if (path === "/icons" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>頭像一覽 /assets/reference/user_icon/001.gif</title>' };
  }
  if (path === "/trips" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>Trip查詢 Trip公開資料</title>" };
  }
  if (path === "/status" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>伺服器狀態 Binding 檢查</title>" };
  }
  if (path === "/assets/room-client.js" && method === "GET") {
    return { contentType: "text/javascript", body: 'const roomShell = document.querySelector("[data-room-id]"); new WebSocket("ws://example.test");' };
  }
  if (path === "/api/rooms" && method === "POST") {
    return { contentType: "application/json", body: JSON.stringify({ roomId: "room_ui_smoke" }) };
  }
  if (path === "/room/room_ui_smoke" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>[room_ui_smoke] 進入房間 玩家列表 能力發動 / 投票 對局紀錄 事件履歷 完整紀錄 /assets/room-client.js</title>' };
  }
  if (path === "/room/room_ui_smoke/records" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子對局紀錄 room_ui_smoke</title>" };
  }
  if (path === "/room/room_ui_smoke/events" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子事件履歷 room_ui_smoke room_created</title>" };
  }
  if (path === "/room/room_ui_smoke/log" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子完整紀錄 room_ui_smoke room_created</title>" };
  }
  return { status: 404, contentType: "text/plain", body: "not found" };
}

async function startServer(overrides = {}) {
  const server = createServer((request, response) => {
    const path = request.url?.split("?")[0] ?? "/";
    const key = `${request.method ?? "GET"} ${path}`;
    const result = overrides[key] ?? overrides[path] ?? responseFor(path, request.method);
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

describe("local UI smoke script", () => {
  it("passes against rendered UI pages", async () => {
    const host = await startServer();
    const result = await runScript(["--label=Test UI", host]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok /room/room_ui_smoke");
    expect(result.stdout).toContain("Test UI smoke passed");
  });

  it("fails when room page exposes old JSON links", async () => {
    const host = await startServer({
      "GET /room/room_ui_smoke": {
        contentType: "text/html",
        body: '<!doctype html><title>[room_ui_smoke] 進入房間 玩家列表 能力發動 / 投票 對局紀錄 事件履歷 完整紀錄 /assets/room-client.js 房間JSON</title>'
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("房間JSON");
  });
});
