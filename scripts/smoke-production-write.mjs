#!/usr/bin/env node

const args = process.argv.slice(2);
const confirmed = args.includes("--yes") || process.env.WRITE_SMOKE_CONFIRM === "true";
const host = args.find((arg) => arg !== "--yes") ?? process.env.WORKER_HOST;

if (!confirmed) {
  console.error("Write smoke creates temporary production data. Pass --yes or set WRITE_SMOKE_CONFIRM=true to continue.");
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

const smokeId = process.env.WRITE_SMOKE_ID ?? `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const hostPlayerId = `player_${smokeId}_host`;
const avatarPlayerId = `player_${smokeId}_avatar`;
const failures = [];
let avatarUploaded = false;

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

function websocketUrlFor(path) {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: invalid JSON response`);
  }
}

async function expectJson(response, label) {
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${await response.text()}`);
  }
  return readJson(response, label);
}

async function createSmokeRoom() {
  const response = await fetch(urlFor("/api/rooms"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `Smoke ${smokeId}`,
      comment: "deployment write smoke",
      maxPlayers: 8,
      playerId: hostPlayerId,
      nickname: "SmokeHost",
      options: {
        realTime: true,
        dayMinutes: 1,
        nightMinutes: 1
      }
    })
  });
  const body = await expectJson(response, "POST /api/rooms");
  if (typeof body.roomId !== "string" || !body.roomId.startsWith("room_")) {
    throw new Error("POST /api/rooms: expected roomId");
  }
  console.log(`ok POST /api/rooms ${body.roomId}`);
  return body.roomId;
}

async function verifySmokeRoom(roomId) {
  const response = await fetch(urlFor(`/api/rooms/${roomId}`), { headers: { accept: "application/json" } });
  const body = await expectJson(response, "GET /api/rooms/:roomId");
  if (body?.room?.id !== roomId) {
    throw new Error("GET /api/rooms/:roomId: expected smoke room summary");
  }
  console.log("ok GET /api/rooms/:roomId");
}

async function verifyWebSocket(roomId) {
  if (typeof WebSocket !== "function") {
    throw new Error("WebSocket global is unavailable in this Node.js runtime");
  }

  const requiredTypes = new Set(["joined", "presence", "game_state"]);
  const seenTypes = new Set();
  const ws = new WebSocket(websocketUrlFor(`/ws/room/${roomId}`));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // Best-effort cleanup after timeout.
      }
      reject(new Error(`WebSocket join smoke timed out; saw ${Array.from(seenTypes).join(", ") || "no messages"}`));
    }, 5000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "join", playerId: hostPlayerId, nickname: "SmokeHost" }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (typeof message.type === "string") {
          seenTypes.add(message.type);
        }
        if ([...requiredTypes].every((type) => seenTypes.has(type))) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (error) {
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {
          // Best-effort cleanup after parse errors.
        }
        reject(error);
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    });
  });

  console.log("ok WebSocket join");
}

async function verifyAvatarRoundTrip() {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.set("playerId", avatarPlayerId);
  form.set("avatar", new File([pngBytes], "avatar.png", { type: "image/png" }));

  const upload = await fetch(urlFor("/api/assets/avatar"), { method: "POST", body: form });
  const uploadBody = await expectJson(upload, "POST /api/assets/avatar");
  if (uploadBody?.key !== `avatars/${avatarPlayerId}`) {
    throw new Error("POST /api/assets/avatar: expected avatar key");
  }
  avatarUploaded = true;
  console.log("ok POST /api/assets/avatar");

  const download = await fetch(urlFor(`/assets/avatar/${avatarPlayerId}`));
  if (!download.ok) {
    throw new Error(`GET /assets/avatar/:playerId: HTTP ${download.status}`);
  }
  const downloaded = new Uint8Array(await download.arrayBuffer());
  if (downloaded.length !== pngBytes.length || downloaded.some((byte, index) => byte !== pngBytes[index])) {
    throw new Error("GET /assets/avatar/:playerId: downloaded avatar did not match uploaded bytes");
  }
  console.log("ok GET /assets/avatar/:playerId");

  await removeSmokeAvatar("DELETE /api/assets/avatar");
}

async function removeSmokeAvatar(label) {
  const remove = await fetch(urlFor("/api/assets/avatar"), {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: avatarPlayerId })
  });
  const removeBody = await expectJson(remove, label);
  if (removeBody?.removed !== true) {
    throw new Error(`${label}: expected removed true`);
  }
  avatarUploaded = false;
  console.log(`ok ${label}`);
}

try {
  const roomId = await createSmokeRoom();
  await verifySmokeRoom(roomId);
  await verifyWebSocket(roomId);
  await verifyAvatarRoundTrip();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (avatarUploaded) {
  try {
    await removeSmokeAvatar("cleanup DELETE /api/assets/avatar");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error("Production write smoke failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Production write smoke passed");
process.exit(0);
