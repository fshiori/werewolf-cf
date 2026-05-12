#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
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

async function createRoom() {
  const smokeId = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetch(urlFor("/api/rooms"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `Visual ${smokeId}`,
      comment: "visual parity capture",
      maxPlayers: 8,
      playerId: `player_${smokeId}_host`,
      nickname: "VisualHost",
      options: {
        realTime: true,
        dayMinutes: 3,
        nightMinutes: 1.5
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
  return body.roomId;
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
- Remaining blockers: Day, night, ended, dead/player/GM old-log modes still require stateful browser setup and manual comparison against the PHP reference.

## Screenshot Index

| Capture | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Functional Browser Checks

| Check | Result | Notes |
| --- | --- | --- |
| Static rendered pages load | Captured | Home, list, icons, Trip, BBS, stats, status |
| Temporary lobby room renders | Captured | Includes modern room page and PHP-style frame/up/bottom/vote aliases |

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
  process.exit(0);
}

try {
  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  const roomId = await createRoom();
  const captures = plannedCaptures(roomId);
  const browser = await chromium.launch();
  try {
    for (const capture of captures) {
      for (const viewport of viewports) {
        await capturePage(browser, capture, viewport);
        console.log(`ok ${capture.name} ${viewport.name}`);
      }
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
