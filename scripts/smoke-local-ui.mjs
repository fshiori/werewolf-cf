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
  await expectHtml("/list", ["聯合遊戲列表", "本伺服器"]);
  await expectHtml("/logs", ["過去紀錄", "村No"]);
  await expectHtml("/leaderboard", ["戰績排行榜"]);
  await expectHtml("/stats", ["勝率分析", "統計場數"]);
  await expectHtml("/icons", ["頭像一覽", "上傳頭像", "/assets/reference/user_icon/001.gif"]);
  await expectHtml("/trip", ["身份登錄", "Trip公開資料", "tripStateMark", "health-mark"]);
  await expectHtml("/trips", ["Trip查詢", "Trip公開資料", "tripStateMark", "health-mark"]);
  await expectHtml("/bbs", ["主題列表", "發表主題", "/bbs/1"]);
  await expectHtml("/bbs?digest=1", ["精華", "主題列表"]);
  await expectHtml("/bbs/1", ["文章列表", "主題管理", "bbs-status-mark", "bbsDeleteButton", "bbsReplyDeleteButton", "bbsTopicEditButton", "bbsReplyEditButton"]);
  await expectHtml("/status", ["伺服器狀態", "Binding 檢查", "health-mark"]);
  await expectHtml("/admin", ["管理選單", "/admin/rooms", "/admin/config"]);
  await expectHtml("/admin/rooms", ["廢村管理", "roomAdminToken", "werewolf_cf_room_admin_token"]);
  await expectHtml("/admin/config", ["系統設定管理", "configAdminToken", "werewolf_cf_config_admin_token"]);
  await expectHtml("/admin/bbs", ["討論管理", "BBS 管理密碼", "bbs-status-mark", "/bbs/1#bbsModerationForm"]);
  await expectHtml("/rules", ["基本流程", "/assets/reference/img/role_human.gif"]);
  await expectHtml("/manual", ["說明書", "登錄入村"]);
  await expectHtml("/script-info", ["Script Info", "Cloudflare Workers / TypeScript"]);
  await expectHtml("/protocol", ["WebSocket 入口", "game_state"]);
  await expectHtml("/version", ["版本資訊", "Werewolf Cloudflare Port"]);
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
  await expectHtml(`/room/${roomId}?view=spectator`, ["旁觀視點", "只觀看公開資訊", "玩家列表", "/assets/room-client.js"], ["房間JSON", "new WebSocket"]);
  await expectHtml(`/room/${roomId}?view=heaven`, ["靈界視點", "死亡後視點入口", "玩家列表", "/assets/room-client.js"], ["房間JSON", "new WebSocket"]);
  await expectHtml(`/game_frame.php?room_no=${encodeURIComponent(roomId)}&auto_reload=20`, [
    "汝等是人是狼？＜遊戲＞",
    `<frame name="up" src="/game_up.php?room_no=${roomId}&amp;auto_reload=20#game_top"`,
    `<frame name="bottom" src="/game_play.php?room_no=${roomId}&amp;auto_reload=20&amp;frame=bottom#game_top"`
  ], ["data-room-page=\"frame\"", "房間JSON"]);
  await expectHtml(`/game_up.php?room_no=${encodeURIComponent(roomId)}&auto_reload=20`, [
    "data-room-page=\"up\"",
    "form id=\"legacySendForm\" name=\"send\"",
    "target=\"bottom\"",
    `href=\"/game_vote.php?room_no=${roomId}&amp;auto_reload=20#game_top\" target=\"bottom\"`,
    "body.room-page-up .game-header { display: none; }"
  ], ["房間JSON"]);
  await expectHtml(`/game_play.php?room_no=${encodeURIComponent(roomId)}&auto_reload=20&frame=bottom`, [
    "data-room-page=\"bottom\"",
    "body.room-page-bottom .legacy-entry-map,",
    "body.room-page-bottom .page-bottom-only { display: none; }",
    "body.room-page-bottom .room-chat-controls { display: none; }",
    "發言紀錄"
  ], ["房間JSON"]);
  await expectHtml(`/game_vote.php?room_no=${encodeURIComponent(roomId)}&auto_reload=20`, [
    "data-room-page=\"vote\"",
    "form class=\"legacy-vote-form\" name=\"game_vote\"",
    "body.room-page-vote .legacy-entry-map,",
    "body.room-page-vote .page-vote-only { display: none; }",
    "body.room-page-vote .room-panel-members,"
  ], ["房間JSON"]);
  await expectHtml(`/room/${roomId}/records`, ["村子對局紀錄", roomId]);
  await expectHtml(`/room/${roomId}/events`, ["村子事件履歷", roomId, "room_created"]);
  await expectHtml(`/room/${roomId}/log`, ["村子完整紀錄", roomId, "room_created"]);
  await expectHtml(`/player/${playerId}`, ["個人戰績", playerId, "最近參戰紀錄", "/assets/reference/"]);

  console.log(`${smokeLabel} smoke passed`);
  process.exit(0);
} catch (error) {
  console.error(`${smokeLabel} smoke failed:`);
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
