#!/usr/bin/env node

const args = process.argv.slice(2);
const labelArg = args.find((arg) => arg.startsWith("--label="));
const smokeLabel = labelArg?.slice("--label=".length) || "Local UI";
const host = args.find((arg) => !arg.startsWith("--label=")) ?? process.env.WORKER_HOST ?? "http://127.0.0.1:8787";

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

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

async function readJson(response, path) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${path}: invalid JSON response`);
  }
}

async function expectJson(path, init, validate, expected) {
  const response = await fetch(urlFor(path), {
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  const value = await readJson(response, path);
  if (!validate(value)) {
    throw new Error(`${path}: expected ${expected}`);
  }
  console.log(`ok ${path}`);
  return value;
}

async function expectHtml(path, expectedTexts, forbiddenTexts = []) {
  const response = await fetch(urlFor(path), { headers: { accept: "text/html" } });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${path}: empty HTML response`);
  }
  for (const expectedText of expectedTexts) {
    if (!text.includes(expectedText)) {
      throw new Error(`${path}: expected HTML text ${expectedText}`);
    }
  }
  for (const forbiddenText of forbiddenTexts) {
    if (text.includes(forbiddenText)) {
      throw new Error(`${path}: should not expose ${forbiddenText}`);
    }
  }
  console.log(`ok ${path}`);
  return text;
}

const playerId = `player_ui_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

try {
  await expectHtml("/", ["汝等是人是狼？", "建立村子", "戰績排行榜"], ["房間 JSON", "排行榜 JSON"]);
  await expectHtml("/leaderboard", ["戰績排行榜"]);
  await expectHtml("/status", ["伺服器狀態", "Binding 檢查"]);
  await expectHtml("/assets/room-client.js", ["new WebSocket", "data-room-id"]);

  const createResult = await expectJson(
    "/api/rooms",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "UI Smoke",
        comment: "Rendered page smoke",
        maxPlayers: 8,
        playerId,
        nickname: "UI Smoke",
        options: { realTime: true, dayMinutes: 3, nightMinutes: 1.5 }
      })
    },
    (value) => typeof value?.roomId === "string" && value.roomId.startsWith("room_"),
    "roomId"
  );

  const roomId = createResult.roomId;
  await expectHtml(`/room/${roomId}`, [`[${roomId}]`, "進入房間", "玩家列表", "能力發動 / 投票", "對局紀錄", "事件履歷", "完整紀錄", "/assets/room-client.js"], ["房間JSON", "對局JSON", "事件JSON", "new WebSocket"]);
  await expectHtml(`/room/${roomId}/records`, ["村子對局紀錄", roomId]);
  await expectHtml(`/room/${roomId}/events`, ["村子事件履歷", roomId, "room_created"]);
  await expectHtml(`/room/${roomId}/log`, ["村子完整紀錄", roomId, "room_created"]);

  console.log(`${smokeLabel} smoke passed`);
  process.exit(0);
} catch (error) {
  console.error(`${smokeLabel} smoke failed:`);
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
