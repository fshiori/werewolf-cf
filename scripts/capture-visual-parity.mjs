#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeGameStates = args.includes("--include-game-states");
const confirmed = args.includes("--yes") || process.env.VISUAL_PARITY_CAPTURE_CONFIRM === "true";
const host = args.find((arg) => !arg.startsWith("--")) ?? process.env.WORKER_HOST ?? "http://127.0.0.1:8787";
const date = process.env.VISUAL_PARITY_CAPTURE_DATE ?? new Date().toISOString().slice(0, 10);
const outputDir = optionValue("--output-dir") ?? join("docs", "screenshots", date);
const reportPath = optionValue("--report") ?? join("docs", "test-results", `${date}-visual-parity.md`);

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 }
];

const staticCaptures = [
  { name: "home", path: "/" },
  { name: "list", path: "/list" },
  { name: "icons", path: "/icons" },
  { name: "trip", path: "/trip" },
  { name: "bbs", path: "/bbs" },
  { name: "stats", path: "/stats" },
  { name: "status", path: "/status" }
];

function optionValue(name) {
  const arg = args.find((candidate) => candidate.startsWith(`${name}=`));
  return arg?.slice(name.length + 1);
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

if (!dryRun && !confirmed) {
  console.error("Visual parity capture creates a temporary room and screenshot files. Pass --yes or set VISUAL_PARITY_CAPTURE_CONFIRM=true to continue.");
  process.exit(1);
}

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

function screenshotPath(captureName, viewportName) {
  return join(outputDir, `${captureName}-${viewportName}.png`);
}

function plannedCaptures(roomId = ":roomId") {
  return [
    ...staticCaptures,
    { name: "room-lobby", path: `/room/${roomId}` },
    { name: "room-spectator", path: `/room/${roomId}?view=spectator` },
    { name: "game-frame", path: `/game_frame.php?room_no=${roomId}&auto_reload=20` },
    { name: "game-up", path: `/game_up.php?room_no=${roomId}&auto_reload=20` },
    { name: "game-bottom", path: `/game_play.php?room_no=${roomId}&auto_reload=20&frame=bottom` },
    { name: "game-vote", path: `/game_vote.php?room_no=${roomId}&auto_reload=20` }
  ];
}

function plannedGameStateCaptures(roomId = ":roomId") {
  return [
    { name: "room-day", path: `/room/${roomId}` },
    { name: "room-night", path: `/room/${roomId}` },
    { name: "room-ended", path: `/room/${roomId}` },
    { name: "old-log-public", path: `/old_log.php?log_mode=on&room_no=${roomId}` }
  ];
}

async function createRoom() {
  const smokeId = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const players = Array.from({ length: 8 }, (_, index) => ({
    playerId: `player_${smokeId}_${index + 1}`,
    nickname: index === 0 ? "VisualHost" : `Visual${index + 1}`
  }));
  const response = await fetch(urlFor("/api/rooms"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `Visual ${smokeId}`,
      comment: "visual parity capture",
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

  if (!response.ok) {
    throw new Error(`POST /api/rooms: HTTP ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  if (typeof body?.roomId !== "string" || !body.roomId.startsWith("room_")) {
    throw new Error("POST /api/rooms: expected roomId");
  }
  return { roomId: body.roomId, players };
}

function websocketUrlFor(path) {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

class CaptureClient {
  constructor(roomId, player) {
    this.player = player;
    this.messages = [];
    this.waiters = [];
    this.latestGameState = undefined;
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

  waitFor(predicate, label, timeoutMs = 10000) {
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

async function capturePage(browser, capture, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.goto(urlFor(capture.path), { waitUntil: "networkidle" });
    const brokenImages = await page.locator("img").evaluateAll((images) => images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("src") || image.getAttribute("alt") || "<unknown image>"));
    if (brokenImages.length > 0) {
      throw new Error(`${capture.name} ${viewport.name}: broken images: ${brokenImages.slice(0, 5).join(", ")}`);
    }
    await page.screenshot({ path: screenshotPath(capture.name, viewport.name), fullPage: true });
  } finally {
    await page.close();
  }
}

async function captureAllViewports(browser, capture) {
  for (const viewport of viewports) {
    await capturePage(browser, capture, viewport);
    console.log(`ok ${capture.name} ${viewport.name}`);
  }
}

async function connectPlayers(roomId, players) {
  const clients = [];
  for (const player of players) {
    const client = new CaptureClient(roomId, player);
    clients.push(client);
    await client.connect();
  }
  await clients.at(-1).waitFor(
    (message) => message.type === "game_state" && Array.isArray(message.players) && message.players.length >= players.length,
    "full lobby game_state"
  );
  return clients;
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
  for (const playerId of alivePlayerIds(clients[0].latestGameState)) {
    clientById(clients, playerId).send({ type: "vote", targetPlayerId });
  }
}

async function captureGameStates(browser, roomId, players) {
  if (typeof WebSocket !== "function") {
    throw new Error("WebSocket global is unavailable in this Node.js runtime");
  }

  const clients = await connectPlayers(roomId, players);
  try {
    clients[0].send({ type: "start_game" });
    await clients[0].waitFor((message) => message.type === "game_state" && message.phase === "day" && message.day === 1, "day 1");
    await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "role", "role message")));
    const roles = new Map(clients.map((client) => [client.player.playerId, client.messages.find((message) => message.type === "role")?.role]));
    const wolves = [...roles.entries()].filter(([, role]) => role === "werewolf").map(([playerId]) => playerId);
    const seer = [...roles.entries()].find(([, role]) => role === "seer")?.[0];
    if (wolves.length !== 2 || !seer) {
      throw new Error(`Unexpected 8-player role set: wolves=${wolves.length}, seer=${seer ?? "missing"}`);
    }

    await captureAllViewports(browser, { name: "room-day", path: `/room/${roomId}` });
    await voteAllAlive(clients, wolves[0]);
    await clients[0].waitFor((message) => message.type === "game_state" && message.phase === "night" && message.day === 1, "night 1");
    await captureAllViewports(browser, { name: "room-night", path: `/room/${roomId}` });

    const livingWolf = wolves.find((playerId) => alivePlayerIds(clients[0].latestGameState).includes(playerId));
    if (!livingWolf) {
      throw new Error("Expected one living wolf after first execution");
    }
    const killTarget = alivePlayerIds(clients[0].latestGameState).find((playerId) => !wolves.includes(playerId) && playerId !== seer);
    if (alivePlayerIds(clients[0].latestGameState).includes(seer)) {
      clientById(clients, seer).send({ type: "divine", targetPlayerId: livingWolf });
    }
    clientById(clients, livingWolf).send({ type: "night_kill", targetPlayerId: killTarget });
    await clients[0].waitFor((message) => message.type === "game_state" && message.phase === "day" && message.day === 2, "day 2");
    await voteAllAlive(clients, livingWolf);
    await clients[0].waitFor((message) => message.type === "game_state" && message.phase === "ended", "ended");
    await captureAllViewports(browser, { name: "room-ended", path: `/room/${roomId}` });
    await captureAllViewports(browser, { name: "old-log-public", path: `/old_log.php?log_mode=on&room_no=${roomId}` });
  } finally {
    for (const client of clients) {
      client.close();
    }
  }
}

function reportFor(captures, browserName) {
  const rows = [];
  for (const capture of captures) {
    for (const viewport of viewports) {
      rows.push(`| ${capture.name} | ${viewport.name} | ${screenshotPath(capture.name, viewport.name)} | Captured | ${capture.path} |`);
    }
  }

  return `# Visual Parity Pass

Date: ${date}
Browser: ${browserName}
Worker: ${baseUrl.toString()}

## Summary

- Result: Partial
- Remaining blockers: ${includeGameStates ? "Dead/player/GM old-log modes still require stateful browser setup and manual comparison against the PHP reference." : "Day, night, ended, dead/player/GM old-log modes still require stateful browser setup and manual comparison against the PHP reference."}

## Screenshot Index

| Capture | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Functional Browser Checks

| Check | Result | Notes |
| --- | --- | --- |
| Static rendered pages load | Captured | Home, list, icons, Trip, BBS, stats, status |
| Temporary lobby room renders | Captured | Includes modern room page and PHP-style frame/up/bottom/vote aliases |
| Stateful game screens | ${includeGameStates ? "Captured" : "Not run"} | ${includeGameStates ? "Day, night, ended, and public old-log captures were generated from an 8-player smoke game" : "Pass --include-game-states to drive an 8-player smoke game"} |

## Privacy Checks

| Check | Result | Notes |
| --- | --- | --- |
| Private live channels | Not run | Requires multi-player in-game browser setup |
`;
}

if (dryRun) {
  console.log(`Visual parity capture plan for ${baseUrl.toString()}`);
  console.log(`Screenshots: ${outputDir}`);
  console.log(`Report: ${reportPath}`);
  for (const capture of plannedCaptures()) {
    for (const viewport of viewports) {
      console.log(`plan ${capture.name} ${viewport.name} ${capture.path} -> ${screenshotPath(capture.name, viewport.name)}`);
    }
  }
  if (includeGameStates) {
    for (const capture of plannedGameStateCaptures()) {
      for (const viewport of viewports) {
        console.log(`plan ${capture.name} ${viewport.name} ${capture.path} -> ${screenshotPath(capture.name, viewport.name)}`);
      }
    }
  }
  process.exit(0);
}

try {
  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  const { roomId, players } = await createRoom();
  const captures = plannedCaptures(roomId);
  const browser = await chromium.launch();
  try {
    for (const capture of captures) {
      await captureAllViewports(browser, capture);
    }
    if (includeGameStates) {
      await captureGameStates(browser, roomId, players);
      captures.push(...plannedGameStateCaptures(roomId));
    }
  } finally {
    await browser.close();
  }
  await writeFile(reportPath, reportFor(captures, `Playwright Chromium ${chromium.executablePath()}`));
  console.log(`Visual parity capture report written: ${reportPath}`);
} catch (error) {
  console.error(`Visual parity capture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
