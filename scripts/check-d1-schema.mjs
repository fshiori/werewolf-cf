#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredTables = [
  "rooms",
  "players",
  "player_stats",
  "game_records",
  "room_events",
  "registered_trips",
  "excluded_trips"
];

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const inputIndex = args.indexOf("--input");
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;

if (inputIndex >= 0 && !inputPath) {
  console.error("--input requires a file path");
  process.exit(1);
}

function collectTableNames(value, names = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTableNames(item, names);
    }
    return names;
  }
  if (value && typeof value === "object") {
    if (typeof value.name === "string") {
      names.add(value.name);
    }
    for (const child of Object.values(value)) {
      collectTableNames(child, names);
    }
  }
  return names;
}

function parseTables(output) {
  try {
    return collectTableNames(JSON.parse(output));
  } catch {
    throw new Error("Unable to parse D1 table query output as JSON");
  }
}

function readTablesFromWrangler() {
  const command = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
  const wranglerArgs = ["wrangler", "d1", "execute", "werewolf-cf", remote ? "--remote" : "--local", "--command", command, "--json"];
  const result = spawnSync("npx", wranglerArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "wrangler d1 execute failed").trim());
  }
  return result.stdout;
}

const output = inputPath ? readFileSync(inputPath, "utf8") : readTablesFromWrangler();
let tables;
try {
  tables = parseTables(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const missing = requiredTables.filter((table) => !tables.has(table));
if (missing.length > 0) {
  console.error("D1 schema verification failed:");
  for (const table of missing) {
    console.error(`- Missing table: ${table}`);
  }
  process.exit(1);
}

console.log(`D1 ${remote ? "remote" : "local"} schema verification passed`);
