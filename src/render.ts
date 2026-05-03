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
    </script>
  `);
}
