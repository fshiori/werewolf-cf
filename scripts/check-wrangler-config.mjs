#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const production = args.has("--production");
const configFlagIndex = process.argv.indexOf("--config");
const configFile = configFlagIndex >= 0 ? process.argv[configFlagIndex + 1] : "wrangler.toml";
if (configFlagIndex >= 0 && !configFile) {
  console.error("Missing value for --config");
  process.exit(1);
}
const configPath = resolve(process.cwd(), configFile);
const config = readFileSync(configPath, "utf8");

const checks = [
  { name: "Worker name", pattern: /^name\s*=\s*"werewolf-cf"$/m },
  { name: "Worker entrypoint", pattern: /^main\s*=\s*"src\/index\.ts"$/m },
  { name: "Room Durable Object binding", pattern: /name\s*=\s*"ROOM_DO"\s*\nclass_name\s*=\s*"RoomDurableObject"/m },
  { name: "Durable Object SQLite migration", pattern: /new_sqlite_classes\s*=\s*\["RoomDurableObject"\]/m },
  { name: "D1 DB binding", pattern: /binding\s*=\s*"DB"\s*\ndatabase_name\s*=\s*"werewolf-cf-db"/m },
  { name: "D1 migrations directory", pattern: /^migrations_dir\s*=\s*"migrations"$/m },
  { name: "R2 assets binding", pattern: /binding\s*=\s*"ASSETS"\s*\nbucket_name\s*=\s*"werewolf-cf-assets"/m },
  { name: "KV config binding", pattern: /binding\s*=\s*"CONFIG"/m }
];

const failures = checks.filter((check) => !check.pattern.test(config)).map((check) => `${check.name} is missing or changed`);

function configValue(name) {
  return config.match(new RegExp(`^${name}\\s*=\\s*"([^"]*)"`, "m"))?.[1];
}

function isPlaceholder(value) {
  return !value || value === "local-dev-placeholder" || /^<[^>]+>$/.test(value);
}

if (production) {
  const accountId = configValue("account_id");
  const databaseId = configValue("database_id");
  const kvId = configValue("id");
  if (isPlaceholder(accountId)) {
    failures.push("Production account_id must be set to a real Cloudflare account id");
  }
  if (isPlaceholder(databaseId)) {
    failures.push("Production D1 database_id must be set to a real resource id");
  }
  if (isPlaceholder(kvId)) {
    failures.push("Production KV id must be set to a real resource id");
  }
}

if (failures.length > 0) {
  console.error("wrangler.toml verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const mode = production ? "production" : "local";
console.log(`wrangler.toml ${mode} verification passed`);
