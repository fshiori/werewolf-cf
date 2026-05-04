import type { RoomSummary } from "./types";
import { escapeHtml } from "./validation";

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    a { color: blue; text-decoration: none; }
    a:visited { color: blue; }
    a:hover { color: #999999; text-decoration: underline; }
    body {
      margin: 0;
      background: #ffffff;
      color: #000000;
      font: 14px "Times New Roman", "PMingLiU", "Noto Serif TC", serif;
    }
    table { border-collapse: collapse; }
    input, button, select {
      font: inherit;
      border: 1px solid silver;
      background-color: aliceblue;
      padding: 2px 4px;
    }
    button { cursor: pointer; color: #000000; }
    button:disabled { color: #777777; cursor: default; }
    fieldset { border: 2px groove #d9d9d9; margin: 0 0 18px; padding: 10px 14px 14px; }
    legend { padding: 0 4px; }
    .site { width: 100%; }
    .masthead { padding: 8px 8px 0; }
    .title { color: #cc3300; font-size: 28px; font-weight: bold; line-height: 1; }
    .subtitle { text-align: right; font-weight: bold; }
    .side { width: 190px; padding: 8px 0 0 8px; vertical-align: top; }
    .main { padding: 8px 16px 24px 18px; vertical-align: top; }
    .menu-box { width: 140px; border: 1px solid #cc3300; }
    .menu-box th { background: #ccffcc; padding: 5px; }
    .menu-list td { padding: 2px 3px; }
    .room-link { color: #cc3300; display: block; margin-bottom: 8px; }
    .room-line { font-size: 16px; }
    .room-comment { display: block; text-align: right; margin-left: 100px; color: #333333; }
    .status {
      display: inline-block;
      min-width: 58px;
      padding: 1px 4px;
      margin-right: 3px;
      border: 1px solid #333333;
      color: #ffffff;
      font-size: 12px;
      text-align: center;
    }
    .status-lobby { background: #339933; }
    .status-playing { background: #cc6600; }
    .status-ended { background: #666666; }
    .option-mark {
      display: inline-block;
      border: 1px solid #999999;
      background: #eeeeee;
      font-size: 11px;
      padding: 0 3px;
      margin-left: 2px;
    }
    .form-table td { padding: 4px 2px; vertical-align: top; }
    .game-shell { width: 800px; margin: 8px auto 18px; }
    .game-shell > tbody > tr > td { padding: 0 0 8px; }
    .game-header {
      width: 800px;
      border: 1px solid #666666;
      background: #efefef;
    }
    .game-header th { padding: 6px 8px; text-align: left; font-size: 15px; }
    .game-header td { padding: 4px 8px; border-top: 1px solid #cccccc; }
    .panel {
      width: 800px;
      border: 1px dotted #000000;
      background: #ffffff;
    }
    .panel th {
      padding: 4px 6px;
      background: #ccffcc;
      border-bottom: 1px solid #999999;
      text-align: left;
    }
    .panel td { padding: 6px; vertical-align: top; }
    .player-grid { border-spacing: 5px; border-collapse: separate; font-size: 10pt; }
    .player-card { width: 148px; border: 1px solid #b0b0b0; background: #fafafa; }
    .player-icon {
      width: 42px;
      height: 42px;
      border: 2px solid #666666;
      background: #e8eef8;
      text-align: center;
      font-weight: bold;
      color: #333366;
    }
    .player-name { padding-left: 5px; }
    .dead { background: #303030; color: #dddddd; text-decoration: line-through; }
    #chatLog {
      height: 280px;
      overflow: auto;
      background: #ffffff;
      font-size: 12pt;
      font-family: "PMingLiU", "Noto Serif TC", serif;
    }
    #chatLog div, #gameLog div { border-top: 1px dashed silver; padding: 2px 4px; }
    #gameLog { max-height: 140px; overflow: auto; background: #ffffff; }
    #players button { margin: 2px 4px 2px 0; min-width: 7em; text-align: left; }
    .muted { color: #666666; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function shell(body: string): string {
  return `
    <table class="site">
      <tr>
        <td colspan="2" class="masthead">
          <a href="/" class="title">汝等是人是狼？</a>
          <div class="subtitle">Werewolf Cloudflare Port</div>
        </td>
      </tr>
      <tr>
        <td class="side">
          <table class="menu-box"><tr><th>選單</th></tr></table>
          <table class="menu-list">
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/">首頁</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/api/rooms">房間 JSON</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="javascript:void(0)">規則</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="javascript:void(0)">版本</a></td></tr>
          </table>
        </td>
        <td class="main">${body}</td>
      </tr>
    </table>
  `;
}

const DEFAULT_ANNOUNCEMENT = "目前支援建立村子、即時聊天、白天投票、夜晚行動與自動換日。";

export function renderHome(rooms: RoomSummary[], announcement = DEFAULT_ANNOUNCEMENT): string {
  const roomRows = rooms.length === 0
    ? `<div class="muted">目前沒有村子。</div>`
    : rooms.map((room) => {
      const status = escapeHtml(room.status);
      return `<a class="room-link" href="/room/${escapeHtml(room.id)}">
        <span class="room-line"><span class="status status-${status}">${status}</span><small>[${escapeHtml(room.id)}]</small> ${escapeHtml(room.name)}村</span>
        <small class="room-comment">～建立時間：${escapeHtml(room.createdAt)}～ <span class="option-mark">即時</span></small>
      </a>`;
    }).join("");

  return page("Werewolf CF", shell(`
    <fieldset>
      <legend><strong>伺服器公告</strong></legend>
      <div style="line-height:135%;margin:12px 20px 18px;">
        <strong>Cloudflare Workers / D1 / Durable Objects 移植進行中。</strong><br>
        <span class="muted">${escapeHtml(announcement)}</span>
      </div>
    </fieldset>
    <fieldset>
      <legend><strong>遊戲列表</strong></legend>
      <div style="line-height:135%;margin:12px 20px 18px;"><strong>${roomRows}</strong></div>
    </fieldset>
    <fieldset>
      <legend><strong>建立村子</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　玩家暱稱：</strong></label></td>
          <td><input id="nickname" maxlength="32" size="28"></td>
        </tr>
        <tr>
          <td><label><strong>　村子名稱：</strong></label></td>
          <td><input id="roomName" maxlength="48" size="45"> 村</td>
        </tr>
        <tr>
          <td><label><strong>　限時時間：</strong></label></td>
          <td><small>日：3 分　夜：1.5 分　<span class="option-mark">固定</span></small></td>
        </tr>
        <tr>
          <td></td>
          <td><button id="createRoom">建立房間</button></td>
        </tr>
      </table>
    </fieldset>
    <script>
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      const nick = localStorage.getItem("werewolf_cf_nickname") || "";
      document.querySelector("#nickname").value = nick;
      document.querySelector("#createRoom").addEventListener("click", async () => {
        const nickname = document.querySelector("#nickname").value;
        const name = document.querySelector("#roomName").value;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, playerId: localStorage.getItem(playerKey), nickname })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "建立房間失敗");
          return;
        }
        location.href = "/room/" + data.roomId;
      });
    </script>
  `));
}

export function renderRoom(roomId: string): string {
  return page(`Room ${roomId}`, `
    <table class="game-shell">
      <tr>
        <td>
          <table class="game-header">
            <tr><th colspan="2">[${escapeHtml(roomId)}] 汝等是人是狼？</th></tr>
            <tr>
              <td style="width: 180px;">階段：<span id="phase">lobby</span></td>
              <td>勝利：<span id="winner" class="muted">未定</span>　<a href="/">首頁</a></td>
            </tr>
            <tr>
              <td>房主</td>
              <td><span id="host" class="muted">未定</span></td>
            </tr>
            <tr>
              <td>玩家暱稱</td>
              <td><input id="nickname" maxlength="32" size="28"> <button id="connect">進入房間</button> <button id="startGame">開始遊戲</button></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="panel">
            <tr><th>玩家列表</th></tr>
            <tr><td><div id="members" class="muted">尚未連線</div><table id="playerGrid" class="player-grid"></table></td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="panel">
            <tr><th>能力發動 / 投票</th></tr>
            <tr>
              <td>
                <div>身分：<span id="role" class="muted">未分配</span></div>
                <div id="players" class="muted">等待狀態更新</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="panel">
            <tr><th>發言</th></tr>
            <tr>
              <td>
                <div id="chatLog"></div>
                <input id="chatText" maxlength="500" size="72">
                <button id="sendChat">送出</button>
                <button id="sendWolfChat" disabled>狼頻</button>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="panel">
            <tr><th>系統訊息</th></tr>
            <tr><td><div id="gameLog"></div></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <script>
      const roomId = ${JSON.stringify(roomId)};
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      document.querySelector("#nickname").value = localStorage.getItem("werewolf_cf_nickname") || "";
      let ws;
      function append(line) {
        const div = document.createElement("div");
        div.innerHTML = line;
        document.querySelector("#chatLog").appendChild(div);
      }
      let latestGame;
      let role = "";
      document.querySelector("#connect").addEventListener("click", () => {
        const nickname = document.querySelector("#nickname").value;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/room/" + roomId);
        ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "join", playerId: localStorage.getItem(playerKey), nickname })));
        ws.addEventListener("message", (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "presence") {
            document.querySelector("#members").textContent = msg.members.map((m) => m.nickname).join(", ");
          } else if (msg.type === "chat") {
            append("<b>" + msg.nickname + "</b>: " + msg.text);
          } else if (msg.type === "wolf_chat") {
            append("<font color='#cc0000'>[狼頻]</font> <b>" + msg.nickname + "</b>: " + msg.text);
          } else if (msg.type === "divination_result") {
            const result = msg.result === "werewolf" ? "狼" : "人";
            append("<font color='#660099'>[占卜]</font> " + msg.targetNickname + " 是「" + result + "」。");
          } else if (msg.type === "medium_result") {
            const result = msg.result === "werewolf" ? "狼" : "人";
            append("<font color='#006666'>[靈能]</font> 第 " + msg.day + " 日被處決的 " + msg.targetNickname + " 是「" + result + "」。");
          } else if (msg.type === "game_state") {
            latestGame = msg;
            renderGame(msg);
          } else if (msg.type === "role") {
            role = msg.role;
            const wolves = msg.wolves.length ? "（狼伴：" + msg.wolves.map((wolf) => wolf.nickname).join(", ") + "）" : "";
            document.querySelector("#role").textContent = msg.role + wolves;
            if (latestGame) renderGame(latestGame);
          } else if (msg.type === "error") {
            append("<span class='muted'>" + msg.message + "</span>");
          }
        });
      });
      document.querySelector("#sendChat").addEventListener("click", () => {
        const input = document.querySelector("#chatText");
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "chat", text: input.value }));
          input.value = "";
        }
      });
      document.querySelector("#sendWolfChat").addEventListener("click", () => {
        const input = document.querySelector("#chatText");
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "wolf_chat", text: input.value }));
          input.value = "";
        }
      });
      document.querySelector("#startGame").addEventListener("click", () => {
        sendCommand({ type: "start_game" });
      });
      function sendCommand(command) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(command));
        }
      }
      function renderGame(game) {
        document.querySelector("#phase").textContent = game.phase + (game.day ? " " + game.day : "");
        document.querySelector("#winner").textContent = game.winner || "未定";
        const currentPlayerId = localStorage.getItem(playerKey);
        const host = game.players.find((player) => player.playerId === game.hostId);
        document.querySelector("#host").textContent = host ? host.nickname : "未定";
        document.querySelector("#startGame").disabled = game.phase !== "lobby" || game.hostId !== currentPlayerId;
        document.querySelector("#sendWolfChat").disabled = !(game.phase === "night" && role === "werewolf");
        const players = document.querySelector("#players");
        const playerGrid = document.querySelector("#playerGrid");
        players.innerHTML = "";
        playerGrid.innerHTML = "";
        let row;
        game.players.forEach((player) => {
          if (!row || row.children.length >= 5) {
            row = document.createElement("tr");
            playerGrid.appendChild(row);
          }
          const card = document.createElement("td");
          card.className = "player-card" + (player.alive ? "" : " dead");
          const initial = (player.nickname || "?").slice(0, 1);
          const cardTable = document.createElement("table");
          const cardRow = document.createElement("tr");
          const iconCell = document.createElement("td");
          iconCell.className = "player-icon";
          iconCell.textContent = initial;
          const nameCell = document.createElement("td");
          nameCell.className = "player-name";
          const marker = document.createElement("font");
          marker.color = "#666666";
          marker.textContent = "◆";
          const status = document.createElement("span");
          status.textContent = player.alive ? "(生存中)" : "(死亡)";
          nameCell.append(marker, player.nickname, document.createElement("br"), status);
          cardRow.append(iconCell, nameCell);
          cardTable.appendChild(cardRow);
          card.appendChild(cardTable);
          row.appendChild(card);
          const button = document.createElement("button");
          button.textContent = (player.alive ? "" : "× ") + player.nickname;
          button.disabled = !player.alive || player.playerId === currentPlayerId || game.phase === "ended" || game.phase === "lobby";
          if (!player.alive) {
            button.className = "dead";
          }
          button.addEventListener("click", () => {
            if (!latestGame) return;
            if (latestGame.phase === "day") {
              sendCommand({ type: "vote", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && role === "werewolf") {
              sendCommand({ type: "night_kill", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && role === "seer") {
              sendCommand({ type: "divine", targetPlayerId: player.playerId });
            }
          });
          players.appendChild(button);
        });
        if (game.players.length === 0) {
          players.textContent = "尚無玩家。";
          playerGrid.innerHTML = "";
        }
        const log = document.querySelector("#gameLog");
        log.innerHTML = "";
        game.log.slice(-20).forEach((line) => {
          const div = document.createElement("div");
          div.textContent = line;
          log.appendChild(div);
        });
      }
    </script>
  `);
}
