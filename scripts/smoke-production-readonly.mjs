#!/usr/bin/env node

const args = process.argv.slice(2);
const labelArg = args.find((arg) => arg.startsWith("--label="));
const smokeLabel = labelArg?.slice("--label=".length) || "Production read-only";
const host = args.find((arg) => !arg.startsWith("--label=")) ?? process.env.WORKER_HOST;

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
      return value?.version?.name === "werewolf-cf"
        && value?.version?.appVersion === "0.1.0"
        && value?.version?.runtime === "Cloudflare Workers"
        && value?.version?.language === "TypeScript"
        && ["ROOM_DO", "DB", "ASSETS", "CONFIG"].every((binding) => value?.version?.bindings?.includes(binding))
        && value?.version?.capabilities?.includes("websocket_protocol");
    },
    expected: "werewolf-cf version metadata, bindings ROOM_DO/DB/ASSETS/CONFIG, and websocket_protocol capability"
  },
  {
    path: "/api/protocol",
    kind: "json",
    validate(value) {
      return value?.websocket?.path === "/ws/room/:roomId"
        && value?.websocket?.firstClientMessage === "join"
        && value?.websocket?.channelVariants?.common_chat?.publicVoicePlayerId === "common_voice"
        && value?.websocket?.channelVariants?.common_chat?.publicVoiceNickname === "共有者的聲音";
    },
    expected: "websocket protocol metadata with common voice variant"
  },
  {
    path: "/api/config",
    kind: "json",
    validate(value) {
      return typeof value?.config?.maintenanceMode === "boolean";
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
  { path: "/", kind: "html", expectedText: "汝等是人是狼？" },
  { path: "/rules", kind: "html", expectedText: "規則" },
  { path: "/protocol", kind: "html", expectedText: ["WebSocket 入口", "common_voice"] },
  { path: "/version", kind: "html", expectedText: "版本資訊" }
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
      const expectedTexts = Array.isArray(check.expectedText) ? check.expectedText : [check.expectedText].filter(Boolean);
      const missingText = expectedTexts.find((expectedText) => !text.includes(expectedText));
      if (missingText) {
        failures.push(`${check.path}: expected HTML text ${missingText}`);
        continue;
      }
    }
    console.log(`ok ${check.path}`);
  } catch (error) {
    failures.push(`${check.path}: ${error instanceof Error ? error.message : String(error)}`);
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
