export const ROOM_CLIENT_SCRIPT = String.raw`(() => {
const roomShell = document.querySelector("[data-room-id]");
const roomId = roomShell instanceof HTMLElement ? roomShell.dataset.roomId || "" : "";
const playerKey = "werewolf_cf_player_id";
if (!localStorage.getItem(playerKey)) {
  localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
}
document.querySelector("#nickname").value = localStorage.getItem("werewolf_cf_nickname") || "";
document.querySelector("#trip").value = localStorage.getItem("werewolf_cf_trip") || "";
document.querySelector("#defaultIcon").value = localStorage.getItem("werewolf_cf_default_icon") || "";
document.querySelector("#soundNotify").checked = localStorage.getItem("werewolf_cf_sound") === "on";
document.querySelector("#autoRefresh").checked = localStorage.getItem("werewolf_cf_auto_refresh") === "on";
let ws;
let autoRefreshTimer;
const maxObjections = 2;
function setRoomPhaseClass(phase) {
  document.body.classList.remove("room-phase-lobby", "room-phase-day", "room-phase-night", "room-phase-ended");
  document.body.classList.add("room-phase-" + phase);
}
function refreshAuxiliaryPanels() {
  void refreshStats();
  void refreshRecords();
  void refreshPlayerRecords();
  void refreshEvents();
}
function configureAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = undefined;
  }
  if (document.querySelector("#autoRefresh").checked) {
    autoRefreshTimer = setInterval(refreshAuxiliaryPanels, 15000);
  }
}
function append(line) {
  const div = document.createElement("div");
  div.innerHTML = line;
  document.querySelector("#chatLog").appendChild(div);
}
function playNotifySound() {
  if (!document.querySelector("#soundNotify").checked) return;
  try {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextImpl) return;
    const context = new AudioContextImpl();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {}
}
function notifyStateSound(nextGame, previousGame) {
  if (!previousGame) return;
  const phaseChanged = nextGame.phase !== previousGame.phase || nextGame.day !== previousGame.day;
  const revoteStarted =
    nextGame.phase === "day" &&
    previousGame.phase === "day" &&
    nextGame.revoteCount > previousGame.revoteCount;
  const suddenDeathWarningStarted =
    nextGame.suddenDeathWarningAt &&
    nextGame.suddenDeathWarningAt !== previousGame.suddenDeathWarningAt;
  if (phaseChanged || revoteStarted || suddenDeathWarningStarted) {
    playNotifySound();
  }
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
async function refreshPlayerRecords() {
  const playerId = localStorage.getItem(playerKey);
  const target = document.querySelector("#playerRecords");
  try {
    const res = await fetch("/api/players/" + playerId + "/records");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "player records failed");
    if (!data.records.length) {
      target.textContent = "尚無紀錄。";
      return;
    }
    target.innerHTML = "";
    data.records.slice(0, 5).forEach((record) => {
      const div = document.createElement("div");
      const winner = record.winner || "unknown";
      const day = record.day || "?";
      div.textContent = record.createdAt + "　[" + record.roomId + "] " + winner + " 勝　第 " + day + " 日　" + roleLabel(record.role);
      target.appendChild(div);
    });
  } catch {
    target.textContent = "個人紀錄讀取失敗。";
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
let isLover = false;
let isGm = false;
let revealedRoles = {};
refreshAuxiliaryPanels();
configureAutoRefresh();
document.querySelector("#manualRefresh").addEventListener("click", refreshAuxiliaryPanels);
document.querySelector("#autoRefresh").addEventListener("change", (event) => {
  localStorage.setItem("werewolf_cf_auto_refresh", event.target.checked ? "on" : "off");
  configureAutoRefresh();
  if (event.target.checked) refreshAuxiliaryPanels();
});
document.querySelector("#connect").addEventListener("click", () => {
  const nickname = document.querySelector("#nickname").value;
  const trip = document.querySelector("#trip").value;
  const wishRole = document.querySelector("#wishRole").value;
  const iconPath = document.querySelector("#defaultIcon").value;
  localStorage.setItem("werewolf_cf_nickname", nickname);
  localStorage.setItem("werewolf_cf_trip", trip);
  localStorage.setItem("werewolf_cf_default_icon", iconPath);
  refreshAuxiliaryPanels();
  ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/room/" + roomId);
  ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "join", playerId: localStorage.getItem(playerKey), nickname, trip, wishRole, iconPath })));
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "joined") {
      isGm = msg.members.some((m) => m.playerId === localStorage.getItem(playerKey) && m.gm);
      if (latestGame) renderGame(latestGame);
    } else if (msg.type === "presence") {
      isGm = msg.members.some((m) => m.playerId === localStorage.getItem(playerKey) && m.gm);
      document.querySelector("#members").textContent = msg.members.map((m) => m.gm ? m.nickname + " [GM]" : m.nickname).join(", ");
      if (latestGame) renderGame(latestGame);
    } else if (msg.type === "chat") {
      append("<b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "gm_chat") {
      append("<font color='#008800'>[GM]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "gm_whisper") {
      const currentPlayerId = localStorage.getItem(playerKey);
      const label = currentPlayerId === msg.targetPlayerId ? "[GM私語]" : "[GM私語→" + msg.targetNickname + "]";
      append("<font color='#008800'>" + label + "</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "wolf_chat") {
      append("<font color='#cc0000'>[狼頻]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "fox_chat") {
      append("<font color='#990099'>[狐頻]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "common_chat") {
      append("<font color='#996633'>[共有頻]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "lovers_chat") {
      append("<font color='#ff6699'>[戀頻]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "dead_chat") {
      append("<font color='#666666'>[靈界]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "self_talk") {
      append("<font color='#666666'>[自言自語]</font> <b>" + msg.nickname + "</b>: " + msg.text);
    } else if (msg.type === "objection") {
      playNotifySound();
      append("<font color='#cc0000'>[異議あり]</font> <b>" + msg.nickname + "</b> 提出反對。（剩餘 " + msg.remaining + "）");
    } else if (msg.type === "lobby_start_vote") {
      append("<span class='muted'>" + msg.nickname + " 投下開始遊戲一票。（" + msg.votedPlayerIds.length + "/" + msg.required + "）</span>");
    } else if (msg.type === "lobby_kick_vote") {
      append("<span class='muted'>" + msg.nickname + " 對 " + msg.targetNickname + " 投票踢出。（" + msg.votedPlayerIds.length + "/" + msg.required + "）</span>");
    } else if (msg.type === "divination_result") {
      const result = msg.result === "werewolf" ? "狼" : "人";
      append("<font color='#660099'>[占卜]</font> " + msg.targetNickname + " 是「" + result + "」。");
    } else if (msg.type === "child_fox_result") {
      const result = msg.result === "failed" ? "失敗" : msg.result === "werewolf" ? "狼" : "人";
      append("<font color='#990099'>[子狐]</font> " + msg.targetNickname + " 是「" + result + "」。");
    } else if (msg.type === "medium_result") {
      const result = msg.result === "werewolf" ? "狼" : "人";
      append("<font color='#006666'>[靈能]</font> 第 " + msg.day + " 日被處決的 " + msg.targetNickname + " 是「" + result + "」。");
    } else if (msg.type === "revealed_roles") {
      revealedRoles = msg.roles || {};
      if (latestGame) renderGame(latestGame);
    } else if (msg.type === "action_ack") {
      append("<span class='muted'>行動已送出。</span>");
    } else if (msg.type === "last_words_ack") {
      append("<span class='muted'>遺言已更新。</span>");
    } else if (msg.type === "game_state") {
      const previousGame = latestGame;
      notifyStateSound(msg, previousGame);
      latestGame = msg;
      renderGame(msg);
      if (msg.phase === "ended") {
        refreshAuxiliaryPanels();
      }
    } else if (msg.type === "role") {
      role = msg.role;
      isLover = Boolean(msg.lovers && msg.lovers.length);
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
document.querySelector("#sendFoxChat").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "fox_chat", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendCommonChat").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "common_chat", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendLoversChat").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "lovers_chat", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendDeadChat").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "dead_chat", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendSelfTalk").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "self_talk", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendObjection").addEventListener("click", () => {
  sendCommand({ type: "objection" });
});
document.querySelector("#sendRoomEndVote").addEventListener("click", () => {
  sendCommand({ type: "room_end_vote" });
});
document.querySelector("#soundNotify").addEventListener("change", (event) => {
  localStorage.setItem("werewolf_cf_sound", event.target.checked ? "on" : "off");
});
document.querySelector("#sendGmChat").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "gm_chat", text: input.value }));
    input.value = "";
  }
});
document.querySelector("#sendGmWhisper").addEventListener("click", () => {
  const input = document.querySelector("#chatText");
  const target = document.querySelector("#gmWhisperTarget").value;
  if (ws && ws.readyState === WebSocket.OPEN && target) {
    ws.send(JSON.stringify({ type: "gm_whisper", targetPlayerId: target, text: input.value }));
    input.value = "";
  }
});
document.querySelector("#setLastWords").addEventListener("click", () => {
  const input = document.querySelector("#lastWordsText");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_last_words", text: input.value }));
  }
});
document.querySelector("#startGame").addEventListener("click", () => {
  sendCommand({ type: "start_game" });
});
document.querySelector("#startVote").addEventListener("click", () => {
  sendCommand({ type: "start_vote" });
});
document.querySelector("#leaveRoom").addEventListener("click", () => {
  sendCommand({ type: "leave_room" });
});
document.querySelector("#gmAdvancePhase").addEventListener("click", () => {
  sendCommand({ type: "gm_advance_phase" });
});
document.querySelector("#gmEndGame").addEventListener("click", () => {
  sendCommand({ type: "gm_end_game", winner: document.querySelector("#gmWinner").value });
});
document.querySelector("#gmKillPlayer").addEventListener("click", () => {
  const target = document.querySelector("#gmWhisperTarget").value;
  if (target) sendCommand({ type: "gm_set_alive", targetPlayerId: target, alive: false });
});
document.querySelector("#gmRevivePlayer").addEventListener("click", () => {
  const target = document.querySelector("#gmWhisperTarget").value;
  if (target) sendCommand({ type: "gm_set_alive", targetPlayerId: target, alive: true });
});
document.querySelector("#gmSetRole").addEventListener("click", () => {
  const target = document.querySelector("#gmWhisperTarget").value;
  if (target) sendCommand({ type: "gm_set_role", targetPlayerId: target, role: document.querySelector("#gmRole").value });
});
document.querySelector("#gmEnableFlag").addEventListener("click", () => {
  const target = document.querySelector("#gmWhisperTarget").value;
  if (target) sendCommand({ type: "gm_set_flag", targetPlayerId: target, flag: document.querySelector("#gmFlag").value, enabled: true });
});
document.querySelector("#gmDisableFlag").addEventListener("click", () => {
  const target = document.querySelector("#gmWhisperTarget").value;
  if (target) sendCommand({ type: "gm_set_flag", targetPlayerId: target, flag: document.querySelector("#gmFlag").value, enabled: false });
});
document.querySelector("#gmEnableCommonVoice").addEventListener("click", () => {
  sendCommand({ type: "gm_set_common_voice", enabled: true });
});
document.querySelector("#gmDisableCommonVoice").addEventListener("click", () => {
  sendCommand({ type: "gm_set_common_voice", enabled: false });
});
document.querySelector("#gmSetChannelRestrictions").addEventListener("click", () => {
  sendCommand({
    type: "gm_set_channel_restrictions",
    restrictions: {
      wolf: document.querySelector("#gmRestrictWolf").checked,
      common: document.querySelector("#gmRestrictCommon").checked,
      lovers: document.querySelector("#gmRestrictLovers").checked,
      fox: document.querySelector("#gmRestrictFox").checked
    }
  });
});
document.querySelector("#uploadAvatar").addEventListener("click", async () => {
  const fileInput = document.querySelector("#avatarFile");
  if (!fileInput.files || fileInput.files.length === 0) return;
  if (fileInput.files[0].size > 512 * 1024) {
    alert("頭像需小於 512KiB");
    return;
  }
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
document.querySelector("#removeAvatar").addEventListener("click", async () => {
  const res = await fetch("/api/assets/avatar", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: localStorage.getItem(playerKey) })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "頭像刪除失敗");
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
    child_fox: "子狐",
    cat: "貓又"
  }[value] || value;
}
function roleIconPath(value) {
  return {
    villager: "img/role_human.gif",
    werewolf: "img/role_wolf.gif",
    big_wolf: "img/role_heavywolf.gif",
    seer: "img/role_mage.gif",
    medium: "img/role_necromancer.gif",
    madman: "img/role_mad.gif",
    guard: "img/role_guard.gif",
    common: "img/role_common.gif",
    fox: "img/role_fox.gif",
    poison: "img/role_poison.gif",
    betrayer: "img/role_cult.gif",
    child_fox: "img/role_fosi.gif",
    cat: "img/role_cat.gif"
  }[value] || "";
}
function referenceImage(path, alt) {
  const image = document.createElement("img");
  image.src = "/assets/reference/" + path;
  image.alt = alt;
  image.title = alt;
  image.width = 16;
  image.height = 16;
  image.className = "ref-icon";
  return image;
}
function appendPlayerIcon(iconCell, player, initial) {
  if (!player.alive) {
    const grave = referenceImage("img/grave.gif", "死亡");
    if (player.iconPath) {
      const graveSrc = grave.src;
      const liveSrc = "/assets/reference/" + player.iconPath;
      grave.addEventListener("mouseover", () => {
        grave.src = liveSrc;
      });
      grave.addEventListener("mouseout", () => {
        grave.src = graveSrc;
      });
    }
    iconCell.appendChild(grave);
    return;
  }
  const avatar = document.createElement("img");
  avatar.src = "/assets/avatar/" + player.playerId + "?v=" + Date.now();
  avatar.alt = "";
  avatar.addEventListener("error", () => {
    avatar.remove();
    if (player.iconPath) {
      iconCell.appendChild(referenceImage(player.iconPath, player.nickname));
    } else {
      iconCell.textContent = initial;
    }
  });
  iconCell.appendChild(avatar);
}
function appendVoteObserverPanel(container, game, currentPlayer, currentPlayerDead, voteSummary, votedPlayerIds) {
  if (game.phase !== "day" && game.phase !== "night") return;
  const observer = !currentPlayer || currentPlayerDead;
  if (!observer) return;
  const panel = document.createElement("div");
  panel.className = "muted";
  const label = currentPlayerDead ? "靈界視點" : "旁觀視點";
  const visibility = game.openVote ? "公開投票先" : "投票先非公開";
  panel.textContent = label + "：" + visibility + "。已投票 " + votedPlayerIds.size + " / " + game.players.filter((player) => player.alive).length + "。";
  container.appendChild(panel);
  if (!Object.keys(voteSummary).length) return;
  const table = document.createElement("table");
  table.className = "form-table";
  Object.entries(voteSummary).forEach(([targetId, voterNames]) => {
    const target = game.players.find((player) => player.playerId === targetId);
    const row = document.createElement("tr");
    const targetCell = document.createElement("td");
    const votersCell = document.createElement("td");
    targetCell.textContent = target ? target.nickname : targetId;
    votersCell.textContent = voterNames.join(", ");
    row.append(targetCell, votersCell);
    table.appendChild(row);
  });
  container.appendChild(table);
}
function updateVoteReminder(game, currentPlayer, currentPlayerAlive, votedPlayerIds) {
  const reminder = document.querySelector("#voteReminder");
  if (!reminder) return;
  reminder.innerHTML = "";
  if (!currentPlayer || !currentPlayerAlive || game.phase === "lobby" || game.phase === "ended" || isGm) return;
  const requiresVote =
    game.phase === "day" ||
    (game.phase === "night" && (isWolfRole(role) || role === "seer" || role === "guard" || role === "child_fox" || role === "cat"));
  if (!requiresVote || votedPlayerIds.has(currentPlayer.playerId)) return;
  const message = game.phase === "night" && isWolfRole(role)
    ? "系統提醒：您目前還沒有投票，如果同側已經投票請忽略此訊息。"
    : "系統提醒：您目前還沒有投票。";
  const warning = document.createElement("span");
  warning.style.backgroundColor = "#FF0000";
  warning.innerHTML = "<b>" + message + "</b>";
  reminder.appendChild(warning);
}
function renderLastWordsPanel(game) {
  const lastWordsLog = document.querySelector("#lastWordsLog");
  if (!lastWordsLog) return;
  const entries = (game.log || []).filter((line) => line.includes(" 的遺言："));
  lastWordsLog.innerHTML = "";
  if (!entries.length) {
    lastWordsLog.className = "muted";
    lastWordsLog.textContent = "尚無公開遺言。";
    return;
  }
  lastWordsLog.className = "";
  entries.slice(-10).forEach((line) => {
    const entry = document.createElement("div");
    entry.textContent = line;
    lastWordsLog.appendChild(entry);
  });
}
function winnerLabel(value) {
  return {
    villagers: "村民",
    werewolves: "人狼",
    foxes: "妖狐",
    lovers: "戀人"
  }[value] || "未定";
}
function phaseLabel(game) {
  if (game.phase === "lobby") return "遊戲前";
  if (game.phase === "ended") return "遊戲終了";
  const day = game.day || 0;
  const aliveCount = game.players.filter((player) => player.alive).length;
  const revote = game.revoteCount ? " ( " + game.revoteCount + " 回目)" : "";
  return day + " 日目 <small>(生存者" + aliveCount + "人)</small>" + revote;
}
function updatePhaseWarning(game) {
  const warning = document.querySelector("#phaseWarning");
  if (!warning) return;
  warning.innerHTML = "";
  if (!game.suddenDeathWarningAt || (game.phase !== "day" && game.phase !== "night")) return;
  const alert = document.createElement("span");
  alert.style.backgroundColor = "#CC3300";
  alert.style.color = "snow";
  alert.textContent = game.phase === "day" ? "　快要日落了。請趕快投票　" : "　快要日出了。請趕快投票　";
  warning.append(alert, document.createElement("br"));
}
function updateLobbyStartNotice(game) {
  const notice = document.querySelector("#lobbyStartNotice");
  if (!notice) return;
  notice.innerHTML = "";
  if (game.phase !== "lobby") return;
  const table = document.createElement("table");
  table.border = "0";
  table.cellPadding = "0";
  table.cellSpacing = "5";
  table.style.width = "100%";
  const row = document.createElement("tr");
  row.style.backgroundColor = "#009900";
  row.style.color = "snow";
  row.style.fontWeight = "bold";
  const cell = document.createElement("td");
  cell.vAlign = "middle";
  cell.align = "center";
  cell.style.width = "100%";
  cell.innerHTML = "需要遊戲全體人員投'開始遊戲'才能開始遊戲<small>(完成投票的玩家其名單背景顏色會變粉紅)</small>";
  row.appendChild(cell);
  table.appendChild(row);
  notice.appendChild(table);
}
function isWolfRole(value) {
  return value === "werewolf" || value === "big_wolf";
}
function renderGame(game) {
  setRoomPhaseClass(game.phase);
  document.querySelector("#phase").innerHTML = phaseLabel(game);
  updatePhaseWarning(game);
  updateLobbyStartNotice(game);
  document.querySelector("#winner").textContent = winnerLabel(game.winner);
  const currentPlayerId = localStorage.getItem(playerKey);
  const currentPlayer = game.players.find((player) => player.playerId === currentPlayerId);
  const currentPlayerAlive = currentPlayer ? currentPlayer.alive : game.phase === "lobby";
  const currentPlayerDead = Boolean(currentPlayer && !currentPlayer.alive);
  const actorCanAct =
    currentPlayerAlive &&
    (game.phase === "day" || (game.phase === "night" && (isWolfRole(role) || role === "seer" || role === "guard" || role === "child_fox" || role === "cat")));
  const host = game.players.find((player) => player.playerId === game.hostId);
  const canManageLobby = game.phase === "lobby" && (game.hostId === currentPlayerId || isGm);
  document.querySelector("#host").textContent = host ? host.nickname : "未定";
  document.querySelector("#startGame").disabled = game.phase !== "lobby" || (game.hostId !== currentPlayerId && !isGm);
  document.querySelector("#startVote").disabled = !(game.phase === "lobby" && currentPlayer && !isGm && !(game.lobbyStartVotedPlayerIds || []).includes(currentPlayerId));
  document.querySelector("#leaveRoom").disabled = !ws || ws.readyState !== WebSocket.OPEN;
  const channelRestrictions = game.channelRestrictions || {};
  document.querySelector("#sendWolfChat").disabled = !(game.phase === "night" && isWolfRole(role) && currentPlayerAlive && !channelRestrictions.wolf);
  document.querySelector("#sendFoxChat").disabled = !(game.phase === "night" && role === "fox" && currentPlayerAlive && !channelRestrictions.fox);
  document.querySelector("#sendCommonChat").disabled = !(game.phase === "night" && role === "common" && currentPlayerAlive && !channelRestrictions.common);
  document.querySelector("#sendLoversChat").disabled = !(game.phase === "night" && isLover && currentPlayerAlive && !channelRestrictions.lovers);
  document.querySelector("#sendDeadChat").disabled = !(currentPlayerDead && game.phase !== "lobby" && game.phase !== "ended");
  document.querySelector("#sendSelfTalk").disabled = !(game.phase === "night" && currentPlayerAlive);
  const objectionRemaining = currentPlayer ? Math.max(0, maxObjections - ((game.objectionCounts || {})[currentPlayerId] || 0)) : maxObjections;
  document.querySelector("#objectionRemaining").textContent = String(objectionRemaining);
  document.querySelector("#sendObjection").disabled = !(currentPlayerAlive && (game.phase === "lobby" || game.phase === "day") && objectionRemaining > 0);
  document.querySelector("#sendRoomEndVote").disabled = !(currentPlayerAlive && (game.phase === "lobby" || game.phase === "day") && !(game.roomEndVotedPlayerIds || []).includes(currentPlayerId));
  document.querySelector("#sendGmChat").disabled = !isGm;
  document.querySelector("#sendGmWhisper").disabled = !isGm || game.players.length === 0;
  document.querySelector("#gmAdvancePhase").disabled = !isGm || !(game.phase === "day" || game.phase === "night");
  document.querySelector("#gmEndGame").disabled = !isGm || !(game.phase === "day" || game.phase === "night");
  document.querySelector("#gmKillPlayer").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.players.length === 0;
  document.querySelector("#gmRevivePlayer").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.players.length === 0;
  document.querySelector("#gmSetRole").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.players.length === 0;
  document.querySelector("#gmEnableFlag").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.players.length === 0;
  document.querySelector("#gmDisableFlag").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.players.length === 0;
  document.querySelector("#gmEnableCommonVoice").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || game.commonTalkVisible;
  document.querySelector("#gmDisableCommonVoice").disabled = !isGm || !(game.phase === "day" || game.phase === "night") || !game.commonTalkVisible;
  document.querySelector("#gmRestrictWolf").checked = channelRestrictions.wolf === true;
  document.querySelector("#gmRestrictCommon").checked = channelRestrictions.common === true;
  document.querySelector("#gmRestrictLovers").checked = channelRestrictions.lovers === true;
  document.querySelector("#gmRestrictFox").checked = channelRestrictions.fox === true;
  document.querySelector("#gmSetChannelRestrictions").disabled = !isGm || !(game.phase === "day" || game.phase === "night");
  document.querySelector("#setLastWords").disabled = !(currentPlayerAlive && game.phase !== "lobby" && game.phase !== "ended");
  const players = document.querySelector("#players");
  const playerGrid = document.querySelector("#playerGrid");
  const gmWhisperTarget = document.querySelector("#gmWhisperTarget");
  players.innerHTML = "";
  playerGrid.innerHTML = "";
  gmWhisperTarget.innerHTML = "";
  const voteTargets = game.votes || {};
  const votedPlayerIds = new Set(game.votedPlayerIds || []);
  const lobbyStartVotedPlayerIds = new Set(game.lobbyStartVotedPlayerIds || []);
  const lobbyKickVoteTargets = new Map((game.lobbyKickVoteTargets || []).map((target) => [target.targetPlayerId, target.votedPlayerIds || []]));
  const voteSummary = {};
  Object.entries(voteTargets).forEach(([voterId, targetId]) => {
    const voter = game.players.find((candidate) => candidate.playerId === voterId);
    if (!voter) return;
    if (!voteSummary[targetId]) voteSummary[targetId] = [];
    voteSummary[targetId].push(voter.nickname);
  });
  updateVoteReminder(game, currentPlayer, currentPlayerAlive, votedPlayerIds);
  appendVoteObserverPanel(players, game, currentPlayer, currentPlayerDead, voteSummary, votedPlayerIds);
  let row;
  game.players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.playerId;
    option.textContent = player.nickname;
    gmWhisperTarget.appendChild(option);
    if (!row || row.children.length >= 5) {
      row = document.createElement("tr");
      playerGrid.appendChild(row);
    }
    const card = document.createElement("td");
    card.className = "player-card" +
      (lobbyStartVotedPlayerIds.has(player.playerId) ? " start-voted" : "") +
      (votedPlayerIds.has(player.playerId) ? " voted" : "") +
      (player.alive ? "" : " dead");
    const initial = (player.nickname || "?").slice(0, 1);
    const cardTable = document.createElement("table");
    const cardRow = document.createElement("tr");
    const iconCell = document.createElement("td");
    iconCell.className = "player-icon";
    appendPlayerIcon(iconCell, player, initial);
    const nameCell = document.createElement("td");
    nameCell.className = "player-name";
    const marker = document.createElement("font");
    marker.color = "#666666";
    marker.textContent = "◆";
    const profileLink = document.createElement("a");
    profileLink.href = "/player/" + player.playerId;
    profileLink.textContent = player.nickname;
    const tripLink = document.createElement("a");
    tripLink.href = "/trips";
    tripLink.textContent = "Trip";
    tripLink.title = "Trip查詢";
    const status = document.createElement("span");
    status.textContent = player.alive ? "(生存中)" : "(死亡)";
    nameCell.append(marker, profileLink, "　[", tripLink, "]", document.createElement("br"), status);
    if (revealedRoles[player.playerId]) {
      const roleText = document.createElement("small");
      const revealedRole = revealedRoles[player.playerId];
      const iconPath = roleIconPath(revealedRole);
      roleText.className = "revealed-role role-" + revealedRole;
      roleText.append(" [");
      if (iconPath) {
        roleText.append(referenceImage(iconPath, roleLabel(revealedRole)));
      }
      roleText.append(roleLabel(revealedRole) + "]");
      nameCell.append(roleText);
    }
    if (voteSummary[player.playerId] && voteSummary[player.playerId].length) {
      const votes = document.createElement("small");
      votes.textContent = "投票：" + voteSummary[player.playerId].join(", ");
      nameCell.append(document.createElement("br"), votes);
    }
    if (game.phase === "lobby" && lobbyKickVoteTargets.has(player.playerId)) {
      const kickVotes = document.createElement("small");
      kickVotes.textContent = "踢出投票：" + lobbyKickVoteTargets.get(player.playerId).length + "票";
      nameCell.append(document.createElement("br"), kickVotes);
    }
    cardRow.append(iconCell, nameCell);
    cardTable.appendChild(cardRow);
    card.appendChild(cardTable);
    row.appendChild(card);
    const button = document.createElement("button");
    const canKickVoteLobby = game.phase === "lobby" && currentPlayer && !isGm && player.playerId !== currentPlayerId;
    button.textContent = canManageLobby && player.playerId !== currentPlayerId ? "踢 " + player.nickname : canKickVoteLobby ? "踢票 " + player.nickname : (player.alive ? "" : "× ") + player.nickname;
    const catReviveTarget = game.phase === "night" && game.day > 1 && role === "cat" && !player.alive;
    button.disabled =
      (!actorCanAct && !(canManageLobby && player.playerId !== currentPlayerId) && !canKickVoteLobby) ||
      (game.phase === "night" && role === "cat" && !catReviveTarget) ||
      (!player.alive && !catReviveTarget) ||
      player.playerId === currentPlayerId ||
      game.phase === "ended";
    if (!player.alive) {
      button.className = "dead";
    }
    button.addEventListener("click", () => {
      if (!latestGame) return;
      if (latestGame.phase === "lobby") {
        sendCommand({ type: canManageLobby ? "kick_player" : "kick_vote", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "day") {
        sendCommand({ type: "vote", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "night" && isWolfRole(role)) {
        sendCommand({ type: "night_kill", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "night" && role === "seer") {
        sendCommand({ type: "divine", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "night" && role === "child_fox") {
        sendCommand({ type: "child_fox_divine", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "night" && role === "guard") {
        sendCommand({ type: "guard", targetPlayerId: player.playerId });
      } else if (latestGame.phase === "night" && role === "cat") {
        sendCommand({ type: "cat_revive", targetPlayerId: player.playerId });
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
  renderLastWordsPanel(game);
}

})();
`;
