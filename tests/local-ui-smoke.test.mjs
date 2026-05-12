import { createServer } from "node:http";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/smoke-local-ui.mjs");
const servers = [];

function responseFor(path, method = "GET") {
  if ((path === "/" || path === "/index.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>汝等是人是狼？ 建立村子 戰績排行榜</title>" };
  }
  if (path === "/leaderboard" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>戰績排行榜</title>" };
  }
  if ((path === "/stats" || path === "/stats.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>勝率分析 統計場數</title>" };
  }
  if ((path === "/list" || path === "/list.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>聯合遊戲列表 本伺服器</title>" };
  }
  if ((path === "/logs" || path === "/old_log.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>過去紀錄 村No</title>" };
  }
  if ((path === "/icons" || path === "/icon_view.php") && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>頭像一覽 上傳頭像 /assets/reference/user_icon/001.gif</title>' };
  }
  if (path === "/icon_upload.php" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>用戶圖像上傳 頭像上傳 icon_file</title>' };
  }
  if (path === "/trips" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>Trip查詢 Trip公開資料 tripStateMark health-mark</title>" };
  }
  if ((path === "/trip" || path === "/trip.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>身份登錄 Trip公開資料 tripStateMark health-mark</title>" };
  }
  if (path === "/bbs" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>主題列表 發表主題 精華 form name="bbs"</title>' };
  }
  if (path === "/status" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>伺服器狀態 Binding 檢查 health-mark</title>" };
  }
  if (path === "/admin" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>管理選單 admin.php?go=rooms admin.php?go=config</title>' };
  }
  if (path === "/admin/rooms" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>廢村管理 roomAdminToken werewolf_cf_room_admin_token</title>" };
  }
  if (path === "/admin/config" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>系統設定管理 configAdminToken werewolf_cf_config_admin_token</title>" };
  }
  if (path === "/admin/bbs" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>討論管理 BBS 管理密碼 尚無主題。</title>" };
  }
  if (path === "/manual" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>說明書 登錄入村</title>" };
  }
  if ((path === "/rules" || path === "/rule.php" || path === "/lang/jpn/rule.php") && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>基本流程 /assets/reference/img/role_human.gif</title>' };
  }
  if ((path === "/script-info" || path === "/script_info.php" || path === "/lang/jpn/script_info.php") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>Script Info Cloudflare Workers / TypeScript</title>" };
  }
  if (path === "/protocol" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>WebSocket 入口 game_state</title>" };
  }
  if ((path === "/version" || path === "/version.php" || path === "/lang/cht/version.htm") && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>版本資訊 Werewolf Cloudflare Port</title>" };
  }
  if (path === "/assets/room-client.js" && method === "GET") {
    return { contentType: "text/javascript", body: 'const roomShell = document.querySelector("[data-room-id]"); new WebSocket("ws://example.test"); const label = "投開始遊戲一票"; const command = "start_vote"; const situation = "GAMESTART";' };
  }
  if (path === "/api/rooms" && method === "POST") {
    return { contentType: "application/json", body: JSON.stringify({ roomId: "room_ui_smoke" }) };
  }
  if (path === "/room/room_ui_smoke" && method === "GET") {
    return { contentType: "text/html", body: '<!doctype html><title>[room_ui_smoke] 進入房間 玩家列表 能力發動 / 投票 對局紀錄 事件履歷 完整紀錄 /assets/room-client.js 旁觀視點 只觀看公開資訊 靈界視點 死亡後視點入口</title>' };
  }
  if (path === "/game_frame.php" && method === "GET") {
    return {
      contentType: "text/html",
      body: '<!doctype html><title>汝等是人是狼？＜遊戲＞</title><frameset><frame name="up" src="/game_up.php?room_no=room_ui_smoke&amp;auto_reload=20#game_top"><frame name="bottom" src="/game_play.php?room_no=room_ui_smoke&amp;auto_reload=20&amp;frame=bottom#game_top"></frameset>'
    };
  }
  if (path === "/game_up.php" && method === "GET") {
    return {
      contentType: "text/html",
      body: '<!doctype html><title>上方更新</title><style>body.room-page-up .game-header { display: none; }</style><table data-room-page="up"><form class="legacy-send-form" name="send" target="bottom"><a href="/game_vote.php?room_no=room_ui_smoke&amp;auto_reload=20#game_top" target="bottom">投票/能力</a></form></table>'
    };
  }
  if (path === "/game_play.php" && method === "GET") {
    return {
      contentType: "text/html",
      body: '<!doctype html><title>下方遊戲</title><style>body.room-page-bottom .legacy-entry-map, body.room-page-bottom .page-bottom-only { display: none; } body.room-page-bottom .room-chat-controls { display: none; }</style><table data-room-page="bottom"><tr><td>發言紀錄</td></tr></table>'
    };
  }
  if (path === "/game_vote.php" && method === "GET") {
    return {
      contentType: "text/html",
      body: '<!doctype html><title>投票入口</title><style>body.room-page-vote .legacy-entry-map, body.room-page-vote .page-vote-description { display: none; } body.room-page-vote .room-panel-members, body.room-page-vote .room-panel-actions { display: none; }</style><table data-room-page="vote"><form class="legacy-vote-form" name="game_vote"><button type="button" disabled>投開始遊戲一票</button><input type="hidden" name="target_player_id"><input type="hidden" name="target_handle_name"></form></table>'
    };
  }
  if (path === "/room/room_ui_smoke/records" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子對局紀錄 room_ui_smoke</title>" };
  }
  if (path === "/room/room_ui_smoke/events" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子事件履歷 room_ui_smoke 村子建立</title>" };
  }
  if (path === "/room/room_ui_smoke/log" && method === "GET") {
    return { contentType: "text/html", body: "<!doctype html><title>村子完整紀錄 room_ui_smoke 村子建立</title>" };
  }
  if (path.startsWith("/player/player_ui_smoke_") && method === "GET") {
    return { contentType: "text/html", body: `<!doctype html><title>個人戰績 ${path.slice("/player/".length)} 最近參戰紀錄 /assets/reference/</title>` };
  }
  return { status: 404, contentType: "text/plain", body: "not found" };
}

async function startServer(overrides = {}) {
  const server = createServer((request, response) => {
    const path = request.url?.split("?")[0] ?? "/";
    const key = `${request.method ?? "GET"} ${path}`;
    const result = overrides[key] ?? overrides[path] ?? responseFor(path, request.method);
    response.writeHead(result.status ?? 200, { "content-type": result.contentType });
    response.end(result.body);
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function runScript(args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("local UI smoke script", () => {
  it("passes against rendered UI pages", async () => {
    const host = await startServer();
    const result = await runScript(["--label=Test UI", host]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok /room/room_ui_smoke");
    expect(result.stdout).toContain("ok /index.php");
    expect(result.stdout).toContain("ok /old_log.php");
    expect(result.stdout).toContain("ok /icon_upload.php");
    expect(result.stdout).toContain("ok /lang/cht/version.htm");
    expect(result.stdout).toContain("ok /game_frame.php?room_no=room_ui_smoke&auto_reload=20");
    expect(result.stdout).toContain("ok /game_vote.php?room_no=room_ui_smoke&auto_reload=20");
    expect(result.stdout).toContain("Test UI smoke passed");
  });

  it("fails when room page exposes old JSON links", async () => {
    const host = await startServer({
      "GET /room/room_ui_smoke": {
        contentType: "text/html",
        body: '<!doctype html><title>[room_ui_smoke] 進入房間 玩家列表 能力發動 / 投票 對局紀錄 事件履歷 完整紀錄 /assets/room-client.js 房間JSON</title>'
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("房間JSON");
  });

  it("fails when legacy frame pages omit hidden diagnostic chrome CSS", async () => {
    const host = await startServer({
      "GET /game_vote.php": {
        contentType: "text/html",
        body: '<!doctype html><title>投票入口</title><style>body.room-page-vote .room-panel-members, body.room-page-vote .room-panel-actions { display: none; }</style><table data-room-page="vote"><form class="legacy-vote-form" name="game_vote"><button type="button" disabled>投開始遊戲一票</button><input type="hidden" name="target_player_id"><input type="hidden" name="target_handle_name"></form></table>'
      }
    });
    const result = await runScript([host]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("body.room-page-vote .legacy-entry-map,");
  });
});
