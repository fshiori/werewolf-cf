import type { BbsReplySummary, BbsTopicSummary, FederatedRoomSummary, GameRecordSummary, LeaderboardEntry, PlayerRole, RoomEventSummary, RoomSummary, WinRateEntry } from "./types";
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
      background-image: url("/assets/reference/img/top_bg.jpg");
      color: #000000;
      font: 14px "Times New Roman", "PMingLiU", "Noto Serif TC", serif;
    }
    body.room-phase-lobby {
      background: seashell;
      background-image: none;
      color: black;
    }
    body.room-phase-day {
      background: floralwhite;
      background-image: none;
      color: black;
    }
    body.room-phase-night {
      background: #000030;
      background-image: none;
      color: snow;
    }
    body.room-phase-ended {
      background: aliceblue;
      background-image: none;
      color: black;
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
    .title-img { border: 0; vertical-align: middle; margin-right: 6px; max-width: 100%; height: auto; }
    .subtitle { text-align: right; font-weight: bold; }
    .side { width: 190px; padding: 8px 0 0 8px; vertical-align: top; }
    .main { padding: 8px 16px 24px 18px; vertical-align: top; }
    .menu-box { width: 140px; border: 1px solid #cc3300; }
    .menu-box th { background: #ccffcc; padding: 5px; }
    .menu-list td { padding: 2px 3px; }
    .room-link { color: #cc3300; display: block; margin-bottom: 8px; }
    .room-link > a { color: #cc3300; }
    .room-line { font-size: 16px; }
    .room-comment { display: block; text-align: right; margin-left: 100px; color: #333333; overflow-wrap: anywhere; word-break: break-word; }
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
    .ref-icon { width: 16px; height: 16px; border: 0; vertical-align: text-bottom; margin-right: 2px; }
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
    .player-card { width: 148px; border: 1px solid #b0b0b0; background: #fafafa; table-layout: fixed; }
    .player-card.voted { background: #d0ffff; }
    body.room-phase-night .player-card.voted { background: #004000; color: snow; }
    body.room-phase-night .player-card.voted a { color: #ccffff; }
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
    .player-name { padding-left: 5px; max-width: 96px; overflow-wrap: anywhere; word-break: break-word; }
    .revealed-role { font-weight: bold; }
    .role-villager, .role-medium, .role-common { color: #0066cc; }
    .role-werewolf, .role-big_wolf { color: #cc0000; }
    .role-seer, .role-guard { color: #660099; }
    .role-madman, .role-betrayer { color: #cc6600; }
    .role-fox, .role-child_fox { color: #990099; }
    .role-poison, .role-cat { color: #008800; }
    .dead { background: #303030; color: #dddddd; text-decoration: line-through; }
    #chatLog {
      height: 280px;
      overflow: auto;
      background: #ffffff;
      font-size: 12pt;
      font-family: "PMingLiU", "Noto Serif TC", serif;
    }
    #chatLog div, #gameLog div { border-top: 1px dashed silver; padding: 2px 4px; overflow-wrap: anywhere; word-break: break-word; }
    #gameLog { max-height: 140px; overflow: auto; background: #ffffff; }
    #players button { margin: 2px 4px 2px 0; min-width: 7em; text-align: left; }
    .transcript-row td { border-top: 1px dashed silver; }
    .transcript-location-system td, .transcript-location-game td { background: #efefef; font-weight: bold; }
    .transcript-location-wolf td { background: #000030; color: #ffccff; }
    .transcript-location-common td, .transcript-location-fox td, .transcript-location-lovers td { background: #000030; color: #ccffcc; }
    .transcript-location-self td { background: #000030; color: snow; }
    .transcript-location-dead td { background: #cccccc; color: #000000; }
    .transcript-location-gm td, .transcript-location-gm-whisper td { color: #cc0000; }
    .transcript-location-vote td { background: #999900; color: snow; font-weight: bold; }
    .transcript-location-kill td { background: #cc3300; color: snow; font-weight: bold; }
    .transcript-location-divination td { background: #990099; color: snow; font-weight: bold; }
    .transcript-location-guard td { background: #0099ff; color: snow; font-weight: bold; }
    .transcript-location-cat td { background: #006633; color: snow; font-weight: bold; }
    .location-badge { white-space: nowrap; font-size: 10pt; }
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
          <a href="/" class="title"><img class="title-img" src="/assets/reference/img/top_title.jpg" alt="汝等是人是狼？">汝等是人是狼？</a>
          <div class="subtitle">Werewolf Cloudflare Port</div>
        </td>
      </tr>
      <tr>
        <td class="side">
          <table class="menu-box"><tr><th>選單</th></tr></table>
          <table class="menu-list">
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/">首頁</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/list">聯合列表</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/logs">過去紀錄</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/leaderboard">戰績排行榜</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/stats">勝率分析</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/icons">頭像一覽</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/trip">身份登錄</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/trips">Trip查詢</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/bbs">人狼討論</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/status">伺服器狀態</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/rules">規則</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/script-info">Script Info</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/protocol">通訊協定</a></td></tr>
            <tr><td><small><font color="#666666">・</font></small></td><td><a href="/version">版本</a></td></tr>
          </table>
        </td>
        <td class="main">${body}</td>
      </tr>
    </table>
  `;
}

const DEFAULT_ANNOUNCEMENT = "目前支援建立村子、即時聊天、白天投票、夜晚行動與自動換日。";

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function roleLabel(value: unknown): string {
  const labels: Record<PlayerRole, string> = {
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
  };
  return typeof value === "string" && value in labels ? labels[value as PlayerRole] : typeof value === "string" ? value : "不明";
}

function winnerLabel(value: unknown): string {
  if (value === "villagers") {
    return "村民";
  }
  if (value === "werewolves") {
    return "人狼";
  }
  if (value === "foxes") {
    return "妖狐";
  }
  if (value === "lovers") {
    return "戀人";
  }
  return "未定";
}

function winnerIconPath(value: unknown): string {
  if (value === "villagers") {
    return "img/victory_role_human.gif";
  }
  if (value === "werewolves") {
    return "img/victory_role_wolf.gif";
  }
  if (value === "foxes") {
    return "img/victory_role_fox.gif";
  }
  if (value === "lovers") {
    return "img/victory_role_lovers.gif";
  }
  return "img/victory_role_draw.gif";
}

function formatGameRecord(record: GameRecordSummary): string {
  const result = recordValue(record.result);
  const winner = winnerLabel(result.winner);
  const day = typeof result.day === "number" ? String(result.day) : "?";
  const players = Array.isArray(result.players) ? result.players.length : 0;
  return `${record.createdAt}　${winner}勝利　第 ${day} 日　${players} 人`;
}

function formatGameRecordHtml(record: GameRecordSummary): string {
  const result = recordValue(record.result);
  const winner = winnerLabel(result.winner);
  return `${referenceAssetImg(winnerIconPath(result.winner), `${winner}勝利`)}${escapeHtml(formatGameRecord(record))}`;
}

function formatEventPayload(payload: unknown): string {
  const value = recordValue(payload);
  const fields = [
    typeof value.name === "string" ? `村名:${value.name}` : "",
    typeof value.comment === "string" && value.comment ? `說明:${value.comment}` : "",
    typeof value.nickname === "string" ? `發言:${value.nickname}` : "",
    typeof value.text === "string" ? `內容:${value.text}` : "",
    typeof value.winner === "string" ? `勝利:${winnerLabel(value.winner)}` : "",
    typeof value.day === "number" ? `第${value.day}日` : "",
    typeof value.players === "number" ? `${value.players}人` : "",
    typeof value.targetPlayerId === "string" ? `對象:${value.targetPlayerId}` : "",
    typeof value.targetNickname === "string" ? `對象名:${value.targetNickname}` : "",
    typeof value.remaining === "number" ? `剩餘:${value.remaining}` : "",
    typeof value.result === "string" ? `結果:${value.result}` : "",
    typeof value.phase === "string" ? `階段:${value.phase}` : "",
    typeof value.role === "string" ? `角色:${roleLabel(value.role)}` : ""
  ].filter(Boolean);
  return fields.length ? fields.join("　") : "";
}

function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    public_chat: "公開發言",
    wolf_chat: "狼人密談",
    fox_chat: "妖狐密談",
    common_chat: "共有密談",
    lovers_chat: "戀人密談",
    dead_chat: "靈界發言",
    self_talk: "自言自語",
    gm_chat: "GM 發言",
    gm_whisper: "GM 密語",
    day_vote: "白天投票",
    night_kill: "襲擊",
    divination: "占卜",
    child_fox_divination: "子狐占卜",
    guard: "護衛",
    cat_revive: "貓又復活",
    objection: "提出反對",
    lobby_start_vote: "開始投票",
    lobby_kick_vote: "踢人投票",
    player_left: "退出",
    game_started: "遊戲開始",
    game_ended: "遊戲結束",
    gm_advanced_phase: "GM 推進",
    gm_ended_game: "GM 結束",
    gm_set_alive: "GM 生死調整",
    gm_set_role: "GM 角色調整",
    gm_set_flag: "GM 旗標調整",
    gm_set_common_voice: "GM 共有公開調整",
    gm_set_channel_restrictions: "GM 頻道限制調整",
    player_kicked: "踢出玩家",
    room_created: "村子建立"
  };
  return labels[eventType] ?? eventType;
}

function eventDayLabel(event: RoomEventSummary): string {
  const value = recordValue(event.payload);
  const day = typeof value.day === "number" ? `第 ${value.day} 日` : "系統";
  const phase = value.phase === "day" ? "白天" : value.phase === "night" ? "夜晚" : "";
  return phase ? `${day} ${phase}` : day;
}

function eventSpeakerLabel(event: RoomEventSummary): string {
  const value = recordValue(event.payload);
  if (typeof value.nickname === "string" && value.nickname) {
    return value.nickname;
  }
  return event.playerId ?? "系統";
}

function transcriptLocation(event: RoomEventSummary): { className: string; label: string } {
  const value = recordValue(event.payload);
  const phase = value.phase === "night" ? "夜晚" : value.phase === "day" ? "白天" : "";
  const locations: Record<string, { className: string; label: string }> = {
    public_chat: { className: "transcript-location-public", label: phase ? `${phase}公開` : "公開" },
    wolf_chat: { className: "transcript-location-wolf", label: "人狼密談" },
    fox_chat: { className: "transcript-location-fox", label: "妖狐密談" },
    common_chat: { className: "transcript-location-common", label: "共有密談" },
    lovers_chat: { className: "transcript-location-lovers", label: "戀人密談" },
    dead_chat: { className: "transcript-location-dead", label: "靈界" },
    self_talk: { className: "transcript-location-self", label: "自言自語" },
    gm_chat: { className: "transcript-location-gm", label: "GM廣播" },
    gm_whisper: { className: "transcript-location-gm-whisper", label: "GM密語" },
    day_vote: { className: "transcript-location-vote", label: "處刑投票" },
    night_kill: { className: "transcript-location-kill", label: "襲擊行動" },
    divination: { className: "transcript-location-divination", label: "占卜行動" },
    child_fox_divination: { className: "transcript-location-divination", label: "子狐占卜" },
    guard: { className: "transcript-location-guard", label: "護衛行動" },
    cat_revive: { className: "transcript-location-cat", label: "復活行動" },
    objection: { className: "transcript-location-system", label: "系統" },
    lobby_start_vote: { className: "transcript-location-system", label: "等待室" },
    lobby_kick_vote: { className: "transcript-location-system", label: "等待室" },
    player_left: { className: "transcript-location-system", label: "系統" },
    player_kicked: { className: "transcript-location-system", label: "系統" },
    room_created: { className: "transcript-location-system", label: "系統" },
    game_started: { className: "transcript-location-game", label: "遊戲" },
    game_ended: { className: "transcript-location-game", label: "遊戲" },
    gm_advanced_phase: { className: "transcript-location-gm", label: "GM操作" },
    gm_ended_game: { className: "transcript-location-gm", label: "GM操作" },
    gm_set_alive: { className: "transcript-location-gm", label: "GM操作" },
    gm_set_role: { className: "transcript-location-gm", label: "GM操作" },
    gm_set_flag: { className: "transcript-location-gm", label: "GM操作" },
    gm_set_common_voice: { className: "transcript-location-gm", label: "GM操作" },
    gm_set_channel_restrictions: { className: "transcript-location-gm", label: "GM操作" }
  };
  return locations[event.eventType] ?? { className: "transcript-location-system", label: phase || "系統" };
}

function voteRoundLabel(value: Record<string, unknown>): string {
  const revoteCount = typeof value.revoteCount === "number" ? value.revoteCount : 0;
  return revoteCount > 0 ? `再投票 ${revoteCount}` : "第一回";
}

function renderTranscriptVoteTables(events: RoomEventSummary[]): string {
  const voteEvents = events.filter((event) => event.eventType === "day_vote");
  if (voteEvents.length === 0) {
    return `<tr><td colspan="5" class="muted">尚無投票紀錄。</td></tr>`;
  }

  const groups = new Map<string, RoomEventSummary[]>();
  for (const event of voteEvents) {
    const value = recordValue(event.payload);
    const day = typeof value.day === "number" ? value.day : 0;
    const revoteCount = typeof value.revoteCount === "number" ? value.revoteCount : 0;
    const key = `${String(day).padStart(4, "0")}:${String(revoteCount).padStart(4, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, groupEvents]) => {
    const first = recordValue(groupEvents[0]?.payload);
    const day = typeof first.day === "number" ? first.day : undefined;
    const label = day ? `第 ${day} 日 ${voteRoundLabel(first)}` : voteRoundLabel(first);
    const rows = [...groupEvents].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((event) => {
      const value = recordValue(event.payload);
      const voter = typeof value.nickname === "string" && value.nickname ? value.nickname : event.playerId ?? "不明";
      const target = typeof value.targetNickname === "string" && value.targetNickname
        ? value.targetNickname
        : typeof value.targetPlayerId === "string"
          ? value.targetPlayerId
          : "不明";
      return `<tr>
        <td>${escapeHtml(voter)}</td>
        <td>→</td>
        <td>${escapeHtml(target)}</td>
        <td>${escapeHtml(event.createdAt)}</td>
      </tr>`;
    }).join("");
    return `
      <tr><td colspan="5"><strong>${escapeHtml(label)}</strong></td></tr>
      <tr><td colspan="5">
        <table class="form-table" style="margin:6px 0 12px 18px;">
          <thead><tr><td><strong>投票者</strong></td><td></td><td><strong>投票先</strong></td><td><strong>時間</strong></td></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </td></tr>`;
  }).join("");
}

function renderTranscriptEventSections(events: RoomEventSummary[]): string {
  if (events.length === 0) {
    return `<tr><td colspan="5" class="muted">尚無事件履歷。</td></tr>`;
  }

  const groups = new Map<string, RoomEventSummary[]>();
  for (const event of events) {
    const label = eventDayLabel(event);
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([label, groupEvents]) => `
    <tr><td colspan="5"><strong>${escapeHtml(label)}</strong></td></tr>
    ${groupEvents.map((event) => {
      const location = transcriptLocation(event);
      return `<tr class="transcript-row ${location.className}">
      <td>${escapeHtml(event.createdAt)}</td>
      <td><span class="location-badge">${escapeHtml(location.label)}</span></td>
      <td>${escapeHtml(eventTypeLabel(event.eventType))}</td>
      <td>${escapeHtml(eventSpeakerLabel(event))}</td>
      <td>${escapeHtml(formatEventPayload(event.payload))}</td>
    </tr>`;
    }).join("")}
  `).join("");
}

export type RoomTranscriptViewOptions = {
  heavenTalk?: boolean;
  heavenOnly?: boolean;
  reverseLog?: boolean;
  viewerMode?: "legacy" | "public" | "player" | "dead" | "gm";
  viewerPlayerId?: string;
};

const transcriptSystemEventTypes = new Set([
  "objection",
  "lobby_start_vote",
  "lobby_kick_vote",
  "player_left",
  "player_kicked",
  "room_created",
  "game_started",
  "game_ended",
  "gm_advanced_phase",
  "gm_ended_game",
  "gm_set_alive",
  "gm_set_role",
  "gm_set_flag",
  "gm_set_common_voice",
  "gm_set_channel_restrictions"
]);

function isHeavenTranscriptEvent(event: RoomEventSummary): boolean {
  return event.eventType === "dead_chat";
}

function isSystemTranscriptEvent(event: RoomEventSummary): boolean {
  return !event.playerId || transcriptSystemEventTypes.has(event.eventType);
}

function isPrivateTranscriptEvent(event: RoomEventSummary): boolean {
  const value = recordValue(event.payload);
  return value.visibility === "private";
}

function isViewerOwnedTranscriptEvent(event: RoomEventSummary, viewerPlayerId?: string): boolean {
  return Boolean(viewerPlayerId && event.playerId === viewerPlayerId);
}

function filterTranscriptEventsByViewer(events: RoomEventSummary[], options: RoomTranscriptViewOptions): RoomEventSummary[] {
  const mode = options.viewerMode ?? "legacy";
  if (mode === "legacy" || mode === "gm") {
    return events;
  }
  return events.filter((event) => {
    if (!isPrivateTranscriptEvent(event)) {
      return true;
    }
    if (mode === "dead") {
      return isHeavenTranscriptEvent(event) || isSystemTranscriptEvent(event);
    }
    if (mode === "player") {
      return isViewerOwnedTranscriptEvent(event, options.viewerPlayerId);
    }
    return isSystemTranscriptEvent(event);
  });
}

function filterTranscriptEvents(events: RoomEventSummary[], options: RoomTranscriptViewOptions): RoomEventSummary[] {
  const viewerEvents = filterTranscriptEventsByViewer(events, options);
  const filtered = options.heavenOnly
    ? viewerEvents.filter((event) => isHeavenTranscriptEvent(event) || isSystemTranscriptEvent(event))
    : options.heavenTalk
      ? viewerEvents
      : viewerEvents.filter((event) => !isHeavenTranscriptEvent(event));
  return options.reverseLog ? [...filtered].reverse() : filtered;
}

function referenceAssetImg(path: string, alt: string): string {
  return `<img class="ref-icon" src="/assets/reference/${escapeHtml(path)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}">`;
}

function optionMark(label: string, iconPath?: string): string {
  return `<span class="option-mark">${iconPath ? referenceAssetImg(iconPath, label) : ""}${escapeHtml(label)}</span>`;
}

function channelRestrictionOptionMark(room: RoomSummary): string {
  const restrictions = room.options.channelRestrictions;
  if (!restrictions || !(restrictions.wolf || restrictions.common || restrictions.lovers || restrictions.fox)) {
    return "";
  }
  const labels = [
    restrictions.wolf ? "狼" : "",
    restrictions.common ? "共" : "",
    restrictions.lovers ? "戀" : "",
    restrictions.fox ? "狐" : ""
  ].filter(Boolean).join("/");
  return optionMark(`頻道限:${labels}`);
}

function roomStatusIcon(status: RoomSummary["status"]): string {
  if (status === "lobby") {
    return referenceAssetImg("img/waiting.gif", "募集中");
  }
  if (status === "playing") {
    return referenceAssetImg("img/playing.gif", "遊戲中");
  }
  return referenceAssetImg("img/endroom.gif", "終了");
}

function maxPlayersMark(maxPlayers: number): string {
  const iconPath = [8, 16, 22, 23, 30].includes(maxPlayers) ? `img/max${maxPlayers}.gif` : undefined;
  return optionMark(`最大${String(maxPlayers)}`, iconPath);
}

function federatedStatusLabel(status: RoomSummary["status"]): string {
  if (status === "playing") {
    return "遊戲中";
  }
  if (status === "ended") {
    return "終了";
  }
  return "募集中";
}

function federatedRoomValue(room: RoomSummary | FederatedRoomSummary): FederatedRoomSummary {
  if ("roomUrl" in room) {
    return room;
  }
  return { ...room, serverName: "本伺服器", serverUrl: "/", roomUrl: `/room/${room.id}`, local: true };
}

export function renderFederatedList(rooms: Array<RoomSummary | FederatedRoomSummary>): string {
  const rows = rooms.length
    ? rooms.map((value) => {
      const room = federatedRoomValue(value);
      const label = federatedStatusLabel(room.status);
      const boldStart = room.status === "lobby" ? "<b>" : "";
      const boldEnd = room.status === "lobby" ? "</b>" : "";
      return `<tr>
        <td width="70">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 15px;">${escapeHtml(label)}</font></a>${boldEnd}</td>
        <td width="120">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 15px;">[${escapeHtml(room.id)}]</font></a>${boldEnd}</td>
        <td width="250">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 15px;">${escapeHtml(room.name)}村</font></a>${boldEnd}</td>
        <td>${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 12px;">${escapeHtml(room.comment)}</font></a>${boldEnd}</td>
        <td width="80">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 13px;">人數${escapeHtml(String(room.maxPlayers))}</font></a>${boldEnd}</td>
        <td width="120"><a href="${escapeHtml(room.serverUrl)}">${escapeHtml(room.serverName)}${room.local ? " / 本伺服器" : ""}</a></td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="6" class="muted">目前沒有可列出的村子。</td></tr>`;

  return page("Federated List", shell(`
    <fieldset>
      <legend><strong>聯合遊戲列表</strong></legend>
      <div style="line-height:135%;margin:20px 20px 30px;">
        <strong>
          <table style="width: 100%">
            <tr><td>服務中</td><td colspan="5"><a href="/">本伺服器 / Cloudflare Workers</a></td></tr>
            <tr><td colspan="6"><hr></td></tr>
            ${rows}
          </table>
        </strong>
      </div>
    </fieldset>
  `));
}

export function renderOldLogs(rooms: RoomSummary[]): string {
  const rows = rooms.length
    ? rooms.map((room) => {
      const roomUrl = `/room/${escapeHtml(room.id)}/log`;
      const optionMarks = [
        room.options.realTime ? optionMark("限時", "img/room_option_real_time.gif") : "",
        room.options.poison ? optionMark("埋毒", "img/room_option_poison.gif") : "",
        room.options.bigWolf ? optionMark("大狼", "img/room_option_wfbig.gif") : "",
        room.options.lovers ? optionMark("戀人", "img/room_option_lovers.gif") : "",
        room.options.betrayer ? optionMark("背德", "img/room_option_betr.gif") : "",
        room.options.childFox ? optionMark("子狐", "img/room_option_fosi.gif") : "",
        room.options.twoFoxes ? optionMark("雙狐", "img/room_option_foxs.gif") : "",
        room.options.cat ? optionMark("貓又", "img/room_option_cat.gif") : "",
        room.options.deadRoleVisible ? optionMark("靈視", "img/room_option_rei.gif") : "",
        room.options.openVote ? optionMark("公開票", "img/room_option_open_vote.gif") : "",
        room.options.commonTalkVisible ? optionMark("共有聲", "img/room_option_common.gif") : "",
        channelRestrictionOptionMark(room),
        room.options.voteStatus ? optionMark("投票済", "img/conn_look.gif") : ""
      ].filter(Boolean).join(" ");
      return `<tr>
        <td align="right" class="row">${escapeHtml(room.id)}</td>
        <td align="right" class="row">
          <a href="${roomUrl}">${escapeHtml(room.name)} 村</a>
          <small>(<a href="${roomUrl}?reverse_log=on">逆</a>
          <a href="${roomUrl}?heaven_talk=on">靈</a>
          <a href="${roomUrl}?reverse_log=on&heaven_talk=on">逆&amp;靈</a>
          <a href="${roomUrl}?heaven_only=on">逝</a>
          <a href="${roomUrl}?reverse_log=on&heaven_only=on">逆&amp;逝</a>)</small>
        </td>
        <td align="right" class="row"><small>${escapeHtml(room.createdAt)}</small></td>
        <td align="right" class="row">${escapeHtml(String(room.maxPlayers))}</td>
        <td class="row">${optionMarks || "<br>"}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="muted">沒有遊戲紀錄</td></tr>`;

  return page("Old Logs", shell(`
    <fieldset>
      <legend><strong>過去紀錄</strong></legend>
      <p><a href="/">←返回</a> <a href="/logs?all=1">[全部顯示]</a></p>
      <table class="form-table" border="1" cellspacing="1" bgcolor="#CCCCCC" style="margin:12px auto 18px;">
        <thead><tr><th class="column">村No</th><th class="column">村名</th><th class="column">結束時間</th><th class="column">人數</th><th class="column">選項</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
  `));
}

function readRecordPlayers(record: GameRecordSummary): Record<string, unknown>[] {
  const result = recordValue(record.result);
  return Array.isArray(result.players)
    ? result.players.filter((player): player is Record<string, unknown> => typeof player === "object" && player !== null && !Array.isArray(player))
    : [];
}

function playerRecordLabel(player: Record<string, unknown>): string {
  const nickname = typeof player.nickname === "string" && player.nickname ? player.nickname : "";
  const playerId = typeof player.playerId === "string" ? player.playerId : "unknown";
  return nickname ? `${nickname} (${playerId})` : playerId;
}

export function renderLeaderboard(entries: LeaderboardEntry[]): string {
  const rows = entries.length
    ? entries.map((entry) => `<tr>
        <td>${escapeHtml(String(entry.rank))}</td>
        <td><a href="/player/${escapeHtml(entry.playerId)}">${escapeHtml(entry.playerId)}</a></td>
        <td>${escapeHtml(String(entry.wins))}</td>
        <td>${escapeHtml(String(entry.losses))}</td>
        <td>${escapeHtml(String(entry.gamesPlayed))}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="muted">尚無戰績。</td></tr>`;

  return page("Leaderboard", shell(`
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
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
  `));
}

export function renderWinRateAnalysis(entries: WinRateEntry[]): string {
  const total = entries[0]?.total ?? 0;
  const rows = entries.map((entry) => `<tr>
    <td>－${escapeHtml(entry.label)}－</td>
    <td>${escapeHtml(String(entry.wins))} / ${escapeHtml(String(entry.total))}</td>
    <td>勝率 ${escapeHtml(entry.rate.toFixed(2))} %</td>
  </tr>`).join("");

  return page("Win Rate Analysis", shell(`
    <fieldset>
      <legend><strong>勝率分析</strong></legend>
      <p>以下統計目前保存的結束村勝利分析，不包含未結束村。</p>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tr><td><strong>　統計場數：</strong></td><td colspan="2">${escapeHtml(String(total))}</td></tr>
        ${rows || `<tr><td colspan="3" class="muted">尚無勝率資料。</td></tr>`}
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>資料來源</strong></legend>
      <table class="form-table">
        <tr><td><strong>　Records：</strong></td><td><code>game_records.result_json</code></td></tr>
        <tr><td><strong>　JSON：</strong></td><td><code>/api/stats/win-rate</code></td></tr>
        <tr><td><strong>　排行榜：</strong></td><td><a href="/leaderboard">戰績排行榜</a></td></tr>
      </table>
    </fieldset>
  `));
}

export function renderRoomRecords(roomId: string, records: GameRecordSummary[]): string {
  const rows = records.length
    ? records.map((record) => `<tr>
        <td>${escapeHtml(record.createdAt)}</td>
        <td>${formatGameRecordHtml(record)}</td>
      </tr>`).join("")
    : `<tr><td colspan="2" class="muted">尚無對局紀錄。</td></tr>`;

  return page(`Room ${roomId} Records`, shell(`
    <fieldset>
      <legend><strong>村子對局紀錄</strong></legend>
      <table class="form-table">
        <tr><td><strong>　村子：</strong></td><td><a href="/room/${escapeHtml(roomId)}">${escapeHtml(roomId)}</a></td></tr>
      </table>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead><tr><td><strong>時間</strong></td><td><strong>結果</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
  `));
}

export function renderRoomEvents(roomId: string, events: RoomEventSummary[]): string {
  const rows = events.length
    ? events.map((event) => `<tr>
        <td>${escapeHtml(event.createdAt)}</td>
        <td>${escapeHtml(event.eventType)}</td>
        <td>${event.playerId ? escapeHtml(event.playerId) : `<span class="muted">系統</span>`}</td>
        <td>${escapeHtml(formatEventPayload(event.payload))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="muted">尚無事件。</td></tr>`;

  return page(`Room ${roomId} Events`, shell(`
    <fieldset>
      <legend><strong>村子事件履歷</strong></legend>
      <table class="form-table">
        <tr><td><strong>　村子：</strong></td><td><a href="/room/${escapeHtml(roomId)}">${escapeHtml(roomId)}</a></td></tr>
      </table>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead><tr><td><strong>時間</strong></td><td><strong>事件</strong></td><td><strong>玩家</strong></td><td><strong>內容</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
  `));
}

export function renderRoomTranscript(roomId: string, records: GameRecordSummary[], events: RoomEventSummary[], options: RoomTranscriptViewOptions = {}): string {
  const visibleEvents = filterTranscriptEvents(events, options);
  const recordSections = records.length
    ? records.map((record) => {
      const players = readRecordPlayers(record);
      const playerRows = players.length
        ? players.map((player) => `<tr>
            <td>${escapeHtml(playerRecordLabel(player))}</td>
            <td>${escapeHtml(roleLabel(player.role))}</td>
            <td>${player.alive === false ? `<font color="#990000">死亡</font>` : "生存"}</td>
          </tr>`).join("")
        : `<tr><td colspan="3" class="muted">未保存玩家明細。</td></tr>`;

      return `<tr>
        <td colspan="4">
          <strong>${formatGameRecordHtml(record)}</strong>
          <table class="form-table" style="margin:6px 0 12px 18px;">
            <thead><tr><td><strong>玩家</strong></td><td><strong>職業</strong></td><td><strong>結局</strong></td></tr></thead>
            <tbody>${playerRows}</tbody>
          </table>
        </td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="4" class="muted">尚無對局結果。</td></tr>`;

  const eventRows = renderTranscriptEventSections(visibleEvents);
  const voteRows = renderTranscriptVoteTables(visibleEvents);
  const viewerMode = options.viewerMode ?? "legacy";
  const modeLabel = options.heavenOnly ? "逝者靈界" : options.heavenTalk ? "含靈界" : "通常";
  const viewerLabel = {
    legacy: "結束後全紀錄",
    public: "旁觀",
    player: options.viewerPlayerId ? `玩家 ${options.viewerPlayerId}` : "玩家",
    dead: "靈界",
    gm: "GM"
  }[viewerMode];
  const reverseSuffix = options.reverseLog ? "&reverse_log=on" : "";
  const heavenParam = options.heavenTalk ? "&heaven_talk=on" : options.heavenOnly ? "&heaven_only=on" : "";

  return page(`Room ${roomId} Log`, shell(`
    <fieldset>
      <legend><strong>村子完整紀錄</strong></legend>
      <table class="form-table">
        <tr><td><strong>　村子：</strong></td><td><a href="/room/${escapeHtml(roomId)}">${escapeHtml(roomId)}</a></td></tr>
        <tr><td><strong>　索引：</strong></td><td><a href="/room/${escapeHtml(roomId)}/records">對局紀錄</a>　<a href="/room/${escapeHtml(roomId)}/events">事件履歷</a></td></tr>
        <tr><td><strong>　表示：</strong></td><td>${escapeHtml(modeLabel)}　<a href="/room/${escapeHtml(roomId)}/log">通常</a>　<a href="/room/${escapeHtml(roomId)}/log?heaven_talk=on${reverseSuffix}">靈</a>　<a href="/room/${escapeHtml(roomId)}/log?heaven_only=on${reverseSuffix}">逝</a>　<a href="/room/${escapeHtml(roomId)}/log?reverse_log=on${heavenParam}">逆</a>　<a href="/room/${escapeHtml(roomId)}/log?reverse_log=on&heaven_talk=on">逆&amp;靈</a>　<a href="/room/${escapeHtml(roomId)}/log?reverse_log=on&heaven_only=on">逆&amp;逝</a></td></tr>
        <tr><td><strong>　視點：</strong></td><td>${escapeHtml(viewerLabel)}　<a href="/room/${escapeHtml(roomId)}/log?viewer=public">旁觀</a>　<a href="/room/${escapeHtml(roomId)}/log?viewer=dead&heaven_talk=on">靈界</a>　<a href="/room/${escapeHtml(roomId)}/log?viewer=gm&heaven_talk=on">GM</a>　<small class="muted">玩家視點需指定 <code>viewer=player&amp;viewer_player_id=player_id</code></small></td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>對局結果</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tbody>${recordSections}</tbody>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>投票紀錄</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tbody>${voteRows}</tbody>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>事件履歷</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead><tr><td><strong>時間</strong></td><td><strong>位置</strong></td><td><strong>種類</strong></td><td><strong>發言/行動</strong></td><td><strong>內容</strong></td></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>
    </fieldset>
  `));
}

export function renderStatus(status: {
  ok: boolean;
  checks: Record<string, boolean>;
  homeAnnouncement?: string | null;
  maintenanceMode: boolean;
}): string {
  const checkRows = Object.entries(status.checks).map(([name, ok]) => `<tr>
    <td><strong>　${escapeHtml(name)}：</strong></td>
    <td>${ok ? `<font color="#008800">正常</font>` : `<font color="#cc0000">異常</font>`}</td>
  </tr>`).join("");

  return page("Status", shell(`
    <fieldset>
      <legend><strong>伺服器狀態</strong></legend>
      <table class="form-table">
        <tr>
          <td><strong>　總狀態：</strong></td>
          <td>${status.ok ? `<font color="#008800">正常運作</font>` : `<font color="#cc0000">需要確認</font>`}</td>
        </tr>
        <tr>
          <td><strong>　維護模式：</strong></td>
          <td>${status.maintenanceMode ? `<font color="#cc0000">啟用</font>` : "未啟用"}</td>
        </tr>
        <tr>
          <td><strong>　公告：</strong></td>
          <td>${status.homeAnnouncement ? escapeHtml(status.homeAnnouncement) : `<span class="muted">使用預設公告</span>`}</td>
        </tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>Binding 檢查</strong></legend>
      <table class="form-table">
        ${checkRows}
      </table>
    </fieldset>
  `));
}

export function renderAdminRoomsLogin(): string {
  return page("Room Admin", shell(`
    <fieldset>
      <legend><strong>廢村管理</strong></legend>
      <table class="form-table">
        <tr><td><label><strong>　管理密碼：</strong></label></td><td><input id="roomAdminToken" type="password" maxlength="128" size="24"> <button id="roomAdminLogin">登入</button></td></tr>
        <tr><td></td><td class="muted">輸入後會開啟管理清單。</td></tr>
      </table>
    </fieldset>
    <script>
      const tokenInput = document.querySelector("#roomAdminToken");
      tokenInput.value = localStorage.getItem("werewolf_cf_room_admin_token") || "";
      document.querySelector("#roomAdminLogin").addEventListener("click", () => {
        const token = tokenInput.value;
        localStorage.setItem("werewolf_cf_room_admin_token", token);
        location.href = "/admin/rooms?token=" + encodeURIComponent(token);
      });
    </script>
  `));
}

export function renderAdminRooms(rooms: RoomSummary[]): string {
  const rows = rooms.length
    ? rooms.map((room) => `<tr>
        <td><a href="/room/${escapeHtml(room.id)}">${escapeHtml(room.id)}</a></td>
        <td>${escapeHtml(room.name)}村</td>
        <td>${escapeHtml(room.status)}</td>
        <td>${escapeHtml(room.createdAt)}</td>
        <td><button class="adminEndRoom" data-room-id="${escapeHtml(room.id)}">廢村</button></td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="muted">目前沒有可廢除的村。</td></tr>`;

  return page("Room Admin", shell(`
    <fieldset>
      <legend><strong>廢村管理</strong></legend>
      <p class="muted">請選擇要廢除的村。注意！一旦選擇將無法復原。</p>
      <table class="form-table" style="margin:12px 20px 18px;width:100%">
        <thead><tr><td><strong>村ID</strong></td><td><strong>村名</strong></td><td><strong>狀態</strong></td><td><strong>建立時間</strong></td><td><strong>操作</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p id="roomAdminStatus" class="muted"></p>
    </fieldset>
    <script>
      const roomAdminToken = new URLSearchParams(location.search).get("token") || localStorage.getItem("werewolf_cf_room_admin_token") || "";
      if (roomAdminToken) localStorage.setItem("werewolf_cf_room_admin_token", roomAdminToken);
      document.querySelectorAll(".adminEndRoom").forEach((button) => {
        button.addEventListener("click", async () => {
          const status = document.querySelector("#roomAdminStatus");
          const roomId = button.dataset.roomId;
          status.textContent = "更新中";
          const res = await fetch("/api/admin/rooms/" + encodeURIComponent(roomId), {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-room-admin-token": roomAdminToken },
            body: JSON.stringify({ status: "ended" })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            status.textContent = data.error || "廢村失敗";
            return;
          }
          location.reload();
        });
      });
    </script>
  `));
}

export function renderIconCatalog(): string {
  const icons = [
    { file: "001.gif", name: "明灰", color: "#DDDDDD" },
    { file: "002.gif", name: "暗灰", color: "#999999" },
    { file: "003.gif", name: "黃色", color: "#FFD700" },
    { file: "004.gif", name: "橙色", color: "#FF9900" },
    { file: "005.gif", name: "紅色", color: "#FF0000" },
    { file: "006.gif", name: "水色", color: "#99CCFF" },
    { file: "007.gif", name: "藍色", color: "#0066FF" },
    { file: "008.gif", name: "綠色", color: "#00EE00" },
    { file: "009.gif", name: "紫色", color: "#CC00CC" },
    { file: "010.gif", name: "櫻色", color: "#FF9999" }
  ];
  const rows = icons.map((icon, index) => {
    const path = `user_icon/${icon.file}`;
    return `<tr>
      <td>${escapeHtml(String(index + 1))}</td>
      <td><img src="/assets/reference/${escapeHtml(path)}" alt="${escapeHtml(icon.name)}" title="${escapeHtml(icon.name)}" width="32" height="32"></td>
      <td>${escapeHtml(icon.name)}</td>
      <td><font color="${escapeHtml(icon.color)}">◆</font> ${escapeHtml(icon.color)}</td>
      <td><code>${escapeHtml(path)}</code></td>
    </tr>`;
  }).join("");

  return page("Icons", shell(`
    <fieldset>
      <legend><strong>頭像一覽</strong></legend>
      <table class="form-table">
        <tr><td><strong>　來源：</strong></td><td>Reference default icons copied to R2 under <code>reference/user_icon/</code>.</td></tr>
        <tr><td><strong>　尺寸：</strong></td><td>32 x 32</td></tr>
      </table>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead><tr><td><strong>No.</strong></td><td><strong>圖</strong></td><td><strong>名稱</strong></td><td><strong>色碼</strong></td><td><strong>R2 path</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>上傳頭像</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　玩家ID：</strong></label></td>
          <td><input id="iconUploadPlayerId" maxlength="64" size="28"> <span id="iconUploadStatus" class="muted"></span></td>
        </tr>
        <tr>
          <td><label><strong>　頭像：</strong></label></td>
          <td><input id="iconUploadFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="28"> <button id="iconUploadButton">上傳</button> <button id="iconRemoveButton">刪頭像</button> <small class="muted">PNG/JPEG/GIF/WebP 512KiB以下</small></td>
        </tr>
      </table>
    </fieldset>
    <script>
      const iconUploadPlayerId = document.querySelector("#iconUploadPlayerId");
      const iconUploadFile = document.querySelector("#iconUploadFile");
      const iconUploadStatus = document.querySelector("#iconUploadStatus");
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      iconUploadPlayerId.value = localStorage.getItem(playerKey);
      document.querySelector("#iconUploadButton").addEventListener("click", async () => {
        if (!iconUploadFile.files.length) {
          iconUploadStatus.textContent = "請選擇檔案";
          return;
        }
        if (iconUploadFile.files[0].size > 512 * 1024) {
          iconUploadStatus.textContent = "頭像需小於 512KiB";
          return;
        }
        const form = new FormData();
        form.set("playerId", iconUploadPlayerId.value);
        form.set("avatar", iconUploadFile.files[0]);
        const res = await fetch("/api/assets/avatar", { method: "POST", body: form });
        const data = await res.json();
        iconUploadStatus.textContent = res.ok ? "上傳完成" : data.error || "上傳失敗";
      });
      document.querySelector("#iconRemoveButton").addEventListener("click", async () => {
        const res = await fetch("/api/assets/avatar", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerId: iconUploadPlayerId.value })
        });
        const data = await res.json();
        iconUploadStatus.textContent = res.ok ? "刪除完成" : data.error || "刪除失敗";
      });
    </script>
  `));
}

export function renderHome(rooms: RoomSummary[], announcement = DEFAULT_ANNOUNCEMENT, maintenanceMode = false): string {
  const roomRows = rooms.length === 0
    ? `<div class="muted">目前沒有村子。</div>`
    : rooms.map((room) => {
      const status = escapeHtml(room.status);
      const optionMarks = [
        room.options.realTime ? optionMark(`限時 ${String(room.options.dayMinutes)}/${String(room.options.nightMinutes)}`, "img/room_option_real_time.gif") : optionMark("即時", "img/room_option_real_time.gif"),
        room.options.poison ? optionMark("埋毒", "img/room_option_poison.gif") : "",
        room.options.bigWolf ? optionMark("大狼", "img/room_option_wfbig.gif") : "",
        room.options.authority ? optionMark("權力", "img/room_option_authority.gif") : "",
        room.options.decider ? optionMark("決定", "img/room_option_decide.gif") : "",
        room.options.lovers ? optionMark("戀人", "img/room_option_lovers.gif") : "",
        room.options.betrayer ? optionMark("背德", "img/room_option_betr.gif") : "",
        room.options.childFox ? optionMark("子狐", "img/room_option_fosi.gif") : "",
        room.options.twoFoxes ? optionMark("雙狐", "img/room_option_foxs.gif") : "",
        room.options.cat ? optionMark("貓又", "img/room_option_cat.gif") : "",
        room.options.lastWords ? optionMark("遺言", "img/room_option_will.gif") : "",
        room.options.openVote ? optionMark("公開票", "img/room_option_open_vote.gif") : "",
        room.options.commonTalkVisible ? optionMark("共有聲", "img/room_option_common.gif") : "",
        room.options.deadRoleVisible ? optionMark("靈視", "img/room_option_rei.gif") : "",
        room.options.wishRole ? optionMark("希望", "img/room_option_wish_role.gif") : "",
        room.options.tripRequired ? optionMark("Trip限定", "img/room_option_trip.gif") : "",
        room.options.gmEnabled ? optionMark("GM制", "img/room_option_gm.gif") : "",
        channelRestrictionOptionMark(room),
        room.options.dummyBoy ? optionMark("替身", "img/room_option_dummy_boy.gif") : "",
        room.options.customDummy ? optionMark("自訂替身", "img/room_option_dummy_boy.gif") : "",
        room.options.selfVote ? optionMark("自投", "img/room_option_voteme.gif") : "",
        room.options.voteStatus ? optionMark("投票済", "img/conn_look.gif") : ""
      ].filter(Boolean).join(" ");
      return `<div class="room-link">
        <a href="/room/${escapeHtml(room.id)}"><span class="room-line"><span class="status status-${status}">${roomStatusIcon(room.status)}${status}</span><small>[${escapeHtml(room.id)}]</small> ${escapeHtml(room.name)}村</span></a>
        <small> <a href="/room/${escapeHtml(room.id)}">入村</a></small>
        <small class="room-comment">${room.comment ? `～${escapeHtml(room.comment)}～ ` : ""}${maxPlayersMark(room.maxPlayers)} ～建立時間：${escapeHtml(room.createdAt)}～ ${optionMarks}</small>
      </div>`;
    }).join("");

  return page("Werewolf CF", shell(`
    <fieldset>
      <legend><strong>伺服器公告</strong></legend>
      <div style="line-height:135%;margin:12px 20px 18px;">
        <strong>Cloudflare Workers / D1 / Durable Objects 移植進行中。</strong><br>
        <span class="muted">${escapeHtml(announcement)}</span>
        ${maintenanceMode ? `<br><strong><font color="#cc0000">目前維護中，暫停建立新村。</font></strong>` : ""}
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
      <legend><strong>Trip登記</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　Trip：</strong></label></td>
          <td><input id="registerTrip" maxlength="32" size="28"> <button id="registerTripButton">身份登錄</button> <button id="claimTripButton">認領身份</button> <span id="registerTripStatus" class="muted"></span></td>
        </tr>
        <tr>
          <td><label><strong>　排除Trip：</strong></label></td>
          <td><input id="excludeTrip" maxlength="32" size="12"> <input id="excludeTripReason" maxlength="120" size="28"> <button id="excludeTripButton">排除紀錄</button> <button id="removeTripExclusionButton">解除排除</button> <span id="excludeTripStatus" class="muted"></span></td>
        </tr>
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
          <td><label><strong>　村子說明：</strong></label></td>
          <td><input id="roomComment" maxlength="120" size="50"></td>
        </tr>
        <tr>
          <td><label><strong>　最大人數：</strong></label></td>
          <td>
            <select id="maxPlayers">
              <optgroup label="最大人數">
                <option value="8">8</option>
                <option value="16">16</option>
                <option value="22" selected>22</option>
                <option value="30">30</option>
              </optgroup>
            </select>
          </td>
        </tr>
        <tr>
          <td><label><strong>　限時時間：</strong></label></td>
          <td>
            <label><input id="optionRealTime" type="checkbox"> <small>日：</small></label>
            <input id="optionDayMinutes" type="number" min="1" max="99" step="0.5" value="3" size="4">
            <small>分　夜：</small>
            <input id="optionNightMinutes" type="number" min="1" max="99" step="0.5" value="1.5" size="4">
            <small>分</small>
          </td>
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
          <td>
            <label><input id="optionFoxNone" name="optionFoxVariant" type="radio" checked> <small>追加なし</small></label>
            <label><input id="optionBetrayer" name="optionFoxVariant" type="radio"> <small>背德者登場，妖狐死亡時跟隨死亡</small></label>
          </td>
        </tr>
        <tr>
          <td><label><strong>　20人以上妖狐的占：</strong></label></td>
          <td><label><input id="optionChildFox" name="optionFoxVariant" type="radio"> <small>子狐登場，可於夜晚占卜但可能失敗</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　20人以上兩隻妖狐：</strong></label></td>
          <td><label><input id="optionTwoFoxes" name="optionFoxVariant" type="radio"> <small>第二隻妖狐登場</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　20人以上貓又登場：</strong></label></td>
          <td><label><input id="optionCat" type="checkbox"> <small>貓又登場，可牽連死亡並嘗試復活</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　遺言：</strong></label></td>
          <td><label><input id="optionLastWords" type="checkbox"> <small>生存中可留下死亡時公開的遺言</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　公開投票：</strong></label></td>
          <td><label><input id="optionOpenVote" type="checkbox"> <small>白天公開目前投票目標</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　共生者夜晚對話顯示：</strong></label></td>
          <td><label><input id="optionCommonTalkVisible" type="checkbox"> <small>允許晚上顯示共生者悄悄話</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　幽靈是否可以看角色：</strong></label></td>
          <td><label><input id="optionDeadRoleVisible" type="checkbox"> <small>允許幽靈觀看角色</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　希望角色制：</strong></label></td>
          <td><label><input id="optionWishRole" type="checkbox"> <small>允許加入時選擇希望角色</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　啟用強制Trip登記：</strong></label></td>
          <td><label><input id="optionTripRequired" type="checkbox"> <small>沒有英數 Trip 身分碼將無法登錄成村民</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　啟用GM系統：</strong></label></td>
          <td><label><input id="optionGmEnabled" type="checkbox"> <small>指定 Trip 進房後成為 GM，不加入角色分配</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　GM Trip：</strong></label></td>
          <td><input id="gmTrip" maxlength="32" size="10"></td>
        </tr>
        <tr>
          <td><label><strong>　替身君：</strong></label></td>
          <td><label><input id="optionDummyBoy" type="checkbox"> <small>加入替身君並從第一夜開始</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　替身君自訂：</strong></label></td>
          <td><label><input id="optionCustomDummy" type="checkbox"> <small>自訂替身君名稱及遺言</small></label></td>
        </tr>
        <tr>
          <td></td>
          <td><input id="dummyName" maxlength="32" size="10" value="替身君"> <small>的遺言</small></td>
        </tr>
        <tr>
          <td></td>
          <td><textarea id="dummyLastWords" maxlength="500" cols="38" rows="4"></textarea></td>
        </tr>
        <tr>
          <td><label><strong>　啟用白天自投功能：</strong></label></td>
          <td><label><input id="optionSelfVote" type="checkbox"> <small>允許玩家白天投票給自己</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　啟用白天投票顯示：</strong></label></td>
          <td><label><input id="optionVoteStatus" type="checkbox"> <small>已投票玩家以特殊底色顯示</small></label></td>
        </tr>
        <tr>
          <td></td>
          <td><button id="createRoom"${maintenanceMode ? " disabled" : ""}>建立房間</button></td>
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
      document.querySelector("#registerTrip").value = localStorage.getItem("werewolf_cf_trip") || "";
      document.querySelector("#registerTripButton").addEventListener("click", async () => {
        const trip = document.querySelector("#registerTrip").value;
        const status = document.querySelector("#registerTripStatus");
        localStorage.setItem("werewolf_cf_trip", trip);
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "登記完成" : data.error || "登記失敗";
      });
      document.querySelector("#claimTripButton").addEventListener("click", async () => {
        const trip = document.querySelector("#registerTrip").value;
        const nickname = document.querySelector("#nickname").value;
        const status = document.querySelector("#registerTripStatus");
        localStorage.setItem("werewolf_cf_trip", trip);
        const res = await fetch("/api/trips/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerId: localStorage.getItem(playerKey), nickname, trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "認領完成" : data.error || "認領失敗";
      });
      document.querySelector("#excludeTripButton").addEventListener("click", async () => {
        const trip = document.querySelector("#excludeTrip").value;
        const reason = document.querySelector("#excludeTripReason").value;
        const status = document.querySelector("#excludeTripStatus");
        const res = await fetch("/api/trips/exclusions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip, reason })
        });
        const data = await res.json();
        status.textContent = res.ok ? "排除完成" : data.error || "排除失敗";
      });
      document.querySelector("#removeTripExclusionButton").addEventListener("click", async () => {
        const trip = document.querySelector("#excludeTrip").value;
        const status = document.querySelector("#excludeTripStatus");
        const res = await fetch("/api/trips/exclusions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "解除完成" : data.error || "解除失敗";
      });
      document.querySelector("#createRoom").addEventListener("click", async () => {
        const nickname = document.querySelector("#nickname").value;
        const name = document.querySelector("#roomName").value;
        const comment = document.querySelector("#roomComment").value;
        const maxPlayers = Number(document.querySelector("#maxPlayers").value);
        const poison = document.querySelector("#optionPoison").checked;
        const bigWolf = document.querySelector("#optionBigWolf").checked;
        const authority = document.querySelector("#optionAuthority").checked;
        const decider = document.querySelector("#optionDecider").checked;
        const lovers = document.querySelector("#optionLovers").checked;
        const betrayer = document.querySelector("#optionBetrayer").checked;
        const childFox = document.querySelector("#optionChildFox").checked;
        const twoFoxes = document.querySelector("#optionTwoFoxes").checked;
        const cat = document.querySelector("#optionCat").checked;
        const lastWords = document.querySelector("#optionLastWords").checked;
        const openVote = document.querySelector("#optionOpenVote").checked;
        const commonTalkVisible = document.querySelector("#optionCommonTalkVisible").checked;
        const deadRoleVisible = document.querySelector("#optionDeadRoleVisible").checked;
        const wishRole = document.querySelector("#optionWishRole").checked;
        const tripRequired = document.querySelector("#optionTripRequired").checked;
        const gmEnabled = document.querySelector("#optionGmEnabled").checked;
        const gmTrip = document.querySelector("#gmTrip").value;
        const dummyBoy = document.querySelector("#optionDummyBoy").checked;
        const customDummy = document.querySelector("#optionCustomDummy").checked;
        const dummyName = document.querySelector("#dummyName").value;
        const dummyLastWords = document.querySelector("#dummyLastWords").value;
        const realTime = document.querySelector("#optionRealTime").checked;
        const dayMinutes = Number(document.querySelector("#optionDayMinutes").value);
        const nightMinutes = Number(document.querySelector("#optionNightMinutes").value);
        const selfVote = document.querySelector("#optionSelfVote").checked;
        const voteStatus = document.querySelector("#optionVoteStatus").checked;
        localStorage.setItem("werewolf_cf_nickname", nickname);
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, comment, maxPlayers, playerId: localStorage.getItem(playerKey), nickname, options: { poison, bigWolf, authority, decider, lovers, betrayer, childFox, twoFoxes, cat, lastWords, openVote, commonTalkVisible, deadRoleVisible, wishRole, tripRequired, gmEnabled, gmTrip, dummyBoy, customDummy, dummyName, dummyLastWords, realTime, dayMinutes, nightMinutes, selfVote, voteStatus } })
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
            const values = [entry.rank, entry.playerId, entry.wins, entry.losses, entry.gamesPlayed];
            values.forEach((value, index) => {
              const cell = document.createElement("td");
              if (index === 1) {
                const link = document.createElement("a");
                link.href = "/player/" + entry.playerId;
                link.textContent = String(value);
                cell.appendChild(link);
              } else {
                cell.textContent = String(value);
              }
              row.append(cell);
            });
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

export function renderPlayerProfile(playerId: string): string {
  return page(`Player ${playerId}`, shell(`
    <fieldset>
      <legend><strong>個人戰績</strong></legend>
      <table class="form-table">
        <tr>
          <td><strong>　玩家：</strong></td>
          <td><span id="profilePlayerId">${escapeHtml(playerId)}</span></td>
        </tr>
        <tr>
          <td><strong>　頭像：</strong></td>
          <td><img id="profileAvatar" src="/assets/avatar/${escapeHtml(playerId)}" alt="" width="42" height="42"></td>
        </tr>
        <tr>
          <td><strong>　戰績：</strong></td>
          <td><span id="profileStats" class="muted">讀取中</span></td>
        </tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>最近參戰紀錄</strong></legend>
      <div id="profileRecords" class="muted">讀取中</div>
    </fieldset>
    <script>
      const playerId = ${JSON.stringify(playerId)};
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
      document.querySelector("#profileAvatar").addEventListener("error", (event) => {
        event.currentTarget.remove();
      });
      async function refreshProfile() {
        const statsTarget = document.querySelector("#profileStats");
        const recordsTarget = document.querySelector("#profileRecords");
        try {
          const res = await fetch("/api/players/" + playerId + "/stats");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "stats failed");
          statsTarget.textContent = data.stats.gamesPlayed + " 戰 " + data.stats.wins + " 勝 " + data.stats.losses + " 敗";
        } catch {
          statsTarget.textContent = "戰績讀取失敗。";
        }
        try {
          const res = await fetch("/api/players/" + playerId + "/records");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "records failed");
          if (!data.records.length) {
            recordsTarget.textContent = "尚無紀錄。";
            return;
          }
          recordsTarget.innerHTML = "";
          data.records.forEach((record) => {
            const div = document.createElement("div");
            const winner = record.winner || "unknown";
            const day = record.day || "?";
            div.textContent = record.createdAt + "　[" + record.roomId + "] " + winner + " 勝　第 " + day + " 日　" + roleLabel(record.role);
            recordsTarget.appendChild(div);
          });
        } catch {
          recordsTarget.textContent = "紀錄讀取失敗。";
        }
      }
      void refreshProfile();
    </script>
  `));
}

export function renderTripLookup(): string {
  return page("Trip Lookup", shell(`
    <fieldset>
      <legend><strong>Trip查詢</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　Trip：</strong></label></td>
          <td><input id="tripLookup" maxlength="32" size="28"> <button id="tripLookupButton">查詢</button> <span id="tripLookupStatus" class="muted"></span></td>
        </tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>Trip公開資料</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tbody id="tripLookupRows"><tr><td class="muted">尚未查詢。</td></tr></tbody>
      </table>
    </fieldset>
    <script>
      const tripInput = document.querySelector("#tripLookup");
      const tripStatus = document.querySelector("#tripLookupStatus");
      const tripRows = document.querySelector("#tripLookupRows");
      function escapeClientHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      }
      tripInput.value = localStorage.getItem("werewolf_cf_trip") || "";
      document.querySelector("#tripLookupButton").addEventListener("click", async () => {
        const trip = tripInput.value;
        localStorage.setItem("werewolf_cf_trip", trip);
        tripStatus.textContent = "查詢中";
        tripRows.innerHTML = '<tr><td class="muted">讀取中...</td></tr>';
        try {
          const res = await fetch("/api/trips/lookup?trip=" + encodeURIComponent(trip));
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "lookup failed");
          const value = data.trip;
          const players = value.players.length
            ? value.players.map((playerId) => '<a href="/player/' + encodeURIComponent(playerId) + '">' + escapeClientHtml(playerId) + '</a>').join("　")
            : '<span class="muted">尚無認領玩家。</span>';
          tripRows.innerHTML = [
            '<tr><td><strong>　登記：</strong></td><td>' + (value.registered ? "已登記" : "未登記") + '</td></tr>',
            '<tr><td><strong>　排除：</strong></td><td>' + (value.excluded ? '<font color="#990000">已排除</font>' : "未排除") + '</td></tr>',
            '<tr><td><strong>　玩家：</strong></td><td>' + players + '</td></tr>',
            '<tr><td><strong>　戰績：</strong></td><td>勝 ' + value.stats.wins + '　敗 ' + value.stats.losses + '　場數 ' + value.stats.gamesPlayed + '</td></tr>'
          ].join("");
          tripStatus.textContent = "完成";
        } catch (error) {
          tripRows.innerHTML = '<tr><td class="muted">查詢失敗。</td></tr>';
          tripStatus.textContent = error instanceof Error ? error.message : "查詢失敗";
        }
      });
    </script>
  `));
}

export function renderTripRegistration(): string {
  return page("Trip Registration", shell(`
    <fieldset>
      <legend><strong>身份登錄</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　玩家暱稱：</strong></label></td>
          <td><input id="tripNickname" maxlength="32" size="28"></td>
        </tr>
        <tr>
          <td><label><strong>　Trip：</strong></label></td>
          <td><input id="registerTrip" maxlength="32" size="28"> <button id="registerTripButton">身份登錄</button> <button id="claimTripButton">認領身份</button> <span id="registerTripStatus" class="muted"></span></td>
        </tr>
        <tr>
          <td><label><strong>　排除Trip：</strong></label></td>
          <td><input id="excludeTrip" maxlength="32" size="12"> <input id="excludeTripReason" maxlength="120" size="28"> <button id="excludeTripButton">排除紀錄</button> <button id="removeTripExclusionButton">解除排除</button> <span id="excludeTripStatus" class="muted"></span></td>
        </tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>Trip公開資料</strong></legend>
      <table class="form-table">
        <tr>
          <td><label><strong>　Trip：</strong></label></td>
          <td><input id="tripLookup" maxlength="32" size="28"> <button id="tripLookupButton">查詢</button> <span id="tripLookupStatus" class="muted"></span></td>
        </tr>
      </table>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tbody id="tripLookupRows"><tr><td class="muted">尚未查詢。</td></tr></tbody>
      </table>
    </fieldset>
    <script>
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      const registerTripInput = document.querySelector("#registerTrip");
      const tripLookupInput = document.querySelector("#tripLookup");
      const savedTrip = localStorage.getItem("werewolf_cf_trip") || "";
      document.querySelector("#tripNickname").value = localStorage.getItem("werewolf_cf_nickname") || "";
      registerTripInput.value = savedTrip;
      tripLookupInput.value = savedTrip;
      function escapeClientHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      }
      document.querySelector("#registerTripButton").addEventListener("click", async () => {
        const trip = registerTripInput.value;
        const status = document.querySelector("#registerTripStatus");
        localStorage.setItem("werewolf_cf_trip", trip);
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "登記完成" : data.error || "登記失敗";
      });
      document.querySelector("#claimTripButton").addEventListener("click", async () => {
        const trip = registerTripInput.value;
        const nickname = document.querySelector("#tripNickname").value || "Trip玩家";
        const status = document.querySelector("#registerTripStatus");
        localStorage.setItem("werewolf_cf_trip", trip);
        localStorage.setItem("werewolf_cf_nickname", nickname);
        const res = await fetch("/api/trips/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerId: localStorage.getItem(playerKey), nickname, trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "認領完成" : data.error || "認領失敗";
      });
      document.querySelector("#excludeTripButton").addEventListener("click", async () => {
        const trip = document.querySelector("#excludeTrip").value;
        const reason = document.querySelector("#excludeTripReason").value;
        const status = document.querySelector("#excludeTripStatus");
        const res = await fetch("/api/trips/exclusions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip, reason })
        });
        const data = await res.json();
        status.textContent = res.ok ? "排除完成" : data.error || "排除失敗";
      });
      document.querySelector("#removeTripExclusionButton").addEventListener("click", async () => {
        const trip = document.querySelector("#excludeTrip").value;
        const status = document.querySelector("#excludeTripStatus");
        const res = await fetch("/api/trips/exclusions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip })
        });
        const data = await res.json();
        status.textContent = res.ok ? "解除完成" : data.error || "解除失敗";
      });
      document.querySelector("#tripLookupButton").addEventListener("click", async () => {
        const trip = tripLookupInput.value;
        const tripStatus = document.querySelector("#tripLookupStatus");
        const tripRows = document.querySelector("#tripLookupRows");
        localStorage.setItem("werewolf_cf_trip", trip);
        tripStatus.textContent = "查詢中";
        tripRows.innerHTML = '<tr><td class="muted">讀取中...</td></tr>';
        try {
          const res = await fetch("/api/trips/lookup?trip=" + encodeURIComponent(trip));
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "lookup failed");
          const value = data.trip;
          const players = value.players.length
            ? value.players.map((playerId) => '<a href="/player/' + encodeURIComponent(playerId) + '">' + escapeClientHtml(playerId) + '</a>').join("　")
            : '<span class="muted">尚無認領玩家。</span>';
          tripRows.innerHTML = [
            '<tr><td><strong>　登記：</strong></td><td>' + (value.registered ? "已登記" : "未登記") + '</td></tr>',
            '<tr><td><strong>　排除：</strong></td><td>' + (value.excluded ? '<font color="#990000">已排除</font>' : "未排除") + '</td></tr>',
            '<tr><td><strong>　玩家：</strong></td><td>' + players + '</td></tr>',
            '<tr><td><strong>　戰績：</strong></td><td>勝 ' + value.stats.wins + '　敗 ' + value.stats.losses + '　場數 ' + value.stats.gamesPlayed + '</td></tr>'
          ].join("");
          tripStatus.textContent = "完成";
        } catch (error) {
          tripRows.innerHTML = '<tr><td class="muted">查詢失敗。</td></tr>';
          tripStatus.textContent = error instanceof Error ? error.message : "查詢失敗";
        }
      });
    </script>
  `));
}

export function renderBbs(topics: BbsTopicSummary[], options: { digestOnly?: boolean } = {}): string {
  const topicRows = topics.length
    ? topics.map((topic) => {
      const title = `${topic.pinned ? "[置頂] " : ""}${topic.locked ? "[鎖定] " : ""}${topic.title}${topic.digest ? " (精華)" : ""}`;
      return `<tr>
        <td align="center"><a href="/bbs?view=${escapeHtml(String(topic.id))}">${escapeHtml(String(topic.id))}</a></td>
        <td><a href="/bbs?view=${escapeHtml(String(topic.id))}">${escapeHtml(title)}</a></td>
        <td>${escapeHtml(topic.name)}${topic.trip ? "◆Trip" : ""}</td>
        <td align="center">${escapeHtml(String(topic.replyCount))}</td>
        <td>${escapeHtml(topic.updatedAt)}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="muted">${options.digestOnly ? "尚無精華主題。" : "尚無主題。"}</td></tr>`;
  const listTitle = options.digestOnly ? "精華主題列表" : "主題列表";

  return page("BBS", shell(`
    <p><a href="#bbsPostForm">發表主題</a> <a href="/bbs">全部主題</a> <a href="/bbs?digest=1">精華主題</a></p>
    <fieldset>
      <legend><strong>${listTitle}</strong></legend>
      <div style="line-height:135%;margin:20px 20px 30px;">
        <strong>
          <table class="form-table" style="width:100%">
            <thead><tr><td><strong>No.</strong></td><td><strong>標題</strong></td><td><strong>作者</strong></td><td><strong>回覆</strong></td><td><strong>更新</strong></td></tr></thead>
            <tbody>${topicRows}</tbody>
          </table>
        </strong>
      </div>
    </fieldset>
    <fieldset id="bbsPostForm">
      <legend><strong>發表主題</strong></legend>
      <table class="form-table">
        <tr><td><label><strong>　名稱：</strong></label></td><td><input id="bbsName" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　Trip：</strong></label></td><td><input id="bbsTrip" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　標題：</strong></label></td><td><input id="bbsTitle" maxlength="50" size="48"></td></tr>
        <tr><td><label><strong>　內容：</strong></label></td><td><textarea id="bbsMessage" rows="5" cols="64"></textarea></td></tr>
        <tr><td></td><td><button id="bbsPostButton">發表主題</button> <span id="bbsPostStatus" class="muted"></span></td></tr>
      </table>
    </fieldset>
    <script>
      document.querySelector("#bbsName").value = localStorage.getItem("werewolf_cf_nickname") || "";
      document.querySelector("#bbsTrip").value = localStorage.getItem("werewolf_cf_trip") || "";
      document.querySelector("#bbsPostButton").addEventListener("click", async () => {
        const status = document.querySelector("#bbsPostStatus");
        const name = document.querySelector("#bbsName").value;
        const trip = document.querySelector("#bbsTrip").value;
        localStorage.setItem("werewolf_cf_nickname", name);
        localStorage.setItem("werewolf_cf_trip", trip);
        status.textContent = "送出中";
        const res = await fetch("/api/bbs/topics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            trip,
            title: document.querySelector("#bbsTitle").value,
            message: document.querySelector("#bbsMessage").value
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "發表失敗";
          return;
        }
        location.href = "/bbs";
      });
    </script>
  `));
}

function bbsAuthorLabel(name: string, trip: boolean): string {
  return `${escapeHtml(name)}${trip ? "◆Trip" : ""}`;
}

export function renderBbsTopic(topic: BbsTopicSummary, replies: BbsReplySummary[]): string {
  const replyRows = replies.length
    ? replies.map((reply, index) => `<tr>
        <td valign="top" align="right"><strong>${escapeHtml(String(index + 1))}</strong></td>
        <td>
          <div><strong>${bbsAuthorLabel(reply.name, reply.trip)}</strong> <span class="muted">${escapeHtml(reply.createdAt)}</span></div>
          <div style="white-space:pre-wrap;margin:6px 0 10px;">${escapeHtml(reply.message)}</div>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="2" class="muted">尚無回覆。</td></tr>`;

  const title = `${topic.pinned ? "[置頂] " : ""}${topic.locked ? "[鎖定] " : ""}${topic.title}${topic.digest ? " (精華)" : ""}`;
  const replyForm = topic.locked
    ? `<p class="muted">此主題已鎖定。</p>`
    : `<table class="form-table">
        <tr><td><label><strong>　名稱：</strong></label></td><td><input id="bbsReplyName" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　Trip：</strong></label></td><td><input id="bbsReplyTrip" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　內容：</strong></label></td><td><textarea id="bbsReplyMessage" rows="5" cols="64"></textarea></td></tr>
        <tr><td></td><td><button id="bbsReplyButton">回覆</button> <span id="bbsReplyStatus" class="muted"></span></td></tr>
      </table>
      <script>
        document.querySelector("#bbsReplyName").value = localStorage.getItem("werewolf_cf_nickname") || "";
        document.querySelector("#bbsReplyTrip").value = localStorage.getItem("werewolf_cf_trip") || "";
        document.querySelector("#bbsReplyButton").addEventListener("click", async () => {
          const status = document.querySelector("#bbsReplyStatus");
          const name = document.querySelector("#bbsReplyName").value;
          const trip = document.querySelector("#bbsReplyTrip").value;
          localStorage.setItem("werewolf_cf_nickname", name);
          localStorage.setItem("werewolf_cf_trip", trip);
          status.textContent = "送出中";
          const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/replies", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name,
              trip,
              message: document.querySelector("#bbsReplyMessage").value
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            status.textContent = data.error || "回覆失敗";
            return;
          }
          location.href = "/bbs?view=${escapeHtml(String(topic.id))}";
        });
      </script>`;
  const moderationPanel = `<table class="form-table">
      <tr><td><label><strong>　管理密碼：</strong></label></td><td><input id="bbsAdminToken" type="password" maxlength="128" size="32"></td></tr>
      <tr><td><strong>　項目：</strong></td><td>
        <label><input id="bbsModeratePinned" type="checkbox"${topic.pinned ? " checked" : ""}> 置頂</label>
        <label><input id="bbsModerateLocked" type="checkbox"${topic.locked ? " checked" : ""}> 鎖定</label>
        <label><input id="bbsModerateDigest" type="checkbox"${topic.digest ? " checked" : ""}> 精華</label>
      </td></tr>
      <tr><td></td><td><button id="bbsModerateButton">更新</button> <span id="bbsModerateStatus" class="muted"></span></td></tr>
    </table>
    <script>
      document.querySelector("#bbsAdminToken").value = localStorage.getItem("werewolf_cf_bbs_admin_token") || "";
      document.querySelector("#bbsModerateButton").addEventListener("click", async () => {
        const status = document.querySelector("#bbsModerateStatus");
        const token = document.querySelector("#bbsAdminToken").value;
        localStorage.setItem("werewolf_cf_bbs_admin_token", token);
        status.textContent = "更新中";
        const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/moderation", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-bbs-admin-token": token },
          body: JSON.stringify({
            pinned: document.querySelector("#bbsModeratePinned").checked,
            locked: document.querySelector("#bbsModerateLocked").checked,
            digest: document.querySelector("#bbsModerateDigest").checked
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "更新失敗";
          return;
        }
        location.href = "/bbs?view=${escapeHtml(String(topic.id))}";
      });
    </script>`;

  return page("BBS Topic", shell(`
    <p><a href="/bbs">全部主題</a> <a href="#bbsReplyForm">回覆主題</a></p>
    <fieldset>
      <legend><strong>${escapeHtml(title)}</strong></legend>
      <table class="form-table">
        <tr><td><strong>　作者：</strong></td><td>${bbsAuthorLabel(topic.name, topic.trip)}</td></tr>
        <tr><td><strong>　時間：</strong></td><td>${escapeHtml(topic.createdAt)}　更新 ${escapeHtml(topic.updatedAt)}</td></tr>
        <tr><td><strong>　狀態：</strong></td><td>${topic.pinned ? "置頂　" : ""}${topic.locked ? "鎖定　" : ""}${topic.digest ? "精華" : ""}${!topic.pinned && !topic.locked && !topic.digest ? "一般" : ""}</td></tr>
        <tr><td><strong>　本文：</strong></td><td><div style="white-space:pre-wrap;">${escapeHtml(topic.message)}</div></td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>回覆列表</strong></legend>
      <table class="form-table" style="margin:12px 20px 18px;">
        <tbody>${replyRows}</tbody>
      </table>
    </fieldset>
    <fieldset id="bbsReplyForm">
      <legend><strong>回覆主題</strong></legend>
      ${replyForm}
    </fieldset>
    <fieldset id="bbsModerationForm">
      <legend><strong>主題管理</strong></legend>
      ${moderationPanel}
    </fieldset>
  `));
}

export function renderRules(): string {
  return page("Rules", shell(`
    <fieldset>
      <legend><strong>基本流程</strong></legend>
      <table class="form-table">
        <tr><td><strong>　開始：</strong></td><td>房主或 GM 可在大廳開始遊戲，角色由村子選項與人數分配。</td></tr>
        <tr><td><strong>　白天：</strong></td><td>生存者公開討論並投票，最高票者處刑；同票會進行一次重新投票。</td></tr>
        <tr><td><strong>　夜晚：</strong></td><td>人狼襲擊，占卜師、獵人、子狐、貓又依角色使用能力。</td></tr>
        <tr><td><strong>　勝負：</strong></td><td>村民、人狼、妖狐、戀人依存活狀態判定勝利。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>角色</strong></legend>
      <table class="form-table">
        <tr><td><strong>　${referenceAssetImg("img/role_human.gif", "村民")}村民：</strong></td><td>沒有夜晚能力，透過白天投票找出人狼。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_wolf.gif", "人狼")}${referenceAssetImg("img/role_heavywolf.gif", "大狼")}人狼 / 大狼：</strong></td><td>夜晚選擇襲擊目標；大狼在占卜時可能被判定為人。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_mage.gif", "占卜師")}占卜師：</strong></td><td>夜晚占卜一名玩家，結果為人或狼。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_necromancer.gif", "靈能者")}靈能者：</strong></td><td>隔日得知前一天被處刑者是人或狼。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_mad.gif", "狂人")}狂人：</strong></td><td>隸屬村民計數，但勝利目標偏向人狼。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_guard.gif", "獵人")}獵人：</strong></td><td>夜晚護衛一名玩家，可阻止襲擊。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_common.gif", "共有者")}共有者：</strong></td><td>可在夜晚與其他共有者對話。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_fox.gif", "妖狐")}${referenceAssetImg("img/role_cult.gif", "背德者")}${referenceAssetImg("img/role_fosi.gif", "子狐")}妖狐 / 背德者 / 子狐：</strong></td><td>妖狐被襲擊不死；背德者跟隨妖狐死亡；子狐可嘗試占卜。</td></tr>
        <tr><td><strong>　${referenceAssetImg("img/role_poison.gif", "埋毒者")}${referenceAssetImg("img/role_cat.gif", "貓又")}埋毒者 / 貓又：</strong></td><td>死亡時可能牽連其他玩家；貓又可嘗試復活。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>村子選項</strong></legend>
      <table class="form-table">
        <tr><td><strong>　Trip限定：</strong></td><td>玩家必須使用已登記且未排除的 Trip 才能加入。</td></tr>
        <tr><td><strong>　GM制：</strong></td><td>指定 Trip 可作為 GM 加入，不參與角色分配，可管理流程。</td></tr>
        <tr><td><strong>　替身君：</strong></td><td>加入替身君並由第一夜開始，可自訂名稱與遺言。</td></tr>
        <tr><td><strong>　公開票 / 投票顯示：</strong></td><td>控制白天投票資訊是否公開與已投票玩家顯示。</td></tr>
        <tr><td><strong>　遺言 / 幽靈視角：</strong></td><td>控制死亡訊息與死後可見資訊。</td></tr>
        <tr><td><strong>　限時時間：</strong></td><td>啟用後 Durable Object alarm 會依日夜時間自動換日；非即時制會套用沉默時間推進，未行動者會先收到最後2分警告，逾時後暴斃。</td></tr>
      </table>
    </fieldset>
  `));
}

export function renderProtocol(): string {
  return page("Protocol", shell(`
    <fieldset>
      <legend><strong>WebSocket 入口</strong></legend>
      <table class="form-table">
        <tr><td><strong>　連線：</strong></td><td><code>GET /ws/room/:roomId</code></td></tr>
        <tr><td><strong>　格式：</strong></td><td>每個 frame 都是 JSON object，必須包含 <code>type</code>。</td></tr>
        <tr><td><strong>　加入：</strong></td><td>第一個訊息必須是 <code>join</code>，未加入前其他訊息會收到 <code>error</code>。</td></tr>
        <tr><td><strong>　權威來源：</strong></td><td>房間 Durable Object 驗證權限並過濾每個 socket 可收到的私有頻道訊息。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>Client Messages</strong></legend>
      <table class="form-table">
        <tr><td><strong>　join：</strong></td><td><code>{ type, playerId, nickname, trip, wishRole, iconPath }</code></td></tr>
        <tr><td><strong>　chat：</strong></td><td>公開發言。遊戲中限生存玩家與 GM 使用。</td></tr>
        <tr><td><strong>　wolf_chat / fox_chat / common_chat / lovers_chat：</strong></td><td>夜晚私有頻道，限對應陣營或關係的生存玩家；GM 可用 <code>gm_set_channel_restrictions</code> 寫入 <code>chdis</code> 限制矩陣暫停各頻道。</td></tr>
        <tr><td><strong>　self_talk：</strong></td><td>夜晚生存玩家的自言自語，只回送給本人並作為私有紀錄保存。</td></tr>
        <tr><td><strong>　dead_chat：</strong></td><td>遊戲進行中死亡玩家的靈界頻道。</td></tr>
        <tr><td><strong>　vote：</strong></td><td>白天投票，payload 含 <code>targetPlayerId</code>。</td></tr>
        <tr><td><strong>　objection：</strong></td><td>提出反對，白天或大廳可用，每人最多2次，伺服器會廣播音效通知事件。</td></tr>
        <tr><td><strong>　night_kill / divine / child_fox_divine / guard / cat_revive：</strong></td><td>夜晚或角色能力行動，payload 含 <code>targetPlayerId</code>。</td></tr>
        <tr><td><strong>　set_last_words：</strong></td><td>遺言啟用時可儲存死亡時公開文字。</td></tr>
        <tr><td><strong>　start_game / kick_player：</strong></td><td>房主或 GM 的大廳控制。</td></tr>
        <tr><td><strong>　start_vote：</strong></td><td>居民投開始遊戲一票；大廳全員投票後自動開始。</td></tr>
        <tr><td><strong>　kick_vote：</strong></td><td>居民投踢人一票；同一目標達5票後踢出並重置等待室投票。</td></tr>
        <tr><td><strong>　leave_room：</strong></td><td>玩家退出；大廳時從居民列表移除，遊戲中僅關閉目前連線。</td></tr>
        <tr><td><strong>　gm_*：</strong></td><td>GM 聊天、私語、換日、裁定、調整生死、角色、旗標、共有公開與頻道限制。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>Server Messages</strong></legend>
      <table class="form-table">
        <tr><td><strong>　joined / presence：</strong></td><td>連線確認與目前成員清單。</td></tr>
        <tr><td><strong>　game_state：</strong></td><td>公開階段、日期、玩家生死、投票可見狀態、勝者、計時與系統 log。</td></tr>
        <tr><td><strong>　role：</strong></td><td>私密角色訊息，包含可見同伴與權力者資訊。</td></tr>
        <tr><td><strong>　chat family：</strong></td><td>公開、狼、狐、共有、戀人、靈界、GM 與 GM 私語訊息。</td></tr>
        <tr><td><strong>　common voice：</strong></td><td><code>commonTalkVisible</code> 啟用時，非共有者會收到匿名 <code>common_chat</code>，<code>playerId</code> 為 <code>common_voice</code>；GM 可用 <code>gm_set_common_voice</code> 即時切換。</td></tr>
        <tr><td><strong>　action_ack：</strong></td><td>確認投票、襲擊、護衛、子狐占卜、貓又復活、踢人或退出。</td></tr>
        <tr><td><strong>　divination_result / child_fox_result / medium_result：</strong></td><td>私密角色結果。</td></tr>
        <tr><td><strong>　revealed_roles：</strong></td><td>幽靈視角啟用時給死亡玩家；遊戲結束後給所有人。</td></tr>
        <tr><td><strong>　last_words_ack / error：</strong></td><td>遺言確認與驗證、權限、階段或規則錯誤。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>參考</strong></legend>
      <table class="form-table">
        <tr><td><strong>　型別來源：</strong></td><td><code>src/types.ts</code></td></tr>
        <tr><td><strong>　驗證來源：</strong></td><td><code>src/validation.ts</code></td></tr>
        <tr><td><strong>　執行來源：</strong></td><td><code>src/room.ts</code></td></tr>
        <tr><td><strong>　JSON：</strong></td><td><code>/api/protocol</code></td></tr>
        <tr><td><strong>　文件：</strong></td><td><code>README.md#websocket-protocol</code></td></tr>
      </table>
    </fieldset>
  `));
}

export function renderVersion(): string {
  return page("Version", shell(`
    <fieldset>
      <legend><strong>版本資訊</strong></legend>
      <table class="form-table">
        <tr><td><strong>　專案：</strong></td><td>Werewolf Cloudflare Port</td></tr>
        <tr><td><strong>　應用版本：</strong></td><td>0.1.0</td></tr>
        <tr><td><strong>　Runtime：</strong></td><td>Cloudflare Workers / TypeScript</td></tr>
        <tr><td><strong>　Realtime：</strong></td><td>Durable Objects + WebSockets + alarms</td></tr>
        <tr><td><strong>　Persistence：</strong></td><td>D1 game records, player stats, Trip registry</td></tr>
        <tr><td><strong>　Storage：</strong></td><td>R2 avatar assets</td></tr>
        <tr><td><strong>　Configuration：</strong></td><td>KV runtime config</td></tr>
        <tr><td><strong>　Health：</strong></td><td>/api/health</td></tr>
        <tr><td><strong>　Version API：</strong></td><td>/api/version</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>目前功能</strong></legend>
      <table class="form-table">
        <tr><td><strong>　房間：</strong></td><td>建立、列表、加入、即時聊天、房主開始。</td></tr>
        <tr><td><strong>　遊戲：</strong></td><td>白天、夜晚、投票、處刑、勝負、限時自動換日。</td></tr>
        <tr><td><strong>　角色：</strong></td><td>村民、人狼、大狼、占卜師、靈能者、狂人、獵人、共有者、妖狐、背德者、子狐、埋毒者、貓又。</td></tr>
        <tr><td><strong>　GM：</strong></td><td>GM 進房、聊天、私語、踢人、換日、裁定、調整生死/角色/旗標。</td></tr>
        <tr><td><strong>　Trip：</strong></td><td>登記、認領、排除、解除排除、Trip 限定房。</td></tr>
        <tr><td><strong>　戰績：</strong></td><td>排行榜、個人頁、個人歷史、Trip 彙總。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>驗證清單</strong></legend>
      <table class="form-table">
        <tr><td><strong>　Core Game Loop：</strong></td><td>docs/test-results/2026-05-03-core-game-loop.md</td></tr>
        <tr><td><strong>　Retro UI Port：</strong></td><td>docs/test-results/2026-05-03-retro-ui-port.md</td></tr>
        <tr><td><strong>　自動測試：</strong></td><td>Vitest + TypeScript typecheck</td></tr>
      </table>
    </fieldset>
  `));
}

export function renderScriptInfo(): string {
  return page("Script Info", shell(`
    <fieldset>
      <legend><strong>Script Info</strong></legend>
      <table class="form-table">
        <tr><td><strong>　Project：</strong></td><td>Werewolf Cloudflare Port</td></tr>
        <tr><td><strong>　Reference：</strong></td><td><code>ref/diam1.3.61.kz_Build0912/script_info.php</code></td></tr>
        <tr><td><strong>　Runtime：</strong></td><td>Cloudflare Workers / TypeScript</td></tr>
        <tr><td><strong>　Realtime：</strong></td><td>Durable Objects + WebSockets + alarms</td></tr>
        <tr><td><strong>　Database：</strong></td><td>Cloudflare D1</td></tr>
        <tr><td><strong>　Storage：</strong></td><td>R2 avatars and copied reference assets</td></tr>
        <tr><td><strong>　Configuration：</strong></td><td>KV runtime config, federated peers, BBS admin token</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>時間設定</strong></legend>
      <table class="form-table">
        <tr><td><strong>　標準白天：</strong></td><td>3分 / real_time dayMinutes</td></tr>
        <tr><td><strong>　標準夜晚：</strong></td><td>1.5分 / real_time nightMinutes</td></tr>
        <tr><td><strong>　非即時沉默：</strong></td><td>60秒沉默後推進1時間。</td></tr>
        <tr><td><strong>　突然死警告：</strong></td><td>時間耗盡後最後2分還不投票將會暴斃。</td></tr>
        <tr><td><strong>　自動化：</strong></td><td>Durable Object alarm 依 <code>phaseEndsAt</code> 排程。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>限制與容量</strong></legend>
      <table class="form-table">
        <tr><td><strong>　房間人數：</strong></td><td>8 / 16 / 22 / 30</td></tr>
        <tr><td><strong>　BBS 標題：</strong></td><td>50字以內</td></tr>
        <tr><td><strong>　BBS 內容：</strong></td><td>2000字以內</td></tr>
        <tr><td><strong>　聊天：</strong></td><td>公開、狼人、妖狐、共有、戀人、靈界、GM、GM密語。</td></tr>
        <tr><td><strong>　頭像：</strong></td><td>R2-backed PNG / JPEG / GIF / WebP，大小由驗證器限制。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>相關頁面</strong></legend>
      <table class="form-table">
        <tr><td><strong>　版本：</strong></td><td><a href="/version">/version</a></td></tr>
        <tr><td><strong>　狀態：</strong></td><td><a href="/status">/status</a></td></tr>
        <tr><td><strong>　規則：</strong></td><td><a href="/rules">/rules</a></td></tr>
        <tr><td><strong>　通訊協定：</strong></td><td><a href="/protocol">/protocol</a></td></tr>
      </table>
    </fieldset>
  `));
}

export function renderRoom(roomId: string): string {
  return page(`Room ${roomId}`, `
    <script>document.body.classList.add("room-phase-lobby");</script>
    <table class="game-shell" data-room-id="${escapeHtml(roomId)}">
      <tr>
        <td>
          <table class="game-header">
            <tr><th colspan="2">[${escapeHtml(roomId)}] 汝等是人是狼？</th></tr>
            <tr>
              <td style="width: 180px;">階段：<span id="phase">lobby</span></td>
              <td>
                勝利：<span id="winner" class="muted">未定</span>
                　<a href="/">首頁</a>
                　<a href="/room/${escapeHtml(roomId)}/records">對局紀錄</a>
                　<a href="/room/${escapeHtml(roomId)}/events">事件履歷</a>
                　<a href="/room/${escapeHtml(roomId)}/log">完整紀錄</a>
                　<button id="manualRefresh" type="button">手動更新</button>
                <label><input id="autoRefresh" type="checkbox"> 自動更新</label>
              </td>
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
              <td><input id="nickname" maxlength="32" size="28"> <button id="connect">進入房間</button> <button id="startVote" disabled>投開始一票</button> <button id="startGame">開始遊戲</button> <button id="leaveRoom" disabled>退出</button></td>
            </tr>
            <tr>
              <td>Trip</td>
              <td><input id="trip" maxlength="32" size="28"></td>
            </tr>
            <tr>
              <td>希望角色</td>
              <td>
                <select id="wishRole">
                  <option value="none" selected>無</option>
                  <option value="villager">村民</option>
                  <option value="werewolf">人狼</option>
                  <option value="big_wolf">大狼</option>
                  <option value="seer">占卜師</option>
                  <option value="medium">靈能者</option>
                  <option value="madman">狂人</option>
                  <option value="guard">獵人</option>
                  <option value="common">共有者</option>
                  <option value="fox">妖狐</option>
                  <option value="poison">埋毒者</option>
                  <option value="betrayer">背德者</option>
                  <option value="child_fox">子狐</option>
                  <option value="cat">貓又</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>頭像</td>
              <td><input id="avatarFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="28"> <button id="uploadAvatar">頭像</button> <button id="removeAvatar">刪頭像</button> <small class="muted">PNG/JPEG/GIF/WebP 512KiB以下</small></td>
            </tr>
            <tr>
              <td>預設頭像</td>
              <td>
                <select id="defaultIcon">
                  <option value="">名稱首字</option>
                  <option value="user_icon/001.gif">001 明灰</option>
                  <option value="user_icon/002.gif">002 暗灰</option>
                  <option value="user_icon/003.gif">003 黃色</option>
                  <option value="user_icon/004.gif">004 橙色</option>
                  <option value="user_icon/005.gif">005 紅色</option>
                  <option value="user_icon/006.gif">006 水色</option>
                  <option value="user_icon/007.gif">007 藍色</option>
                  <option value="user_icon/008.gif">008 綠色</option>
                  <option value="user_icon/009.gif">009 紫色</option>
                  <option value="user_icon/010.gif">010 櫻色</option>
                </select>
                <small><a href="/icons">頭像一覽</a></small>
              </td>
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
                <div><input id="lastWordsText" maxlength="500" size="60"> <button id="setLastWords">遺言</button></div>
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
                <button id="sendFoxChat" disabled>狐頻</button>
                <button id="sendCommonChat" disabled>共有頻</button>
                <button id="sendLoversChat" disabled>戀頻</button>
                <button id="sendDeadChat" disabled>靈界</button>
                <button id="sendSelfTalk" disabled>自言</button>
                <button id="sendObjection" disabled>提出反對</button>
                <label><input id="soundNotify" type="checkbox"> 音效</label>
                <button id="sendGmChat" disabled>GM</button>
                <select id="gmWhisperTarget"></select>
                <button id="sendGmWhisper" disabled>GM私語</button>
                <button id="gmAdvancePhase" disabled>GM換日</button>
                <select id="gmWinner">
                  <option value="villagers">村民</option>
                  <option value="werewolves">人狼</option>
                  <option value="foxes">妖狐</option>
                  <option value="lovers">戀人</option>
                </select>
                <button id="gmEndGame" disabled>GM裁定</button>
                <button id="gmKillPlayer" disabled>GM死亡</button>
                <button id="gmRevivePlayer" disabled>GM復活</button>
                <select id="gmRole">
                  <option value="villager">村民</option>
                  <option value="werewolf">人狼</option>
                  <option value="big_wolf">大狼</option>
                  <option value="seer">占卜師</option>
                  <option value="medium">靈能者</option>
                  <option value="madman">狂人</option>
                  <option value="guard">獵人</option>
                  <option value="common">共有者</option>
                  <option value="fox">妖狐</option>
                  <option value="poison">埋毒者</option>
                  <option value="betrayer">背德者</option>
                  <option value="child_fox">子狐</option>
                  <option value="cat">貓又</option>
                </select>
                <button id="gmSetRole" disabled>GM改職</button>
                <select id="gmFlag">
                  <option value="authority">權力者</option>
                  <option value="decider">決定者</option>
                  <option value="lover">戀人</option>
                </select>
                <button id="gmEnableFlag" disabled>GM標記</button>
                <button id="gmDisableFlag" disabled>GM解除</button>
                <button id="gmEnableCommonVoice" disabled>共有公開</button>
                <button id="gmDisableCommonVoice" disabled>共有非公開</button>
                <label><input id="gmRestrictWolf" type="checkbox"> 關狼頻</label>
                <label><input id="gmRestrictCommon" type="checkbox"> 關共有</label>
                <label><input id="gmRestrictLovers" type="checkbox"> 關戀頻</label>
                <label><input id="gmRestrictFox" type="checkbox"> 關狐頻</label>
                <button id="gmSetChannelRestrictions" disabled>GM頻道</button>
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
            <tr><th>個人紀錄</th></tr>
            <tr><td><div id="playerRecords" class="muted">讀取中</div></td></tr>
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
    <script src="/assets/room-client.js" defer></script>
  `);
}
