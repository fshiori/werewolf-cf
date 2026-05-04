#!/usr/bin/env node

const host = process.argv[2] ?? process.env.WORKER_HOST;

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

const checks = [
  {
    path: "/api/health",
    kind: "json",
    validate(value) {
      return value?.ok === true;
    },
    expected: "ok: true"
  },
  {
    path: "/api/version",
    kind: "json",
    validate(value) {
      return ["ROOM_DO", "DB", "ASSETS", "CONFIG"].every((binding) => value?.version?.bindings?.includes(binding))
        && value?.version?.capabilities?.includes("websocket_protocol");
    },
    expected: "bindings ROOM_DO/DB/ASSETS/CONFIG and websocket_protocol capability"
  },
  {
    path: "/api/protocol",
    kind: "json",
    validate(value) {
      return value?.path === "/ws/room/:roomId" && value?.firstClientMessage === "join";
    },
    expected: "websocket protocol metadata"
  },
  {
    path: "/api/config",
    kind: "json",
    validate(value) {
      return typeof value?.maintenanceMode === "boolean";
    },
    expected: "maintenanceMode boolean"
  },
  {
    path: "/api/rooms",
    kind: "json",
    validate(value) {
      return Array.isArray(value?.rooms);
    },
    expected: "rooms array"
  },
  { path: "/", kind: "html" },
  { path: "/rules", kind: "html" },
  { path: "/protocol", kind: "html" },
  { path: "/version", kind: "html" }
];

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("invalid JSON response");
  }
}

const failures = [];

for (const check of checks) {
  const url = urlFor(check.path);
  try {
    const response = await fetch(url, { headers: { accept: check.kind === "json" ? "application/json" : "text/html" } });
    if (!response.ok) {
      failures.push(`${check.path}: HTTP ${response.status}`);
      continue;
    }
    if (check.kind === "json") {
      const value = await readJson(response);
      if (!check.validate(value)) {
        failures.push(`${check.path}: expected ${check.expected}`);
        continue;
      }
    } else {
      const text = await response.text();
      if (!text.trim()) {
        failures.push(`${check.path}: empty HTML response`);
        continue;
      }
    }
    console.log(`ok ${check.path}`);
  } catch (error) {
    failures.push(`${check.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error("Production read-only smoke failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Production read-only smoke passed");
process.exit(0);
