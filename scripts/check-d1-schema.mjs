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

const requiredColumns = {
  rooms: ["id", "name", "status", "created_at", "updated_at", "option_role", "room_comment", "max_user", "dellook", "dummy_name", "dummy_last_words", "gm_trip_hash"],
  players: ["id", "nickname", "created_at", "last_seen_at", "trip_hash", "registered_trip_hash"],
  player_stats: ["player_id", "games_played", "wins", "losses", "updated_at"],
  game_records: ["id", "room_id", "result_json", "created_at"],
  room_events: ["id", "room_id", "player_id", "event_type", "payload_json", "created_at"],
  registered_trips: ["trip_hash", "created_at"],
  excluded_trips: ["trip_hash", "reason", "created_at"]
};

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

function collectTableColumns(value, columns = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTableColumns(item, columns);
    }
    return columns;
  }
  if (value && typeof value === "object") {
    if (typeof value.table_name === "string" && typeof value.column_name === "string") {
      if (!columns.has(value.table_name)) {
        columns.set(value.table_name, new Set());
      }
      columns.get(value.table_name).add(value.column_name);
    }
    for (const child of Object.values(value)) {
      collectTableColumns(child, columns);
    }
  }
  return columns;
}

function parseSchema(output) {
  try {
    const parsed = JSON.parse(output);
    return {
      tables: collectTableNames(parsed),
      columns: collectTableColumns(parsed)
    };
  } catch {
    throw new Error("Unable to parse D1 schema query output as JSON");
  }
}

function readSchemaFromWrangler() {
  const command = [
    "WITH app_tables AS (SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) NOT GLOB '_cf_*')",
    "SELECT name, NULL AS table_name, NULL AS column_name FROM app_tables",
    "UNION ALL",
    "SELECT NULL AS name, app_tables.name AS table_name, p.name AS column_name FROM app_tables JOIN pragma_table_info(app_tables.name) AS p",
    "ORDER BY name, table_name, column_name"
  ].join(" ");
  const wranglerArgs = ["wrangler", "d1", "execute", "werewolf-cf", remote ? "--remote" : "--local", "--command", command, "--json"];
  const result = spawnSync("npx", wranglerArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "wrangler d1 execute failed").trim());
  }
  return result.stdout;
}

const output = inputPath ? readFileSync(inputPath, "utf8") : readSchemaFromWrangler();
let schema;
try {
  schema = parseSchema(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const missing = requiredTables.filter((table) => !schema.tables.has(table));
const missingColumns = Object.entries(requiredColumns).flatMap(([table, columns]) => {
  const actualColumns = schema.columns.get(table) ?? new Set();
  return columns.filter((column) => !actualColumns.has(column)).map((column) => `${table}.${column}`);
});
if (missing.length > 0) {
  console.error("D1 schema verification failed:");
  for (const table of missing) {
    console.error(`- Missing table: ${table}`);
  }
  for (const column of missingColumns) {
    console.error(`- Missing column: ${column}`);
  }
  process.exit(1);
}

if (missingColumns.length > 0) {
  console.error("D1 schema verification failed:");
  for (const column of missingColumns) {
    console.error(`- Missing column: ${column}`);
  }
  process.exit(1);
}

console.log(`D1 ${remote ? "remote" : "local"} schema verification passed`);
