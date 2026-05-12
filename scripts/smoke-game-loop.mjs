#!/usr/bin/env node

const args = process.argv.slice(2);
const labelArg = args.find((arg) => arg.startsWith("--label="));
const smokeLabel = labelArg?.slice("--label=".length) || "Game loop";
const confirmed = args.includes("--yes") || process.env.GAME_LOOP_SMOKE_CONFIRM === "true";
const host = args.find((arg) => arg !== "--yes" && !arg.startsWith("--label=")) ?? process.env.WORKER_HOST;

if (!confirmed) {
  console.error("Game-loop smoke creates temporary room/player/game-record data. Pass --yes or set GAME_LOOP_SMOKE_CONFIRM=true to continue.");
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

if (typeof WebSocket !== "function") {
  console.error("WebSocket global is unavailable in this Node.js runtime");
  process.exit(1);
}

const smokeId = process.env.GAME_LOOP_SMOKE_ID ?? `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const players = Array.from({ length: 8 }, (_, index) => ({
  playerId: `player_${smokeId}_${index + 1}`,
  nickname: `Loop${index + 1}`
}));
const failures = [];

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

function websocketUrlFor(path) {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function readJson(response, label) {
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${await response.text()}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: invalid JSON response`);
  }
}

async function createRoom() {
  const response = await fetch(urlFor("/api/rooms"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `Game Loop ${smokeId}`,
      comment: "automated game-loop smoke",
      maxPlayers: 8,
      playerId: players[0].playerId,
      nickname: players[0].nickname,
      options: {
        realTime: true,
        dayMinutes: 10,
        nightMinutes: 10,
        selfVote: true,
        voteStatus: true,
        openVote: true
      }
    })
  });
  const body = await readJson(response, "POST /api/rooms");
  if (typeof body.roomId !== "string" || !body.roomId.startsWith("room_")) {
    throw new Error("POST /api/rooms: expected roomId");
  }
  console.log(`ok POST /api/rooms ${body.roomId}`);
  return body.roomId;
}

class SmokeClient {
  constructor(roomId, player) {
    this.roomId = roomId;
    this.player = player;
    this.messages = [];
    this.waiters = [];
    this.latestGameState = undefined;
    this.closed = false;
    this.ws = new WebSocket(websocketUrlFor(`/ws/room/${roomId}`));
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${this.player.playerId}: websocket open timed out`)), 5000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error(`${this.player.playerId}: websocket connection failed`));
      }, { once: true });
    });

    this.ws.addEventListener("message", (event) => this.handleMessage(event));
    this.ws.addEventListener("close", () => {
      this.closed = true;
    });
    this.send({ type: "join", playerId: this.player.playerId, nickname: this.player.nickname });
    await this.waitFor((message) => message.type === "joined" && message.playerId === this.player.playerId, "joined");
    await this.waitFor((message) => message.type === "game_state" && message.phase === "lobby", "lobby game_state");
  }

  handleMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.type === "game_state") {
      this.latestGameState = message;
    }
    this.messages.push(message);
    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(message)) {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        clearTimeout(waiter.timeout);
        waiter.resolve(message);
      }
    }
  }

  waitFor(predicate, label, timeoutMs = 8000) {
    const existing = this.messages.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.timeout !== timeout);
        reject(new Error(`${this.player.playerId}: timed out waiting for ${label}`));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, timeout });
    });
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // Best-effort cleanup.
    }
  }
}

async function connectPlayers(roomId) {
  const clients = [];
  for (const player of players) {
    const client = new SmokeClient(roomId, player);
    clients.push(client);
    await client.connect();
  }
  await clients[0].waitFor(
    (message) => message.type === "presence" && Array.isArray(message.members) && message.members.length >= players.length,
    "full presence"
  );
  await clients.at(-1).waitFor(
    (message) => message.type === "game_state" && Array.isArray(message.players) && message.players.length >= players.length,
    "full lobby game_state"
  );
  console.log("ok WebSocket joins");
  return clients;
}

async function waitForPhase(client, phase, day) {
  return client.waitFor(
    (message) => message.type === "game_state" && message.phase === phase && (day === undefined || message.day === day),
    `${phase} phase${day === undefined ? "" : ` day ${day}`}`,
    10000
  );
}

function alivePlayerIds(gameState) {
  return (gameState?.players ?? [])
    .filter((player) => player.alive)
    .map((player) => player.playerId);
}

function clientById(clients, playerId) {
  const client = clients.find((candidate) => candidate.player.playerId === playerId);
  if (!client) {
    throw new Error(`Missing client for ${playerId}`);
  }
  return client;
}

async function voteAllAlive(clients, targetPlayerId) {
  const latest = clients[0].latestGameState;
  for (const playerId of alivePlayerIds(latest)) {
    clientById(clients, playerId).send({ type: "vote", targetPlayerId });
  }
}

async function runGameLoop(roomId, clients) {
  clients[0].send({ type: "start_game" });
  await clients[0].waitFor(
    (message) => (
      (message.type === "action_ack" && message.action === "start_game") ||
      (message.type === "error" && typeof message.message === "string")
    ),
    "start_game acknowledgement"
  ).then((message) => {
    if (message.type === "error") {
      throw new Error(`start_game failed: ${message.message}`);
    }
  });
  await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "role", "role message")));
  const roles = new Map(clients.map((client) => [client.player.playerId, client.messages.find((message) => message.type === "role")?.role]));
  const wolves = [...roles.entries()].filter(([, role]) => role === "werewolf").map(([playerId]) => playerId);
  const seer = [...roles.entries()].find(([, role]) => role === "seer")?.[0];
  const winningPlayerId = [...roles.entries()].find(([, role]) => role !== "werewolf")?.[0];
  if (wolves.length !== 2 || !seer) {
    throw new Error(`Unexpected 8-player role set: wolves=${wolves.length}, seer=${seer ?? "missing"}`);
  }
  if (!winningPlayerId) {
    throw new Error("Expected at least one non-werewolf player");
  }
  await waitForPhase(clients[0], "day", 1);
  console.log("ok start_game day 1");

  await voteAllAlive(clients, wolves[0]);
  await waitForPhase(clients[0], "night", 1);
  console.log("ok day vote executes first wolf");

  const nightState = clients[0].latestGameState;
  const livingNonWolves = alivePlayerIds(nightState).filter((playerId) => !wolves.includes(playerId));
  const livingWolf = wolves.find((playerId) => alivePlayerIds(nightState).includes(playerId));
  if (!livingWolf) {
    throw new Error("Expected one living wolf after first execution");
  }
  const killTarget = livingNonWolves.find((playerId) => playerId !== seer) ?? livingNonWolves[0];
  if (alivePlayerIds(nightState).includes(seer)) {
    clientById(clients, seer).send({ type: "divine", targetPlayerId: livingWolf });
  }
  clientById(clients, livingWolf).send({ type: "night_kill", targetPlayerId: killTarget });
  await waitForPhase(clients[0], "day", 2);
  console.log("ok night actions resolve day 2");

  await voteAllAlive(clients, livingWolf);
  const ended = await clients[0].waitFor(
    (message) => message.type === "game_state" && message.phase === "ended",
    "ended game_state",
    10000
  );
  if (ended.winner !== "villagers") {
    throw new Error(`Expected villagers winner, got ${ended.winner ?? "none"}`);
  }
  console.log("ok day 2 vote ends game");
  return { winningPlayerId };
}

async function verifyEndedRoom(roomId) {
  const response = await fetch(urlFor(`/api/rooms/${roomId}`), { headers: { accept: "application/json" } });
  const body = await readJson(response, "GET /api/rooms/:roomId");
  if (body?.room?.id !== roomId || body?.room?.status !== "ended") {
    throw new Error("GET /api/rooms/:roomId: expected ended smoke room summary");
  }
  console.log("ok GET /api/rooms/:roomId ended");
}

async function verifyGameRecord(roomId) {
  const response = await fetch(urlFor(`/api/rooms/${roomId}/records`), { headers: { accept: "application/json" } });
  const body = await readJson(response, "GET /api/rooms/:roomId/records");
  const record = Array.isArray(body?.records) ? body.records.find((candidate) => candidate.roomId === roomId) : undefined;
  if (record?.result?.winner !== "villagers" || record?.result?.day !== 2) {
    throw new Error("GET /api/rooms/:roomId/records: expected villagers day-2 game record");
  }
  console.log("ok GET /api/rooms/:roomId/records");
}

async function verifyPlayerPersistence(roomId, playerId) {
  const statsResponse = await fetch(urlFor(`/api/players/${playerId}/stats`), { headers: { accept: "application/json" } });
  const statsBody = await readJson(statsResponse, "GET /api/players/:playerId/stats");
  if (
    statsBody?.stats?.playerId !== playerId ||
    statsBody.stats.gamesPlayed < 1 ||
    statsBody.stats.wins < 1
  ) {
    throw new Error("GET /api/players/:playerId/stats: expected winning player stats");
  }

  const recordsResponse = await fetch(urlFor(`/api/players/${playerId}/records`), { headers: { accept: "application/json" } });
  const recordsBody = await readJson(recordsResponse, "GET /api/players/:playerId/records");
  const record = Array.isArray(recordsBody?.records) ? recordsBody.records.find((candidate) => candidate.roomId === roomId) : undefined;
  if (record?.winner !== "villagers" || record?.playerId !== playerId) {
    throw new Error("GET /api/players/:playerId/records: expected winning player room record");
  }
  console.log("ok GET /api/players/:playerId stats/records");
}

let clients = [];
try {
  const roomId = await createRoom();
  clients = await connectPlayers(roomId);
  const { winningPlayerId } = await runGameLoop(roomId, clients);
  await verifyEndedRoom(roomId);
  await verifyGameRecord(roomId);
  await verifyPlayerPersistence(roomId, winningPlayerId);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  for (const client of clients) {
    client.close();
  }
}

if (failures.length > 0) {
  console.error(`${smokeLabel} smoke failed:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`${smokeLabel} smoke passed`);
process.exit(0);
