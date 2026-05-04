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
    .player-icon img { width: 42px; height: 42px; object-fit: cover; display: block; }
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
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/api/stats/leaderboard">排行榜 JSON</a></td></tr>
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
      const optionMarks = [
        `<span class="option-mark">即時</span>`,
        room.options.poison ? `<span class="option-mark">埋毒</span>` : "",
        room.options.bigWolf ? `<span class="option-mark">大狼</span>` : "",
        room.options.authority ? `<span class="option-mark">權力</span>` : "",
        room.options.decider ? `<span class="option-mark">決定</span>` : "",
        room.options.lovers ? `<span class="option-mark">戀人</span>` : "",
        room.options.betrayer ? `<span class="option-mark">背德</span>` : "",
        room.options.childFox ? `<span class="option-mark">子狐</span>` : ""
      ].filter(Boolean).join(" ");
      return `<a class="room-link" href="/room/${escapeHtml(room.id)}">
        <span class="room-line"><span class="status status-${status}">${status}</span><small>[${escapeHtml(room.id)}]</small> ${escapeHtml(room.name)}村</span>
        <small class="room-comment">～建立時間：${escapeHtml(room.createdAt)}～ ${optionMarks}</small>
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
      <legend><strong>戰績排行榜</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead>
          <tr>
            <td><strong>順位</strong></td>
            <td><strong>玩家</strong></td>
            <td><strong>勝</strong></td>
            <td><strong>敗</strong></td>
            <td><strong>場數</strong></td>
          </tr>
        </thead>
        <tbody id="leaderboardRows">
          <tr><td colspan="5" class="muted">讀取中...</td></tr>
        </tbody>
      </table>
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
          <td><label><strong>　20人以上埋毒者選項：</strong></label></td>
          <td><label><input id="optionPoison" type="checkbox"> <small>埋毒者登場</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　20人以上時大狼出場：</strong></label></td>
          <td><label><input id="optionBigWolf" type="checkbox"> <small>狼群隨機一隻取代為大狼</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　16人以上權力者出場：</strong></label></td>
          <td><label><input id="optionAuthority" type="checkbox"> <small>處刑投票時一票算兩票</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　16人以上決定者出場：</strong></label></td>
          <td><label><input id="optionDecider" type="checkbox"> <small>同票時決定者投票優先</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　13人以上戀人出場：</strong></label></td>
          <td><label><input id="optionLovers" type="checkbox"> <small>兩名戀人生存到勝利條件時戀人勝利</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　20人以上妖狐的選項：</strong></label></td>
          <td><label><input id="optionBetrayer" type="checkbox"> <small>背德者登場，妖狐死亡時跟隨死亡</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　20人以上妖狐的占：</strong></label></td>
          <td><label><input id="optionChildFox" type="checkbox"> <small>子狐登場，可於夜晚占卜但可能失敗</small></label></td>
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
        const poison = document.querySelector("#optionPoison").checked;
        const bigWolf = document.querySelector("#optionBigWolf").checked;
        const authority = document.querySelector("#optionAuthority").checked;
        const decider = document.querySelector("#optionDecider").checked;
        const lovers = document.querySelector("#optionLovers").checked;
        const betrayer = document.querySelector("#optionBetrayer").checked;
        const childFox = document.querySelector("#optionChildFox").checked;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, playerId: localStorage.getItem(playerKey), nickname, options: { poison, bigWolf, authority, decider, lovers, betrayer, childFox } })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "建立房間失敗");
          return;
        }
        location.href = "/room/" + data.roomId;
      });

      async function refreshLeaderboard() {
        const rows = document.querySelector("#leaderboardRows");
        try {
          const res = await fetch("/api/stats/leaderboard");
          const data = await res.json();
          if (!res.ok || !Array.isArray(data.leaderboard)) {
            throw new Error(data.error || "讀取失敗");
          }
          rows.textContent = "";
          if (data.leaderboard.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "muted";
            cell.textContent = "尚無戰績。";
            row.append(cell);
            rows.append(row);
            return;
          }
          for (const entry of data.leaderboard) {
            const row = document.createElement("tr");
            for (const value of [entry.rank, entry.playerId, entry.wins, entry.losses, entry.gamesPlayed]) {
              const cell = document.createElement("td");
              cell.textContent = String(value);
              row.append(cell);
            }
            rows.append(row);
          }
        } catch {
          rows.innerHTML = '<tr><td colspan="5" class="muted">排行榜讀取失敗。</td></tr>';
        }
      }
      void refreshLeaderboard();
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
              <td>戰績</td>
              <td><span id="stats" class="muted">未取得</span></td>
            </tr>
            <tr>
              <td>玩家暱稱</td>
              <td><input id="nickname" maxlength="32" size="28"> <button id="connect">進入房間</button> <button id="startGame">開始遊戲</button></td>
            </tr>
            <tr>
              <td>頭像</td>
              <td><input id="avatarFile" type="file" accept="image/*" size="28"> <button id="uploadAvatar">頭像</button></td>
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
      <tr>
        <td>
          <table class="panel">
            <tr><th>最近對局</th></tr>
            <tr><td><div id="records" class="muted">讀取中</div></td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="panel">
            <tr><th>事件</th></tr>
            <tr><td><div id="events" class="muted">讀取中</div></td></tr>
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
      async function refreshStats() {
        const playerId = localStorage.getItem(playerKey);
        const target = document.querySelector("#stats");
        try {
          const res = await fetch("/api/players/" + playerId + "/stats");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "stats failed");
          target.textContent = data.stats.gamesPlayed + " 戰 " + data.stats.wins + " 勝 " + data.stats.losses + " 敗";
        } catch {
          target.textContent = "未取得";
        }
      }
      async function refreshRecords() {
        const target = document.querySelector("#records");
        try {
          const res = await fetch("/api/rooms/" + roomId + "/records");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "records failed");
          if (!data.records.length) {
            target.textContent = "尚無紀錄。";
            return;
          }
          target.innerHTML = "";
          data.records.slice(0, 5).forEach((record) => {
            const div = document.createElement("div");
            const winner = record.result && record.result.winner ? record.result.winner : "unknown";
            const day = record.result && record.result.day ? record.result.day : "?";
            div.textContent = record.createdAt + "　" + winner + " 勝　第 " + day + " 日";
            target.appendChild(div);
          });
        } catch {
          target.textContent = "紀錄讀取失敗。";
        }
      }
      async function refreshEvents() {
        const target = document.querySelector("#events");
        try {
          const res = await fetch("/api/rooms/" + roomId + "/events");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "events failed");
          if (!data.events.length) {
            target.textContent = "尚無事件。";
            return;
          }
          target.innerHTML = "";
          data.events.slice(0, 8).forEach((event) => {
            const div = document.createElement("div");
            const player = event.playerId ? "　" + event.playerId : "";
            div.textContent = event.createdAt + "　" + event.eventType + player;
            target.appendChild(div);
          });
        } catch {
          target.textContent = "事件讀取失敗。";
        }
      }
      let latestGame;
      let role = "";
      void refreshStats();
      void refreshRecords();
      void refreshEvents();
      document.querySelector("#connect").addEventListener("click", () => {
        const nickname = document.querySelector("#nickname").value;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        void refreshStats();
        void refreshEvents();
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
          } else if (msg.type === "child_fox_result") {
            const result = msg.result === "failed" ? "失敗" : msg.result === "werewolf" ? "狼" : "人";
            append("<font color='#990099'>[子狐]</font> " + msg.targetNickname + " 是「" + result + "」。");
          } else if (msg.type === "medium_result") {
            const result = msg.result === "werewolf" ? "狼" : "人";
            append("<font color='#006666'>[靈能]</font> 第 " + msg.day + " 日被處決的 " + msg.targetNickname + " 是「" + result + "」。");
          } else if (msg.type === "action_ack") {
            append("<span class='muted'>行動已送出。</span>");
          } else if (msg.type === "game_state") {
            latestGame = msg;
            renderGame(msg);
            if (msg.phase === "ended") {
              void refreshStats();
              void refreshRecords();
              void refreshEvents();
            }
          } else if (msg.type === "role") {
            role = msg.role;
            const wolves = msg.wolves.length ? "（狼伴：" + msg.wolves.map((wolf) => wolf.nickname).join(", ") + "）" : "";
            const commons = msg.commons && msg.commons.length ? "（共有：" + msg.commons.map((common) => common.nickname).join(", ") + "）" : "";
            const lovers = msg.lovers && msg.lovers.length ? "（戀人：" + msg.lovers.map((lover) => lover.nickname).join(", ") + "）" : "";
            const foxes = msg.foxes && msg.foxes.length ? "（妖狐：" + msg.foxes.map((fox) => fox.nickname).join(", ") + "）" : "";
            const authority = msg.authority ? "（權力者）" : "";
            document.querySelector("#role").textContent = roleLabel(msg.role) + wolves + commons + lovers + foxes + authority;
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
      document.querySelector("#uploadAvatar").addEventListener("click", async () => {
        const fileInput = document.querySelector("#avatarFile");
        if (!fileInput.files || fileInput.files.length === 0) return;
        const form = new FormData();
        form.set("playerId", localStorage.getItem(playerKey));
        form.set("avatar", fileInput.files[0]);
        const res = await fetch("/api/assets/avatar", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "頭像上傳失敗");
          return;
        }
        if (latestGame) renderGame(latestGame);
      });
      function sendCommand(command) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(command));
        }
      }
      function roleLabel(value) {
        return {
          villager: "村民",
          werewolf: "人狼",
          big_wolf: "大狼",
          seer: "占卜師",
          medium: "靈能者",
          madman: "狂人",
          guard: "獵人",
          common: "共有者",
          fox: "妖狐",
          poison: "埋毒者",
          betrayer: "背德者",
          child_fox: "子狐"
        }[value] || value;
      }
      function winnerLabel(value) {
        return {
          villagers: "村民",
          werewolves: "人狼",
          foxes: "妖狐",
          lovers: "戀人"
        }[value] || "未定";
      }
      function isWolfRole(value) {
        return value === "werewolf" || value === "big_wolf";
      }
      function renderGame(game) {
        document.querySelector("#phase").textContent =
          game.phase + (game.day ? " " + game.day : "") + (game.revoteCount ? " 再投票 " + game.revoteCount : "");
        document.querySelector("#winner").textContent = winnerLabel(game.winner);
        const currentPlayerId = localStorage.getItem(playerKey);
        const currentPlayer = game.players.find((player) => player.playerId === currentPlayerId);
        const currentPlayerAlive = currentPlayer ? currentPlayer.alive : game.phase === "lobby";
        const actorCanAct =
          currentPlayerAlive &&
          (game.phase === "day" || (game.phase === "night" && (isWolfRole(role) || role === "seer" || role === "guard" || role === "child_fox")));
        const host = game.players.find((player) => player.playerId === game.hostId);
        document.querySelector("#host").textContent = host ? host.nickname : "未定";
        document.querySelector("#startGame").disabled = game.phase !== "lobby" || game.hostId !== currentPlayerId;
        document.querySelector("#sendWolfChat").disabled = !(game.phase === "night" && isWolfRole(role) && currentPlayerAlive);
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
          const avatar = document.createElement("img");
          avatar.src = "/assets/avatar/" + player.playerId + "?v=" + Date.now();
          avatar.alt = "";
          avatar.addEventListener("error", () => {
            avatar.remove();
            iconCell.textContent = initial;
          });
          iconCell.appendChild(avatar);
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
          button.disabled = !actorCanAct || !player.alive || player.playerId === currentPlayerId || game.phase === "ended" || game.phase === "lobby";
          if (!player.alive) {
            button.className = "dead";
          }
          button.addEventListener("click", () => {
            if (!latestGame) return;
            if (latestGame.phase === "day") {
              sendCommand({ type: "vote", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && isWolfRole(role)) {
              sendCommand({ type: "night_kill", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && role === "seer") {
              sendCommand({ type: "divine", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && role === "child_fox") {
              sendCommand({ type: "child_fox_divine", targetPlayerId: player.playerId });
            } else if (latestGame.phase === "night" && role === "guard") {
              sendCommand({ type: "guard", targetPlayerId: player.playerId });
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
