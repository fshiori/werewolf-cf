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
    body { margin: 12px; background: #eee8d8; color: #2b2118; font: 14px "Times New Roman", "Noto Serif TC", serif; }
    table { border-collapse: collapse; width: 100%; max-width: 920px; margin: 0 auto 12px; background: #fffaf0; }
    th, td { border: 1px solid #7d6b58; padding: 6px 8px; vertical-align: top; }
    th { background: #c9b89a; color: #24190f; }
    input, button { font: inherit; border: 1px solid #7d6b58; background: #fffdf6; padding: 4px 6px; }
    button { background: #d8c7a6; cursor: pointer; }
    a { color: #4f3622; }
    #chatLog { height: 280px; overflow: auto; background: #fffdf6; }
    #gameLog { height: 140px; overflow: auto; background: #fffdf6; }
    #players button { margin: 2px 4px 2px 0; min-width: 7em; text-align: left; }
    .dead { text-decoration: line-through; color: #7b6f65; }
    .muted { color: #6c6258; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function renderHome(rooms: RoomSummary[]): string {
  const roomRows = rooms.length === 0
    ? `<tr><td colspan="4" class="muted">目前沒有房間。</td></tr>`
    : rooms.map((room) => `<tr>
      <td><a href="/room/${escapeHtml(room.id)}">${escapeHtml(room.name)}</a></td>
      <td>${escapeHtml(room.status)}</td>
      <td>${escapeHtml(room.createdAt)}</td>
      <td>${escapeHtml(room.id)}</td>
    </tr>`).join("");

  return page("Werewolf CF", `
    <table>
      <tr><th colspan="2">汝等是人是狼？</th></tr>
      <tr>
        <td style="width: 160px;">玩家暱稱</td>
        <td><input id="nickname" maxlength="32"></td>
      </tr>
      <tr>
        <td>房間名稱</td>
        <td><input id="roomName" maxlength="48"> <button id="createRoom">建立房間</button></td>
      </tr>
    </table>
    <table>
      <tr><th>房間</th><th>狀態</th><th>建立時間</th><th>ID</th></tr>
      ${roomRows}
    </table>
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
  `);
}

export function renderRoom(roomId: string): string {
  return page(`Room ${roomId}`, `
    <table>
      <tr><th colspan="2">房間 ${escapeHtml(roomId)}</th></tr>
      <tr>
        <td style="width: 180px;">玩家暱稱</td>
        <td><input id="nickname" maxlength="32"> <button id="connect">進入房間</button> <a href="/">回房間列表</a></td>
      </tr>
    </table>
    <table>
      <tr><th style="width: 220px;">生存者</th><th>對話</th></tr>
      <tr>
        <td><div id="members" class="muted">尚未連線</div></td>
        <td>
          <div id="chatLog"></div>
          <input id="chatText" maxlength="500" style="width: 75%;">
          <button id="sendChat">送出</button>
        </td>
      </tr>
    </table>
    <table>
      <tr><th style="width: 220px;">遊戲</th><th>行動</th></tr>
      <tr>
        <td>
          <div>階段：<span id="phase">lobby</span></div>
          <div>身分：<span id="role" class="muted">未分配</span></div>
          <div>勝利：<span id="winner" class="muted">未定</span></div>
          <button id="startGame">開始遊戲</button>
        </td>
        <td>
          <div id="players" class="muted">等待狀態更新</div>
          <div id="gameLog"></div>
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
          } else if (msg.type === "game_state") {
            latestGame = msg;
            renderGame(msg);
          } else if (msg.type === "role") {
            role = msg.role;
            const wolves = msg.wolves.length ? "（狼伴：" + msg.wolves.map((wolf) => wolf.nickname).join(", ") + "）" : "";
            document.querySelector("#role").textContent = msg.role + wolves;
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
        document.querySelector("#startGame").disabled = game.phase !== "lobby";
        const currentPlayerId = localStorage.getItem(playerKey);
        const players = document.querySelector("#players");
        players.innerHTML = "";
        game.players.forEach((player) => {
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
            }
          });
          players.appendChild(button);
        });
        if (game.players.length === 0) {
          players.textContent = "尚無玩家。";
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
