import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-production-write.mjs");
const servers = [];
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function websocketAccept(key) {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function textFrame(value) {
  const payload = Buffer.from(value);
  if (payload.length >= 126) {
    throw new Error("Test websocket frame payload is too large");
  }
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function startServer(overrides = {}) {
  const roomId = overrides.roomId ?? "room_smoke";
  const requests = overrides.requests ?? [];
  const websocketMessages = overrides.websocketMessages ?? [
    { type: "joined", roomId, playerId: "player_smoke_host" },
    { type: "presence", members: [] },
    { type: "game_state", phase: "lobby", day: 0 }
  ];
  let avatarDeleted = false;
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    const path = request.url?.split("?")[0] ?? "/";
    requests.push({ method: request.method, path });
    if (overrides[path]) {
      const result = await overrides[path](request);
      response.writeHead(result.status ?? 200, { "content-type": result.contentType ?? "application/json" });
      response.end(result.body);
      return;
    }

    if (request.method === "POST" && path === "/api/rooms") {
      await readBody(request);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ roomId }));
      return;
    }

    if (request.method === "GET" && path === `/api/rooms/${roomId}`) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ room: { id: roomId } }));
      return;
    }

    if (request.method === "POST" && path === "/api/assets/avatar") {
      await readBody(request);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ key: "avatars/player_smoke_avatar" }));
      return;
    }

    if (request.method === "GET" && path.startsWith("/assets/avatar/")) {
      if (avatarDeleted) {
        response.writeHead(404, { "content-type": "text/plain" });
        response.end("not found");
        return;
      }
      response.writeHead(200, { "content-type": "image/png" });
      response.end(pngBytes);
      return;
    }

    if (request.method === "DELETE" && path === "/api/assets/avatar") {
      await readBody(request);
      avatarDeleted = true;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ removed: true }));
      return;
    }

    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });

  server.on("upgrade", (request, socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
    const path = request.url?.split("?")[0] ?? "/";
    if (path !== `/ws/room/${roomId}` || !request.headers["sec-websocket-key"]) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${websocketAccept(String(request.headers["sec-websocket-key"]))}`,
        "\r\n"
      ].join("\r\n")
    );

    socket.once("data", () => {
      for (const message of websocketMessages) {
        socket.write(textFrame(JSON.stringify(message)));
      }
      setTimeout(() => {
        socket.destroy();
      }, 25);
    });
  });

  servers.push({ server, sockets });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function runScript(args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { env: { ...env, WRITE_SMOKE_ID: "smoke" } });
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
      ({ server, sockets }) =>
        new Promise((resolve, reject) => {
          for (const socket of sockets) {
            socket.destroy();
          }
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("production write smoke script", () => {
  it("requires explicit write confirmation", async () => {
    const host = await startServer();
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pass --yes");
  });

  it("passes against healthy write endpoints and websocket join", async () => {
    const host = await startServer({ roomId: "room_smoke" });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok POST /api/rooms room_smoke");
    expect(result.stdout).toContain("ok WebSocket join");
    expect(result.stdout).toContain("ok DELETE /api/assets/avatar");
    expect(result.stdout).toContain("ok GET /assets/avatar/:playerId after delete");
    expect(result.stdout).toContain("Production write smoke passed");
  });

  it("uses custom smoke labels without treating label arguments as the host", async () => {
    const host = await startServer({ roomId: "room_smoke" });
    const result = await runScript(["--label=Local", host, "--yes"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok POST /api/rooms room_smoke");
    expect(result.stdout).toContain("Local smoke passed");
    expect(result.stdout).not.toContain("Production write smoke passed");
  });

  it("fails when avatar remains readable after delete", async () => {
    const host = await startServer({
      "/api/assets/avatar": async (request) => {
        await readBody(request);
        if (request.method === "POST") {
          return { body: JSON.stringify({ key: "avatars/player_smoke_avatar" }) };
        }
        return { body: JSON.stringify({ removed: true }) };
      }
    });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("after delete");
    expect(result.stderr).toContain("expected HTTP 404");
  });

  it("fails when websocket joined payload does not match the smoke room", async () => {
    const host = await startServer({
      websocketMessages: [
        { type: "joined", roomId: "room_other", playerId: "player_smoke_host" },
        { type: "presence", members: [] },
        { type: "game_state", phase: "lobby", day: 0 }
      ]
    });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("joined payload did not match");
  });

  it("fails when websocket game state payload is incomplete", async () => {
    const host = await startServer({
      websocketMessages: [
        { type: "joined", roomId: "room_smoke", playerId: "player_smoke_host" },
        { type: "presence", members: [] },
        { type: "game_state", phase: "lobby" }
      ]
    });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("game_state payload must include phase and day");
  });

  it("fails when room creation does not return a room id", async () => {
    const host = await startServer({
      "/api/rooms": async () => ({ body: JSON.stringify({}) })
    });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("POST /api/rooms");
    expect(result.stderr).toContain("expected roomId");
  });

  it("fails when avatar bytes do not round trip", async () => {
    const requests = [];
    const host = await startServer({
      requests,
      "/assets/avatar/player_smoke_avatar": async () => ({ contentType: "image/png", body: Buffer.from("wrong") })
    });
    const result = await runScript([host, "--yes"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("downloaded avatar did not match uploaded bytes");
    expect(requests).toContainEqual({ method: "DELETE", path: "/api/assets/avatar" });
    expect(result.stdout).toContain("ok cleanup DELETE /api/assets/avatar");
  });
});
