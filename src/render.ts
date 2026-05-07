import type { BbsReplySummary, BbsTopicSummary, FederatedRoomSummary, FederatedServerStatus, GameRecordSummary, GameWinner, LeaderboardEntry, PlayerRole, RoomEventSummary, RoomSummary, TripPublicSummary, TripRoomRecordSummary, TripScoreSummary, WinRateEntry } from "./types";
import { escapeHtml } from "./validation";

function page(title: string, body: string, extraHead = ""): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${extraHead}
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
    .view-spectator-only, .view-heaven-only { display: none; }
    body.room-view-spectator .view-player-only,
    body.room-view-heaven .view-player-only { display: none; }
    body.room-view-spectator .view-spectator-only,
    body.room-view-heaven .view-heaven-only { display: table-row; }
    body.room-view-heaven .panel th { background: #cccccc; }
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
    .bbs-status-mark {
      display: inline-block;
      border: 1px solid #999999;
      background: #eeeeee;
      color: #333333;
      font-size: 11px;
      line-height: 1.25;
      padding: 0 3px;
      margin-right: 3px;
      white-space: nowrap;
    }
    .bbs-topic-pinned { border-color: #cc6600; background: #ffffcc; color: #996600; }
    .bbs-topic-locked { border-color: #666666; background: #e6e6e6; color: #333333; }
    .bbs-topic-digest { border-color: #cc3300; background: #ffe6e6; color: #cc0000; }
    .table1 { border-collapse: collapse; border: 1px solid #cccccc; }
    .table2 {
      text-align: right;
      border-top: 1px solid #ffffff;
      border-left: 1px solid #cccccc;
      border-right: 1px solid #cccccc;
      background-color: #ffffff;
      font-size: 12px;
    }
    .table3 { border-top: 1px solid #cccccc; background-color: #cccccc; }
    .table4 { background-color: #ffffff; font-size: 13px; }
    #table5 { width: 650px; }
    .health-mark {
      display: inline-block;
      border: 1px solid #999999;
      background: #eeeeee;
      color: #333333;
      font-size: 11px;
      line-height: 1.25;
      padding: 0 4px;
      margin-right: 3px;
      min-width: 3em;
      text-align: center;
      white-space: nowrap;
    }
    .health-ok { border-color: #008800; background: #e6ffe6; color: #008800; }
    .health-error { border-color: #cc0000; background: #ffe6e6; color: #cc0000; }
    .health-idle { border-color: #666666; background: #eeeeee; color: #333333; }
    .ref-icon { width: 16px; height: 16px; border: 0; vertical-align: text-bottom; margin-right: 2px; }
    .old-log-option-cell { width: 16px; text-align: center; vertical-align: middle; padding: 0; }
    .old-log-option-cell .option-mark { border: 0; background: transparent; font-size: 0; padding: 0; margin: 0; }
    .old-log-option-cell .ref-icon { margin-right: 0; vertical-align: middle; }
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
    #lastWordsLog { max-height: 120px; overflow: auto; background: #ffffff; }
    #lastWordsLog div { border-top: 1px dotted silver; padding: 2px 4px; overflow-wrap: anywhere; word-break: break-word; }
    #players button { margin: 2px 4px 2px 0; min-width: 7em; text-align: left; }
    .vote-table { border: 1px solid #999900; background: #ffffee; }
    .vote-table td { border: 1px solid #d0d080; padding: 2px 6px; }
    .vote-round-header td { background: #999900; color: snow; font-weight: bold; }
    .vote-total-row td { background: #ffffcc; color: #666600; }
    .vote-ballot-row td { background: #ffffff; }
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
<body bgcolor="white">${body}</body>
</html>`;
}

function menuItem(href: string, label: string, activeMenu?: string): string {
  const link = `<a href="${href}">${label}</a>`;
  return `<tr><td><small><font color="#666666">・</font></small></td><td>${activeMenu === href ? `<b>${link}</b>` : link}</td></tr>`;
}

function shell(body: string, activeMenu?: string): string {
  return `
    <table class="site">
      <tr>
        <td colspan="2" class="masthead">
          <a href="/" class="title"><img class="title-img" src="/assets/reference/img/top_title.jpg" alt="汝等是人是狼？">汝等是人是狼？</a>
          <div class="subtitle">Werewolf Cloudflare Port</div>
        </td>
      </tr>
      <noscript>
        <tr>
          <td colspan="2" align="center">
            <span style="font-size:15pt;color:red;font-weight:bold">＜＜ 請啟用JavaScript ＞＞</span>
          </td>
        </tr>
      </noscript>
      <tr>
        <td class="side">
          <table class="menu-box"><tr><th>選單</th></tr></table>
          <table class="menu-list">
            ${menuItem("/", "首頁", activeMenu)}
            ${menuItem("/list.php", "聯合列表", activeMenu)}
            ${menuItem("/old_log.php", "過去紀錄", activeMenu)}
            ${menuItem("/leaderboard", "戰績排行榜", activeMenu)}
            ${menuItem("/stats.php", "勝率分析", activeMenu)}
            ${menuItem("/icon_view.php", "頭像一覽", activeMenu)}
            ${menuItem("/icon_upload.php", "頭像上傳", activeMenu)}
            ${menuItem("/trip.php", "身份登錄", activeMenu)}
            ${menuItem("/trips", "Trip查詢", activeMenu)}
            ${menuItem("/bbs.php", "人狼討論", activeMenu)}
            ${menuItem("/bbs.php?go=dige", "精華文章", activeMenu)}
            ${menuItem("/status", "伺服器狀態", activeMenu)}
            ${menuItem("/admin.php", "管理選單", activeMenu)}
            ${menuItem("/rule.php", "規則", activeMenu)}
            ${menuItem("/manual", "說明書", activeMenu)}
            ${menuItem("/script_info.php", "Script Info", activeMenu)}
            ${menuItem("/protocol", "通訊協定", activeMenu)}
            ${menuItem("/version.php", "版本", activeMenu)}
          </table>
        </td>
        <td class="main">${body}</td>
      </tr>
      <tr>
        <td></td>
        <td align="right">
          <div style="margin-top:10px;"><small>
            [PHP4 + MYSQLスクリプト　<a href="http://p45.aaacafe.ne.jp/~netfilms/" style="color:blue;" target="_blank">配布ホームページ</a>]
            [写真素材　<a href="http://keppen.web.infoseek.co.jp/" style="color:blue;" target="_blank">天の欠片</a>]<br>
            [修改 <a href="http://test.ngct.net" style="color:blue;" target="_blank">小企鵝</a> 翻譯 殿]
            [中文化/修補　<a href="http://jinro.sbh.idv.tw" style="color:blue;" target="_blank">蜜蜂貓之家</a>]
            [網站管理者 <a href="/admin.php" style="color:blue;" target="_blank">Werewolf CF</a>]
          </small></div>
        </td>
      </tr>
    </table>
  `;
}

export const DEFAULT_ANNOUNCEMENT = "目前支援建立村子、即時聊天、白天投票、夜晚行動與自動換日。";

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

function roleIconPath(value: unknown): string | undefined {
  const paths: Record<PlayerRole, string> = {
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
  };
  return typeof value === "string" && value in paths ? paths[value as PlayerRole] : undefined;
}

function roleLabelHtml(value: unknown): string {
  const label = roleLabel(value);
  const iconPath = roleIconPath(value);
  return `${iconPath ? referenceAssetImg(iconPath, label) : ""}${escapeHtml(label)}`;
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
    room_end_requested: "要求廢村",
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

function eventSpeakerLabelHtml(event: RoomEventSummary): string {
  const value = recordValue(event.payload);
  const speaker = escapeHtml(eventSpeakerLabel(event));
  if (event.eventType === "self_talk") {
    return `${speaker} <small>的自言自語</small>`;
  }
  if (event.eventType === "gm_whisper") {
    const target = typeof value.targetNickname === "string" && value.targetNickname
      ? value.targetNickname
      : typeof value.targetPlayerId === "string" && value.targetPlayerId
        ? value.targetPlayerId
        : "???";
    return `${speaker} → ${escapeHtml(target)}`;
  }
  return speaker;
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
    room_end_requested: { className: "transcript-location-system", label: "系統" },
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

function voteRoundNumber(value: Record<string, unknown>): number {
  const revoteCount = typeof value.revoteCount === "number" ? value.revoteCount : 0;
  return revoteCount + 1;
}

function voteTargetLabel(event: RoomEventSummary): string {
  const value = recordValue(event.payload);
  return typeof value.targetNickname === "string" && value.targetNickname
    ? value.targetNickname
    : typeof value.targetPlayerId === "string"
      ? value.targetPlayerId
      : "不明";
}

function renderVoteTargetTotals(events: RoomEventSummary[]): string {
  const totals = new Map<string, number>();
  for (const event of events) {
    const target = voteTargetLabel(event);
    totals.set(target, (totals.get(target) ?? 0) + 1);
  }
  return Array.from(totals.entries())
    .sort(([leftTarget, leftCount], [rightTarget, rightCount]) => rightCount - leftCount || leftTarget.localeCompare(rightTarget))
    .map(([target, count]) => `${escapeHtml(target)}：${count}票`)
    .join("　");
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
    const targetTotals = new Map<string, number>();
    for (const event of groupEvents) {
      const target = voteTargetLabel(event);
      targetTotals.set(target, (targetTotals.get(target) ?? 0) + 1);
    }
    const rows = [...groupEvents].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((event) => {
      const value = recordValue(event.payload);
      const voter = typeof value.nickname === "string" && value.nickname ? value.nickname : event.playerId ?? "不明";
      const target = voteTargetLabel(event);
      const targetTotal = targetTotals.get(target) ?? 0;
      const voterReceivedTotal = targetTotals.get(voter) ?? 0;
      return `<tr class="vote-ballot-row">
        <td align="left"><strong>${escapeHtml(voter)}</strong></td>
        <td>${voterReceivedTotal}票</td>
        <td>投票給 ${targetTotal} 票 →</td>
        <td><strong> ${escapeHtml(target)} </strong></td>
        <td>${escapeHtml(event.createdAt)}</td>
      </tr>`;
    }).join("");
    const phpRoundLabel = day ? `${day} 日目 ( ${voteRoundNumber(first)} 回目)` : `${voteRoundNumber(first)} 回目`;
    return `
      <tr class="vote-round-header"><td colspan="5">${escapeHtml(label)}</td></tr>
      <tr class="vote-total-row"><td colspan="5">得票：${renderVoteTargetTotals(groupEvents)}</td></tr>
      <tr><td colspan="5">
        <table class="form-table vote-table" border="1" cellspacing="0" cellpadding="2" style="font-size:12pt;margin:6px 0 12px 18px;">
          <thead>
            <tr><td colspan="5" align="center">${escapeHtml(phpRoundLabel)}</td></tr>
            <tr><td><strong>投票者</strong></td><td><strong>得票</strong></td><td><strong>投票</strong></td><td><strong>投票先</strong></td><td><strong>時間</strong></td></tr>
          </thead>
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
      <td>${eventSpeakerLabelHtml(event)}</td>
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
  oldLogReturnHref?: string;
};

function roomTranscriptHref(roomId: string, params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? "")}`)
    .join("&");
  return `/room/${escapeHtml(roomId)}/log${query ? `?${escapeHtml(query)}` : ""}`;
}

function legacyTranscriptHref(path: "/old_log.php" | "/game_log.php", roomId: string, params: Record<string, string | undefined>): string {
  const baseParams = path === "/old_log.php"
    ? { log_mode: "on", room_no: roomId }
    : { room_no: roomId, log_mode: "on" };
  const query = Object.entries({ ...baseParams, ...params })
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? "")}`)
    .join("&");
  return `${path}?${escapeHtml(query)}`;
}

const transcriptSystemEventTypes = new Set([
  "objection",
  "room_end_requested",
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

function isViewerAddressedTranscriptEvent(event: RoomEventSummary, viewerPlayerId?: string): boolean {
  const value = recordValue(event.payload);
  return Boolean(viewerPlayerId && event.eventType === "gm_whisper" && value.targetPlayerId === viewerPlayerId);
}

function transcriptViewerPlayer(records: GameRecordSummary[], viewerPlayerId?: string): Record<string, unknown> | undefined {
  if (!viewerPlayerId) {
    return undefined;
  }
  for (const record of records) {
    const player = readRecordPlayers(record).find((candidate) => candidate.playerId === viewerPlayerId);
    if (player) {
      return player;
    }
  }
  return undefined;
}

function isWerewolfTranscriptRole(role: unknown): boolean {
  return role === "werewolf" || role === "big_wolf";
}

function isViewerChannelTranscriptEvent(event: RoomEventSummary, viewerPlayer?: Record<string, unknown>): boolean {
  if (!viewerPlayer) {
    return false;
  }
  switch (event.eventType) {
    case "wolf_chat":
      return isWerewolfTranscriptRole(viewerPlayer.role);
    case "fox_chat":
      return viewerPlayer.role === "fox";
    case "common_chat":
      return viewerPlayer.role === "common";
    case "lovers_chat":
      return viewerPlayer.lover === true;
    default:
      return false;
  }
}

function filterTranscriptEventsByViewer(events: RoomEventSummary[], records: GameRecordSummary[], options: RoomTranscriptViewOptions): RoomEventSummary[] {
  const mode = options.viewerMode ?? "legacy";
  if (mode === "legacy" || mode === "gm") {
    return events;
  }
  const viewerPlayer = mode === "player" ? transcriptViewerPlayer(records, options.viewerPlayerId) : undefined;
  return events.filter((event) => {
    if (!isPrivateTranscriptEvent(event)) {
      return true;
    }
    if (mode === "dead") {
      return isHeavenTranscriptEvent(event) || isSystemTranscriptEvent(event);
    }
    if (mode === "player") {
      return isViewerOwnedTranscriptEvent(event, options.viewerPlayerId) ||
        isViewerAddressedTranscriptEvent(event, options.viewerPlayerId) ||
        isViewerChannelTranscriptEvent(event, viewerPlayer);
    }
    return isSystemTranscriptEvent(event);
  });
}

function filterTranscriptEvents(events: RoomEventSummary[], records: GameRecordSummary[], options: RoomTranscriptViewOptions): RoomEventSummary[] {
  const viewerEvents = filterTranscriptEventsByViewer(events, records, options);
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

function optionCell(mark: string): string {
  return `<td class="row old-log-option-cell">${mark || "<br>"}</td>`;
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

function healthMark(label: string, state: "ok" | "error" | "idle"): string {
  const className = state === "ok" ? "health-ok" : state === "error" ? "health-error" : "health-idle";
  return `<span class="health-mark ${className}">${escapeHtml(label)}</span>`;
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
  return { ...room, serverName: "本伺服器", serverUrl: "/", roomUrl: `/login.php?room_no=${encodeURIComponent(room.id)}`, local: true };
}

export function renderFederatedList(
  rooms: Array<RoomSummary | FederatedRoomSummary>,
  peers: FederatedServerStatus[] = [],
  options: { backPageHref?: string } = {}
): string {
  const peerSummaryRows = peers.map((peer) => `<tr>
        <td>${peer.ok ? `<a href="${escapeHtml(peer.url)}">服務中</a>` : `<a href="${escapeHtml(peer.url)}">失聯中</a>`}</td>
        <td colspan="4"><a href="${escapeHtml(peer.url)}">${escapeHtml(peer.url)}</a></td>
      </tr>`).join("");
  const backLink = options.backPageHref ? `<a href="${escapeHtml(options.backPageHref)}">←返回</a>` : "";
  const rows = rooms.length
    ? rooms.map((value) => {
      const room = federatedRoomValue(value);
      const label = federatedStatusLabel(room.status);
      const boldStart = room.status === "lobby" ? "<b>" : "";
      const boldEnd = room.status === "lobby" ? "</b>" : "";
      return `<tr>
        <td width="50">${boldStart}<a href="${escapeHtml(room.roomUrl)}">${roomStatusIcon(room.status)}<font style="font-size : 15px;">${escapeHtml(label)}</font></a>${boldEnd}</td>
        <td width="100">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 15px;">[${escapeHtml(room.id)}]</font></a>${boldEnd}</td>
        <td width="250">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 15px;">${escapeHtml(room.name)}村</font></a>${boldEnd}</td>
        <td>${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 12px;">${escapeHtml(room.comment)}</font></a>${boldEnd}</td>
        <td width="50">${boldStart}<a href="${escapeHtml(room.roomUrl)}"><font style="font-size : 13px;">人數${escapeHtml(String(room.maxPlayers))}</font></a>${boldEnd}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="muted">目前沒有可列出的村子。</td></tr>`;
  const peerRows = peers.length
    ? peers.map((peer) => `<tr>
        <td><a href="${escapeHtml(peer.url)}">${escapeHtml(peer.name)}</a></td>
        <td>${peer.ok ? `${healthMark("服務中", "ok")}<font color="#008800">服務中</font>` : `${healthMark("失敗", "error")}<font color="#cc0000">連線失敗</font>`}</td>
        <td>${escapeHtml(String(peer.roomCount))}</td>
        <td>${peer.error ? escapeHtml(peer.error) : `<span class="muted">-</span>`}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="muted">尚未設定聯合伺服器。</td></tr>`;

  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    ${backLink}
    <fieldset>
      <legend><strong>聯合遊戲列表</strong></legend>
      <div style="line-height:135%;margin:20px 20px 30px;">
        <strong>
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%">
            <tr><td>服務中</td><td colspan="4"><a href="/">本伺服器 / Cloudflare Workers</a></td></tr>
            ${peerSummaryRows}
            <tr><td colspan="5"><hr></td></tr>
            ${rows}
          </table>
        </strong>
      </div>
    </fieldset>
    <fieldset>
      <legend><strong>聯合伺服器狀態</strong></legend>
      <table class="form-table">
        <tr><td><strong>伺服器</strong></td><td><strong>狀態</strong></td><td><strong>村數</strong></td><td><strong>訊息</strong></td></tr>
        ${peerRows}
      </table>
    </fieldset>
  `, "/list.php"));
}

export function renderOldLogs(rooms: RoomSummary[], options: { search?: string; winners?: Record<string, GameWinner>; page?: number; pageSize?: number; totalRooms?: number; showAll?: boolean } = {}): string {
  const searchValue = options.search ?? "";
  const oldLogBasePath = searchValue ? `/old_log.php?search=${encodeURIComponent(searchValue)}` : "/old_log.php";
  const pagination = options.showAll ? "" : paginationLinks(options.totalRooms, options.page, options.pageSize, oldLogBasePath);
  const detailStateParams = {
    ...(searchValue ? { search: searchValue } : {}),
    ...(options.showAll ? { all: "1" } : options.page && options.page > 1 ? { page: String(options.page) } : {})
  };
  const rows = rooms.length
    ? rooms.map((room) => {
      const roomQuery = new URLSearchParams({ log_mode: "on", room_no: room.id, ...detailStateParams });
      const roomUrl = `/old_log.php?${roomQuery.toString()}`;
      const winner = options.winners?.[room.id];
      const winnerMark = winner ? referenceAssetImg(winnerIconPath(winner), `${winnerLabel(winner)}勝利`) : "-";
      const poisonMark = room.options.poison
        ? optionMark("埋毒", "img/room_option_poison.gif")
        : room.options.cat
          ? optionMark("貓又", "img/room_option_cat.gif")
          : "";
      const foxSideMark = room.options.betrayer
        ? optionMark("背德", "img/room_option_betr.gif")
        : room.options.childFox
          ? optionMark("子狐", "img/room_option_fosi.gif")
          : room.options.twoFoxes
            ? optionMark("雙狐", "img/room_option_foxs.gif")
            : "";
      const optionCells = [
        room.options.wishRole ? optionMark("希望", "img/room_option_wish_role.gif") : "",
        room.options.realTime ? optionMark("限時", "img/room_option_real_time.gif") : "",
        room.options.dummyBoy || room.options.customDummy ? optionMark("替身", "img/room_option_dummy_boy.gif") : "",
        room.options.openVote ? optionMark("公開票", "img/room_option_open_vote.gif") : "",
        room.options.decider ? optionMark("決定", "img/room_option_decide.gif") : "",
        room.options.authority ? optionMark("權力", "img/room_option_authority.gif") : "",
        poisonMark,
        room.options.bigWolf ? optionMark("大狼", "img/room_option_wfbig.gif") : "",
        foxSideMark,
        room.options.deadRoleVisible ? optionMark("靈視", "img/rei.gif") : "",
        room.options.commonTalkVisible ? optionMark("共有聲", "img/conn_look.gif") : "",
        room.options.lovers ? optionMark("戀人", "img/room_option_lovers.gif") : ""
      ].map(optionCell).join("");
      return `<tr>
        <td align="right" class="row">${escapeHtml(room.id)}</td>
        <td align="right" class="row">
          <a href="${escapeHtml(roomUrl)}">${escapeHtml(room.name)} 村</a>
          <small>(<a href="${escapeHtml(`${roomUrl}&reverse_log=on`)}">逆</a>
          <a href="${escapeHtml(`${roomUrl}&heaven_talk=on`)}">靈</a>
          <a href="${escapeHtml(`${roomUrl}&reverse_log=on&heaven_talk=on`)}">逆&amp;靈</a>
          <a href="${escapeHtml(`${roomUrl}&heaven_only=on`)}">逝</a>
          <a href="${escapeHtml(`${roomUrl}&reverse_log=on&heaven_only=on`)}">逆&amp;逝</a>)</small>
        </td>
        <td align="right" class="row"><small>${escapeHtml(room.createdAt)}</small></td>
        <td align="right" class="row">${maxPlayersMark(room.maxPlayers)}</td>
        <td align="center" class="row">${winnerMark}</td>
        ${optionCells}
      </tr>`;
    }).join("")
    : `<tr><td colspan="17" class="muted">沒有遊戲紀錄</td></tr>`;

  return page("汝等是人是狼？[過去紀錄]", shell(`
    <fieldset style="background-image:url('/assets/reference/img/old_log_bg.jpg'); background-repeat:no-repeat; background-position:100% 100%; background-attachment:fixed;">
      <legend><strong>過去紀錄</strong></legend>
      <p><a href="/index.php">←返回</a> <a href="/old_log.php?all=1">[全部顯示]</a></p>
      <p><img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"></p>
      <div align="center">
        <form name="old_log" action="/old_log.php" method="get" enctype="multipart/form-data">
          搜尋<input type="text" name="search" size="10" value="${escapeHtml(searchValue)}">
          <input id="submit" type="submit" value="送出">
        </form>
        ${pagination}
      </div>
      <table class="form-table" border="1" cellspacing="1" bgcolor="#CCCCCC" style="margin:12px auto 18px;">
        <thead><tr><th class="column">村No</th><th class="column">村名</th><th class="column">結束時間</th><th class="column">人數</th><th class="column">勝</th><th colspan="12" class="column">選項</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${pagination}
    </fieldset>
  `, "/old_log.php"));
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

function transcriptPlayerCandidates(records: GameRecordSummary[], events: RoomEventSummary[]): Array<{ playerId: string; label: string }> {
  const players = new Map<string, string>();
  for (const record of records) {
    for (const player of readRecordPlayers(record)) {
      const playerId = typeof player.playerId === "string" ? player.playerId : "";
      if (!playerId || players.has(playerId)) {
        continue;
      }
      players.set(playerId, playerRecordLabel(player));
    }
  }
  for (const event of events) {
    const value = recordValue(event.payload);
    if (event.playerId && !players.has(event.playerId)) {
      const nickname = typeof value.nickname === "string" && value.nickname ? value.nickname : "";
      players.set(event.playerId, nickname ? `${nickname} (${event.playerId})` : event.playerId);
    }
    if (typeof value.targetPlayerId === "string" && value.targetPlayerId && !players.has(value.targetPlayerId)) {
      const targetNickname = typeof value.targetNickname === "string" && value.targetNickname ? value.targetNickname : "";
      players.set(value.targetPlayerId, targetNickname ? `${targetNickname} (${value.targetPlayerId})` : value.targetPlayerId);
    }
  }
  return [...players].map(([playerId, label]) => ({ playerId, label }));
}

function hiddenTranscriptInput(name: string, value: string | undefined): string {
  return value ? `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">` : "";
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
  `, "/leaderboard"));
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
  `, "/stats.php"));
}

export function renderRoomRecords(roomId: string, records: GameRecordSummary[]): string {
  const rows = records.length
    ? records.map((record) => {
      const players = readRecordPlayers(record);
      const playerRows = players.length
        ? players.map((player) => `<tr>
            <td>${escapeHtml(playerRecordLabel(player))}</td>
            <td>${roleLabelHtml(player.role)}</td>
            <td>${player.alive === false ? `<font color="#990000">死亡</font>` : "生存"}</td>
          </tr>`).join("")
        : `<tr><td colspan="3" class="muted">未保存玩家明細。</td></tr>`;
      return `<tr>
        <td>${escapeHtml(record.createdAt)}</td>
        <td>
          ${formatGameRecordHtml(record)}
          <table class="form-table" style="margin:6px 0 12px 18px;">
            <thead><tr><td><strong>玩家</strong></td><td><strong>職業</strong></td><td><strong>結局</strong></td></tr></thead>
            <tbody>${playerRows}</tbody>
          </table>
        </td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="2" class="muted">尚無對局紀錄。</td></tr>`;

  return page(`Room ${roomId} Records`, shell(`
    <fieldset>
      <legend><strong>村子對局紀錄</strong></legend>
      <table class="form-table">
        <tr><td><strong>　村子：</strong></td><td><a href="/game_view.php?room_no=${encodeURIComponent(roomId)}">${escapeHtml(roomId)}</a></td></tr>
        <tr><td><strong>　紀錄：</strong></td><td><a href="/game_log.php?room_no=${encodeURIComponent(roomId)}&amp;log_mode=on">村子完整紀錄</a></td></tr>
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
        <tr><td><strong>　村子：</strong></td><td><a href="/game_view.php?room_no=${encodeURIComponent(roomId)}">${escapeHtml(roomId)}</a></td></tr>
        <tr><td><strong>　紀錄：</strong></td><td><a href="/game_log.php?room_no=${encodeURIComponent(roomId)}&amp;log_mode=on">村子完整紀錄</a></td></tr>
      </table>
      <table class="form-table" style="margin:12px 20px 18px;">
        <thead><tr><td><strong>時間</strong></td><td><strong>事件</strong></td><td><strong>玩家</strong></td><td><strong>內容</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
  `));
}

export function renderRoomTranscript(roomId: string, records: GameRecordSummary[], events: RoomEventSummary[], options: RoomTranscriptViewOptions = {}): string {
  const visibleEvents = filterTranscriptEvents(events, records, options);
  const recordSections = records.length
    ? records.map((record) => {
      const players = readRecordPlayers(record);
      const playerRows = players.length
        ? players.map((player) => `<tr>
            <td>${escapeHtml(playerRecordLabel(player))}</td>
            <td>${roleLabelHtml(player.role)}</td>
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
  const viewerScopeLabel = {
    legacy: "結束後全公開：顯示保存的公開、私有、系統與GM紀錄。",
    public: "旁觀：只顯示公開與系統紀錄，隱藏私人頻道與個人能力內容。",
    player: options.viewerPlayerId
      ? `玩家：顯示 ${options.viewerPlayerId} 的私人發言/行動、可聽見的同陣營密談與指向該玩家的GM密語。`
      : "玩家：請選擇玩家後顯示該玩家可見的私人紀錄。",
    dead: "靈界：顯示公開、系統與靈界紀錄。",
    gm: "GM：顯示全部保存紀錄。"
  }[viewerMode];
  const viewerParams = {
    ...(viewerMode !== "legacy" ? { viewer: viewerMode } : {}),
    ...(viewerMode === "player" ? { viewer_player_id: options.viewerPlayerId } : {})
  };
  const displayParams = {
    ...(options.reverseLog ? { reverse_log: "on" } : {}),
    ...(options.heavenTalk ? { heaven_talk: "on" } : {}),
    ...(options.heavenOnly ? { heaven_only: "on" } : {})
  };
  const currentTranscriptParams = { ...displayParams, ...viewerParams };
  const oldLogReturnHref = options.oldLogReturnHref ?? "/old_log.php";
  const playerCandidates = transcriptPlayerCandidates(records, events);
  const playerOptions = playerCandidates.length
    ? playerCandidates.map((player) => `<option value="${escapeHtml(player.playerId)}"${player.playerId === options.viewerPlayerId ? " selected" : ""}>${escapeHtml(player.label)}</option>`).join("")
    : `<option value="">玩家資料不足</option>`;
  const playerLinks = playerCandidates.length
    ? playerCandidates.map((player) => `<a href="${roomTranscriptHref(roomId, { ...displayParams, viewer: "player", viewer_player_id: player.playerId })}">${escapeHtml(player.label)}</a>`).join("　")
    : `<span class="muted">尚無可選玩家。</span>`;
  const legacyPlayerLinks = playerCandidates.length
    ? playerCandidates.map((player) => `<span>${escapeHtml(player.label)}：<a href="${legacyTranscriptHref("/old_log.php", roomId, { ...displayParams, viewer: "player", viewer_player_id: player.playerId })}">old_log.php</a> / <a href="${legacyTranscriptHref("/game_log.php", roomId, { ...displayParams, viewer: "player", viewer_player_id: player.playerId })}">game_log.php</a></span>`).join("<br>")
    : `<span class="muted">尚無可選玩家。</span>`;

  return page(`Room ${roomId} Log`, shell(`
    <fieldset>
      <legend><strong>村子完整紀錄</strong></legend>
      <p style="margin:0 0 6px 0;"><a href="${escapeHtml(oldLogReturnHref)}">←返回</a></p>
      <table class="form-table">
        <tr><td><strong>　村子：</strong></td><td><a href="/game_view.php?room_no=${encodeURIComponent(roomId)}">${escapeHtml(roomId)}</a></td></tr>
        <tr><td><strong>　索引：</strong></td><td><a href="/room/${escapeHtml(roomId)}/records">對局紀錄</a>　<a href="/room/${escapeHtml(roomId)}/events">事件履歷</a></td></tr>
        <tr><td><strong>　PHP：</strong></td><td><a href="${legacyTranscriptHref("/old_log.php", roomId, currentTranscriptParams)}">old_log.php</a>　<a href="${legacyTranscriptHref("/game_log.php", roomId, currentTranscriptParams)}">game_log.php</a></td></tr>
        <tr><td><strong>　表示：</strong></td><td>${escapeHtml(modeLabel)}　<a href="${roomTranscriptHref(roomId, viewerParams)}">通常</a>　<a href="${roomTranscriptHref(roomId, { ...viewerParams, heaven_talk: "on" })}">靈</a>　<a href="${roomTranscriptHref(roomId, { ...viewerParams, heaven_only: "on" })}">逝</a>　<a href="${roomTranscriptHref(roomId, { ...viewerParams, reverse_log: "on" })}">逆</a>　<a href="${roomTranscriptHref(roomId, { ...viewerParams, reverse_log: "on", heaven_talk: "on" })}">逆&amp;靈</a>　<a href="${roomTranscriptHref(roomId, { ...viewerParams, reverse_log: "on", heaven_only: "on" })}">逆&amp;逝</a></td></tr>
        <tr><td><strong>　視點：</strong></td><td>${escapeHtml(viewerLabel)}　<a href="${roomTranscriptHref(roomId, { ...displayParams, viewer: "public" })}">旁觀</a>　<a href="${roomTranscriptHref(roomId, { ...displayParams, viewer: "dead", heaven_talk: "on", heaven_only: undefined })}">靈界</a>　<a href="${roomTranscriptHref(roomId, { ...displayParams, viewer: "gm", heaven_talk: "on", heaven_only: undefined })}">GM</a></td></tr>
        <tr><td><strong>　可見範圍：</strong></td><td><span class="muted">${escapeHtml(viewerScopeLabel)}</span></td></tr>
        <tr><td><strong>　玩家視點：</strong></td><td>
          <form method="get" action="/room/${escapeHtml(roomId)}/log" style="margin:0;">
            <input type="hidden" name="viewer" value="player">
            ${hiddenTranscriptInput("reverse_log", displayParams.reverse_log)}
            ${hiddenTranscriptInput("heaven_talk", displayParams.heaven_talk)}
            ${hiddenTranscriptInput("heaven_only", displayParams.heaven_only)}
            <select name="viewer_player_id"${playerCandidates.length ? "" : " disabled"}>${playerOptions}</select>
            <button type="submit"${playerCandidates.length ? "" : " disabled"}>表示</button>
          </form>
          <div style="margin-top:4px;">${playerLinks}</div>
          <div style="margin-top:4px;">${legacyPlayerLinks}</div>
        </td></tr>
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
    <td>${ok ? `${healthMark("正常", "ok")}<font color="#008800">正常</font>` : `${healthMark("異常", "error")}<font color="#cc0000">異常</font>`}</td>
  </tr>`).join("");

  return page("Status", shell(`
    <fieldset>
      <legend><strong>伺服器狀態</strong></legend>
      <table class="form-table">
        <tr>
          <td><strong>　總狀態：</strong></td>
          <td>${status.ok ? `${healthMark("正常", "ok")}<font color="#008800">正常運作</font>` : `${healthMark("確認", "error")}<font color="#cc0000">需要確認</font>`}</td>
        </tr>
        <tr>
          <td><strong>　維護模式：</strong></td>
          <td>${status.maintenanceMode ? `${healthMark("啟用", "error")}<font color="#cc0000">啟用</font>` : `${healthMark("未啟用", "idle")}未啟用`}</td>
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
  `, "/status"));
}

export function renderAdminIndex(): string {
  return page("管理選單", shell(`
    <fieldset>
      <legend><strong>管理選單</strong></legend>
      <table class="form-table">
        <tr><td><strong>　廢村管理：</strong></td><td><a href="/admin.php?go=rooms">村子管理</a> - 檢視進行中/已結束村子，必要時以管理密碼廢村。</td></tr>
        <tr><td><strong>　系統設定：</strong></td><td><a href="/admin.php?go=config">設定管理</a> - 更新首頁公告與維護模式。</td></tr>
        <tr><td><strong>　討論管理：</strong></td><td><a href="/admin.php?go=bbs">討論管理</a> - 檢視主題並進入置頂、鎖定、精華設定。</td></tr>
        <tr><td><strong>　伺服器狀態：</strong></td><td><a href="/status">狀態檢查</a> - 檢查 D1、Durable Objects、R2、KV 綁定狀態。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>舊式管理登入</strong></legend>
      <form action="/admin.php?go=in" method="post">
        <table class="form-table">
          <tr><td><label><strong>　管理密碼：</strong></label></td><td><input name="apass" type="password" maxlength="128" size="24"> <input type="submit" value="登入"></td></tr>
          <tr><td></td><td class="muted">相容 reference 的 <code>admin.php?go=in</code>，登入後進入廢村管理。</td></tr>
        </table>
      </form>
    </fieldset>
    <fieldset>
      <legend><strong>管理說明</strong></legend>
      <table class="form-table">
        <tr><td><strong>　認證：</strong></td><td>各管理功能仍需輸入對應管理密碼；本頁只提供入口。</td></tr>
        <tr><td><strong>　紀錄：</strong></td><td>廢村與設定變更會透過既有 API 寫入對應的 D1 或 KV 狀態。</td></tr>
      </table>
    </fieldset>
  `, "/admin.php"));
}

export function renderBbsAdmin(topics: BbsTopicSummary[], options: { page?: number; pageSize?: number; totalTopics?: number } = {}): string {
  const pagination = paginationLinks(options.totalTopics, options.page, options.pageSize, "/admin.php?go=bbs");
  const rows = topics.length
    ? topics.map((topic) => {
      const topicPath = bbsTopicPath(topic.id);
      return `<tr>
        <td align="center">${escapeHtml(String(topic.id))}</td>
        <td><a href="${topicPath}">${escapeHtml(topic.title)}</a></td>
        <td>${escapeHtml(topic.name)}${topic.trip ? "◆Trip" : ""}</td>
        <td>${bbsStatusMarks(topic)}</td>
        <td align="center">${escapeHtml(String(topic.replyCount))}</td>
        <td>${escapeHtml(topic.updatedAt)}</td>
        <td><a href="${topicPath}#bbsModerationForm">管理</a></td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="7" class="muted">尚無主題。</td></tr>`;

  return page("BBS Admin", shell(`
    <fieldset>
      <legend><strong>討論管理</strong></legend>
      <table class="form-table">
        <tr><td><strong>　認證：</strong></td><td>主題狀態更新仍需在主題頁輸入 BBS 管理密碼。</td></tr>
        <tr><td><strong>　入口：</strong></td><td><a href="/bbs.php">全部主題</a>　<a href="/bbs.php?go=dige">精華主題</a></td></tr>
      </table>
      ${pagination}
      <table class="form-table" border="1" cellspacing="1" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">
        <thead><tr><td><strong>No.</strong></td><td><strong>標題</strong></td><td><strong>作者</strong></td><td><strong>狀態</strong></td><td><strong>回覆</strong></td><td><strong>更新</strong></td><td><strong>操作</strong></td></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${pagination}
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
        location.href = "/admin.php?go=rooms&token=" + encodeURIComponent(token);
      });
    </script>
  `));
}

export function renderAdminConfigLogin(): string {
  return page("Config Admin", shell(`
    <fieldset>
      <legend><strong>系統設定管理</strong></legend>
      <table class="form-table">
        <tr><td><label><strong>　管理密碼：</strong></label></td><td><input id="configAdminToken" type="password" maxlength="128" size="24"> <button id="configAdminLogin">登入</button></td></tr>
        <tr><td></td><td class="muted">輸入後會開啟公告與維護模式設定。</td></tr>
      </table>
    </fieldset>
    <script>
      const tokenInput = document.querySelector("#configAdminToken");
      tokenInput.value = localStorage.getItem("werewolf_cf_config_admin_token") || "";
      document.querySelector("#configAdminLogin").addEventListener("click", () => {
        const token = tokenInput.value;
        localStorage.setItem("werewolf_cf_config_admin_token", token);
        location.href = "/admin.php?go=config&token=" + encodeURIComponent(token);
      });
    </script>
  `));
}

export function renderAdminConfig(config: { homeAnnouncement: string | null; maintenanceMode: boolean }, adminToken = ""): string {
  return page("Config Admin", shell(`
    <fieldset>
      <legend><strong>系統設定管理</strong></legend>
      <table class="form-table">
        <tr><td><label><strong>　首頁公告：</strong></label></td><td><textarea id="configHomeAnnouncement" rows="4" cols="70">${escapeHtml(config.homeAnnouncement ?? "")}</textarea></td></tr>
        <tr><td><label><strong>　維護模式：</strong></label></td><td><label><input id="configMaintenanceMode" type="checkbox"${config.maintenanceMode ? " checked" : ""}> 暫停建立新村</label></td></tr>
        <tr><td></td><td><button id="configSave">儲存設定</button> <span id="configAdminStatus" class="muted"></span></td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>目前公開設定</strong></legend>
      <table class="form-table">
        <tr><td><strong>　公告：</strong></td><td>${config.homeAnnouncement ? escapeHtml(config.homeAnnouncement) : `<span class="muted">使用預設公告</span>`}</td></tr>
        <tr><td><strong>　維護模式：</strong></td><td>${config.maintenanceMode ? `<font color="#cc0000">啟用</font>` : "未啟用"}</td></tr>
        <tr><td><strong>　公開 API：</strong></td><td><a href="/api/config">/api/config</a></td></tr>
      </table>
    </fieldset>
    <script>
      const configAdminToken = new URLSearchParams(location.search).get("token") || localStorage.getItem("werewolf_cf_config_admin_token") || ${JSON.stringify(adminToken)};
      if (configAdminToken) localStorage.setItem("werewolf_cf_config_admin_token", configAdminToken);
      document.querySelector("#configSave").addEventListener("click", async () => {
        const status = document.querySelector("#configAdminStatus");
        status.textContent = "更新中";
        const res = await fetch("/api/admin/config", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-config-admin-token": configAdminToken },
          body: JSON.stringify({
            homeAnnouncement: document.querySelector("#configHomeAnnouncement").value,
            maintenanceMode: document.querySelector("#configMaintenanceMode").checked
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "更新失敗";
          return;
        }
        status.textContent = "已儲存";
      });
    </script>
  `));
}

type AdminRoomStatusFilter = "active" | "ended" | "all";

export function renderAdminRooms(rooms: RoomSummary[], statusFilter: AdminRoomStatusFilter = "active", adminToken = ""): string {
  const optionSummary = (room: RoomSummary): string => [
    room.options.realTime ? `限時 ${String(room.options.dayMinutes)}/${String(room.options.nightMinutes)}` : "",
    room.options.poison ? "埋毒" : "",
    room.options.bigWolf ? "大狼" : "",
    room.options.authority ? "權力" : "",
    room.options.decider ? "決定" : "",
    room.options.lovers ? "戀人" : "",
    room.options.betrayer ? "背德" : "",
    room.options.childFox ? "子狐" : "",
    room.options.twoFoxes ? "雙狐" : "",
    room.options.cat ? "貓又" : "",
    room.options.lastWords ? "遺言" : "",
    room.options.openVote ? "公開票" : "",
    room.options.commonTalkVisible ? "共有聲" : "",
    room.options.deadRoleVisible ? "靈視" : "",
    room.options.wishRole ? "希望" : "",
    channelRestrictionOptionMark(room).replace(/<[^>]+>/g, ""),
    room.options.tripRequired ? "Trip限定" : "",
    room.options.gmEnabled ? "GM制" : "",
    room.options.dummyBoy ? "替身" : "",
    room.options.customDummy ? "自訂替身" : "",
    room.options.selfVote ? "自投" : "",
    room.options.voteStatus ? "投票済" : ""
  ].filter(Boolean).join(" / ") || "標準";
  const optionMarkers = (room: RoomSummary): string => [
    room.options.realTime ? optionMark(`限時 ${String(room.options.dayMinutes)}/${String(room.options.nightMinutes)}`, "img/room_option_real_time.gif") : "",
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
  const filterHref = (filter: AdminRoomStatusFilter): string => {
    const query = `go=rooms&status=${encodeURIComponent(filter)}${adminToken ? `&token=${encodeURIComponent(adminToken)}` : ""}`;
    return `/admin.php?${escapeHtml(query)}`;
  };
  const filterLink = (filter: AdminRoomStatusFilter, label: string): string => (
    filter === statusFilter ? `<strong>${escapeHtml(label)}</strong>` : `<a href="${filterHref(filter)}">${escapeHtml(label)}</a>`
  );
  const legacyEndHref = (roomId: string): string => {
    const query = `go=del&id=${encodeURIComponent(roomId)}${adminToken ? `&token=${encodeURIComponent(adminToken)}` : ""}`;
    return `/admin.php?${escapeHtml(query)}`;
  };
  const rows = rooms.length
    ? rooms.map((room) => `<tr>
        <td><a href="/game_view.php?room_no=${encodeURIComponent(room.id)}">${escapeHtml(room.id)}</a></td>
        <td>${escapeHtml(room.name)}村</td>
        <td>${escapeHtml(room.comment || "－")}</td>
        <td>${maxPlayersMark(room.maxPlayers)}</td>
        <td>${roomStatusIcon(room.status)}${escapeHtml(federatedStatusLabel(room.status))}</td>
        <td title="${escapeHtml(optionSummary(room))}">${optionMarkers(room) || escapeHtml(optionSummary(room))}</td>
        <td>${escapeHtml(room.createdAt)}</td>
        <td><a href="/game_log.php?room_no=${encodeURIComponent(room.id)}&amp;log_mode=on">紀錄</a> / <a href="/room/${escapeHtml(room.id)}/events">事件</a></td>
        <td>${room.status === "ended" ? `<span class="muted">已結束</span>` : `<a href="${legacyEndHref(room.id)}">廢村</a> / <button class="adminEndRoom" data-room-id="${escapeHtml(room.id)}">API</button>`}</td>
      </tr>`).join("")
    : `<tr><td colspan="9" class="muted">目前沒有可廢除的村。</td></tr>`;

  return page("Room Admin", shell(`
    <fieldset>
      <legend><strong>廢村管理</strong></legend>
      <p class="muted">請選擇要廢除的村。注意！一旦選擇將無法復原。</p>
      <p>表示：${filterLink("active", "進行中")}　${filterLink("ended", "已結束")}　${filterLink("all", "全部")}</p>
      <table class="form-table" style="margin:12px 20px 18px;width:100%">
        <thead><tr><td><strong>村ID</strong></td><td><strong>村名</strong></td><td><strong>說明</strong></td><td><strong>人數</strong></td><td><strong>狀態</strong></td><td><strong>選項</strong></td><td><strong>建立時間</strong></td><td><strong>參照</strong></td><td><strong>操作</strong></td></tr></thead>
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

export function renderIconCatalog(activeMenu = "/icon_view.php"): string {
  const pageTitle = activeMenu === "/icon_upload.php" ? "用戶圖像上傳" : "用戶圖像一覽";
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
  const legacyIconColors = [
    "#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff",
    "#000033", "#333300", "#666600", "#999900", "#cccc00", "#ffff00",
    "#000066", "#333366", "#666633", "#999933", "#cccc33", "#ffff33",
    "#000099", "#333399", "#666699", "#999966", "#cccc66", "#ffff66",
    "#0000cc", "#3333cc", "#6666cc", "#9999cc", "#cccc99", "#ffff99",
    "#0000ff", "#3333ff", "#6666ff", "#9999ff", "#ccccff", "#ffffcc",
    "#003300", "#336633", "#669966", "#99cc99", "#ccffcc", "#ff00ff",
    "#006600", "#339933", "#66cc66", "#99ff99", "#cc00cc", "#ff33ff",
    "#009900", "#33cc33", "#66ff66", "#990099", "#cc33cc", "#ff66ff",
    "#00cc00", "#33ff33", "#660066", "#993399", "#cc66cc", "#ff99ff",
    "#00ff00", "#330033", "#663366", "#996699", "#cc99cc", "#ffccff",
    "#00ff33", "#330066", "#663399", "#9966cc", "#cc99ff", "#ffcc00",
    "#00ff66", "#330099", "#6633cc", "#9966ff", "#cc9900", "#ffcc33",
    "#00ff99", "#3300cc", "#6633ff", "#996600", "#cc9933", "#ffcc66",
    "#00ffcc", "#3300ff", "#663300", "#996633", "#cc9966", "#ffcc99",
    "#00ffff", "#330000", "#663333", "#996666", "#cc9999", "#ffcccc",
    "#00cccc", "#33ffff", "#660000", "#993333", "#cc6666", "#ff9999",
    "#009999", "#33cccc", "#66ffff", "#990000", "#cc3333", "#ff6666",
    "#006666", "#339999", "#66cccc", "#99ffff", "#cc0000", "#ff3333",
    "#003333", "#336666", "#669999", "#99cccc", "#ccffff", "#ff0000",
    "#003366", "#336699", "#6699cc", "#99ccff", "#ccff00", "#ff0033",
    "#003399", "#3366cc", "#6699ff", "#99cc00", "#ccff33", "#ff0066",
    "#0033cc", "#3366ff", "#669900", "#99cc33", "#ccff66", "#ff0099",
    "#0033ff", "#336600", "#669933", "#99cc66", "#ccff99", "#ff00cc",
    "#0066ff", "#339900", "#66cc33", "#99ff66", "#cc0099", "#ff33cc",
    "#0099ff", "#33cc00", "#66ff33", "#990066", "#cc3399", "#ff66cc",
    "#00ccff", "#33ff00", "#660033", "#993366", "#cc6699", "#ff99cc",
    "#00cc33", "#33ff66", "#660099", "#9933cc", "#cc66ff", "#ff9900",
    "#00cc66", "#33ff99", "#6600cc", "#9933ff", "#cc6600", "#ff9933",
    "#00cc99", "#33ffcc", "#6600ff", "#993300", "#cc6633", "#ff9966",
    "#009933", "#33cc66", "#66ff99", "#9900cc", "#cc33ff", "#ff6600",
    "#006633", "#339966", "#66cc99", "#99ffcc", "#cc00ff", "#ff3300",
    "#009966", "#33cc99", "#66ffcc", "#9900ff", "#cc3300", "#ff6633",
    "#0099cc", "#33ccff", "#66ff00", "#990033", "#cc3366", "#ff6699",
    "#0066cc", "#3399ff", "#66cc00", "#99ff33", "#cc0066", "#ff3399",
    "#006699", "#3399cc", "#66ccff", "#99ff00", "#cc0033", "#ff3366"
  ];
  const legacyIconLightColors = new Set([
    "#cccccc", "#ffffff", "#cccc00", "#ffff00", "#cccc33", "#ffff33",
    "#cccc66", "#ffff66", "#cccc99", "#ffff99", "#ccccff", "#ffffcc",
    "#99cc99", "#ccffcc", "#66cc66", "#99ff99", "#33cc33", "#66ff66",
    "#00cc00", "#33ff33", "#00ff00", "#ffccff", "#00ff33", "#ffcc00",
    "#00ff66", "#ffcc33", "#00ff99", "#ffcc66", "#00ffcc", "#ffcc99",
    "#00ffff", "#ffcccc", "#00cccc", "#33ffff", "#009999", "#33cccc",
    "#66ffff", "#339999", "#66cccc", "#99ffff", "#669999", "#99cccc",
    "#ccffff", "#6699cc", "#99ccff", "#ccff00", "#6699ff", "#99cc00",
    "#ccff33", "#669900", "#99cc33", "#ccff66", "#669933", "#99cc66",
    "#ccff99", "#66cc33", "#99ff66", "#33cc00", "#66ff33", "#00ccff",
    "#33ff00", "#00cc33", "#33ff66", "#00cc66", "#33ff99", "#00cc99",
    "#33ffcc", "#33cc66", "#66ff99", "#66cc99", "#99ffcc", "#33cc99",
    "#66ffcc", "#33ccff", "#66ff00", "#66cc00", "#99ff33", "#66ccff",
    "#99ff00"
  ]);
  const legacyColorRows = Array.from({ length: Math.ceil(legacyIconColors.length / 6) }, (_, rowIndex) => {
    const cells = legacyIconColors.slice(rowIndex * 6, rowIndex * 6 + 6).map((color) => {
      const darkText = legacyIconLightColors.has(color);
      return `<td align="middle" bgcolor="${escapeHtml(color)}"><input type="radio" name="color" value="${escapeHtml(color)}">${darkText ? escapeHtml(color) : `<font color="#ffffff">${escapeHtml(color)}</font>`}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const iconCells = icons.map((icon, index) => {
    const path = `user_icon/${icon.file}`;
    return `<td valign="top"><img src="/assets/reference/${escapeHtml(path)}" alt="${escapeHtml(icon.name)}" title="${escapeHtml(icon.name)}" width="32" height="32" border="2" style="border-color:${escapeHtml(icon.color)};"></td>
      <td width="150px">(${escapeHtml(String(index + 1))})<br>${escapeHtml(icon.name)}<br><font color="${escapeHtml(icon.color)}">◆</font><span style="font-family:新細明體;">${escapeHtml(icon.color)}</span><br><button class="iconPickButton" data-icon-path="${escapeHtml(path)}">使用</button></td>`;
  });
  const iconRows = Array.from({ length: Math.ceil(iconCells.length / 5) }, (_, rowIndex) => `<tr>${iconCells.slice(rowIndex * 5, rowIndex * 5 + 5).join("")}</tr>`).join("");

  return page(pageTitle, shell(`
    <fieldset style="background-image:url('/assets/reference/img/icon_view_bg.jpg'); background-repeat: repeat;">
      <legend><strong>頭像一覽</strong></legend>
      <p><a href="/index.php">←返回</a></p>
      <p><img class="title-img" src="/assets/reference/img/icon_view_title.jpg" alt="頭像一覽"></p>
      <p><a href="/icon_upload.php#upload" style="font-size:12pt;color:blue;">→頭像登錄</a></p>
      <table class="form-table">
        <tr><td><strong>　來源：</strong></td><td>Reference default icons copied to R2 under <code>reference/user_icon/</code>.</td></tr>
        <tr><td><strong>　尺寸：</strong></td><td>32 x 32</td></tr>
        <tr><td><strong>　選擇：</strong></td><td><span id="iconPickStatus" class="muted">選定後會套用到入村表單。</span></td></tr>
      </table>
      <table border="0" style="font-size:12pt;margin:12px auto 18px;">
        ${iconRows}
      </table>
    </fieldset>
    <fieldset id="upload" style="background-image:url('/assets/reference/img/icon_upload_bg.jpg'); background-repeat: repeat;">
      <legend><strong>上傳頭像</strong></legend>
      <p><a href="/index.php">←返回</a></p>
      <p><img class="title-img" src="/assets/reference/img/icon_upload_title.jpg" alt="上傳頭像"></p>
      <p><a href="/icon_view.php" style="font-size:12pt;color:blue;">→圖像一覽</a></p>
      <p align="right">請勿上傳動態GIF，上傳後會以 Cloudflare R2 保存為玩家頭像。</p>
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
      <form method="post" action="/upload.php" enctype="multipart/form-data" style="margin:10px 20px;">
        <strong>舊式上傳：</strong>
        玩家ID <input name="player_id" maxlength="64" size="20">
        圖片選擇 <input name="icon_file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="80" style="border-width:1px;border-color:black;border-style:solid;background-color:aliceblue;">
        圖像名稱 <input name="icon_name" type="text" maxlength="20" size="20" style="border-width:1px;border-color:black;border-style:solid;background-color:aliceblue;">
        <br>
        <strong>圖像的顏色選擇</strong>
        <label><input type="radio" name="color">自行輸入顏色</label>
        <input name="color" maxlength="7" size="10" style="border-width:1px;border-color:black;border-style:solid;background-color:aliceblue;">(例：#6699cc)
        <table cellspacing="2" cellpadding="0" border="0" width="600" style="margin:6px 0;">${legacyColorRows}</table>
        <input name="submit" type="submit" value="登錄" style="border-width:1px;border-color:black;border-style:solid;">
      </form>
      <form method="post" action="/upload2.php" enctype="multipart/form-data" style="margin:10px 20px;">
        <strong>舊式刪除：</strong>
        玩家ID <input name="player_id" maxlength="64" size="20">
        <input name="submit" type="submit" value="刪除">
      </form>
    </fieldset>
    <script>
      const iconUploadPlayerId = document.querySelector("#iconUploadPlayerId");
      const iconUploadFile = document.querySelector("#iconUploadFile");
      const iconUploadStatus = document.querySelector("#iconUploadStatus");
      const iconPickStatus = document.querySelector("#iconPickStatus");
      const playerKey = "werewolf_cf_player_id";
      if (!localStorage.getItem(playerKey)) {
        localStorage.setItem(playerKey, "player_" + crypto.randomUUID().replaceAll("-", ""));
      }
      iconUploadPlayerId.value = localStorage.getItem(playerKey);
      document.querySelectorAll(".iconPickButton").forEach((button) => {
        button.addEventListener("click", () => {
          const iconPath = button.getAttribute("data-icon-path") || "";
          localStorage.setItem("werewolf_cf_default_icon", iconPath);
          iconPickStatus.textContent = iconPath ? "已選擇 " + iconPath : "未選擇頭像";
        });
      });
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
  `, activeMenu));
}

export function renderHome(rooms: RoomSummary[], announcement = DEFAULT_ANNOUNCEMENT, maintenanceMode = false): string {
  const roomRows = rooms.length === 0
    ? `<div class="muted">目前沒有村子。</div>`
    : rooms.map((room) => {
      const status = escapeHtml(room.status);
      const roomEntryUrl = `/login.php?room_no=${encodeURIComponent(room.id)}`;
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
        <a href="${escapeHtml(roomEntryUrl)}"><span class="room-line"><span class="status status-${status}">${roomStatusIcon(room.status)}${status}</span><small>[${escapeHtml(room.id)}]</small> ${escapeHtml(room.name)}村</span></a>
        <small> <a href="${escapeHtml(roomEntryUrl)}">入村</a></small>
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
          <td><label><strong>　${referenceAssetImg("img/room_option_real_time.gif", "限時")}限時時間：</strong></label></td>
          <td>
            <label><input id="optionRealTime" type="checkbox"> <small>日：</small></label>
            <input id="optionDayMinutes" type="number" min="1" max="99" step="0.5" value="3" size="4">
            <small>分　夜：</small>
            <input id="optionNightMinutes" type="number" min="1" max="99" step="0.5" value="1.5" size="4">
            <small>分</small>
          </td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_poison.gif", "埋毒者")}20人以上埋毒者選項：</strong></label></td>
          <td><label><input id="optionPoison" type="checkbox"> <small>埋毒者登場</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_wfbig.gif", "大狼")}20人以上時大狼出場：</strong></label></td>
          <td><label><input id="optionBigWolf" type="checkbox"> <small>狼群隨機一隻取代為大狼</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_authority.gif", "權力者")}16人以上權力者出場：</strong></label></td>
          <td><label><input id="optionAuthority" type="checkbox"> <small>處刑投票時一票算兩票</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_decide.gif", "決定者")}16人以上決定者出場：</strong></label></td>
          <td><label><input id="optionDecider" type="checkbox"> <small>同票時決定者投票優先</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_lovers.gif", "戀人")}13人以上戀人出場：</strong></label></td>
          <td><label><input id="optionLovers" type="checkbox"> <small>兩名戀人生存到勝利條件時戀人勝利</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_betr.gif", "背德者")}20人以上妖狐的選項：</strong></label></td>
          <td>
            <label><input id="optionFoxNone" name="optionFoxVariant" type="radio" checked> <small>追加なし</small></label>
            <label><input id="optionBetrayer" name="optionFoxVariant" type="radio"> <small>背德者登場，妖狐死亡時跟隨死亡</small></label>
          </td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_fosi.gif", "子狐")}20人以上妖狐的占：</strong></label></td>
          <td><label><input id="optionChildFox" name="optionFoxVariant" type="radio"> <small>子狐登場，可於夜晚占卜但可能失敗</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_foxs.gif", "雙狐")}20人以上兩隻妖狐：</strong></label></td>
          <td><label><input id="optionTwoFoxes" name="optionFoxVariant" type="radio"> <small>第二隻妖狐登場</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_cat.gif", "貓又")}20人以上貓又登場：</strong></label></td>
          <td><label><input id="optionCat" type="checkbox"> <small>貓又登場，可牽連死亡並嘗試復活</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_will.gif", "遺言")}遺言：</strong></label></td>
          <td><label><input id="optionLastWords" type="checkbox"> <small>生存中可留下死亡時公開的遺言</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_open_vote.gif", "公開投票")}公開投票：</strong></label></td>
          <td><label><input id="optionOpenVote" type="checkbox"> <small>白天公開目前投票目標</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_common.gif", "共有者")}共生者夜晚對話顯示：</strong></label></td>
          <td><label><input id="optionCommonTalkVisible" type="checkbox"> <small>允許晚上顯示共生者悄悄話</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_rei.gif", "靈界")}幽靈是否可以看角色：</strong></label></td>
          <td><label><input id="optionDeadRoleVisible" type="checkbox"> <small>允許幽靈觀看角色</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_wish_role.gif", "希望角色")}希望角色制：</strong></label></td>
          <td><label><input id="optionWishRole" type="checkbox"> <small>允許加入時選擇希望角色</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_trip.gif", "Trip")}啟用強制Trip登記：</strong></label></td>
          <td><label><input id="optionTripRequired" type="checkbox"> <small>沒有英數 Trip 身分碼將無法登錄成村民</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_gm.gif", "GM")}啟用GM系統：</strong></label></td>
          <td><label><input id="optionGmEnabled" type="checkbox"> <small>指定 Trip 進房後成為 GM，不加入角色分配</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　GM Trip：</strong></label></td>
          <td><input id="gmTrip" maxlength="32" size="10"></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_dummy_boy.gif", "替身君")}替身君：</strong></label></td>
          <td><label><input id="optionDummyBoy" type="checkbox"> <small>加入替身君並從第一夜開始</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/room_option_dummy_boy.gif", "替身君")}替身君自訂：</strong></label></td>
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
          <td><label><strong>　${referenceAssetImg("img/room_option_voteme.gif", "自投")}啟用白天自投功能：</strong></label></td>
          <td><label><input id="optionSelfVote" type="checkbox"> <small>允許玩家白天投票給自己</small></label></td>
        </tr>
        <tr>
          <td><label><strong>　${referenceAssetImg("img/conn_look.gif", "投票顯示")}啟用白天投票顯示：</strong></label></td>
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
  `, "/"));
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
      function appendRoleIcon(container, role) {
        const path = roleIconPath(role);
        if (!path) return;
        const image = document.createElement("img");
        image.src = "/assets/reference/" + path;
        image.alt = roleLabel(role);
        image.title = roleLabel(role);
        image.width = 16;
        image.height = 16;
        image.className = "ref-icon";
        container.appendChild(image);
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
            div.append(record.createdAt + "　[" + record.roomId + "] " + winner + " 勝　第 " + day + " 日　");
            appendRoleIcon(div, record.role);
            div.append(roleLabel(record.role));
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
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <fieldset>
      <legend><strong>Trip查詢</strong></legend>
      <form name="trip" action="/trip.php" method="get" enctype="multipart/form-data" style="margin:10px 20px;">
        搜尋Trip <input type="text" name="sname" size="9" value="">
        <input id="submit" name="go" type="submit" value="search">
      </form>
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
      function tripStateMark(label, state) {
        const className = state === "ok" ? "health-ok" : state === "error" ? "health-error" : "health-idle";
        return '<span class="health-mark ' + className + '">' + escapeClientHtml(label) + '</span>';
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
            '<tr><td><strong>　登記：</strong></td><td>' + (value.registered ? tripStateMark("已登記", "ok") + "已登記" : tripStateMark("未登記", "idle") + "未登記") + '</td></tr>',
            '<tr><td><strong>　排除：</strong></td><td>' + (value.excluded ? tripStateMark("已排除", "error") + '<font color="#990000">已排除</font>' : tripStateMark("未排除", "ok") + "未排除") + '</td></tr>',
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
  `, "/trips"));
}

export function renderTripDetail(tripId: string, summary: TripPublicSummary): string {
  const playerRows = summary.players.length
    ? summary.players.map((playerId, index) => `
        <tr>
          <td align="center">${index + 1}</td>
          <td align="center"><a href="/player/${escapeHtml(playerId)}">${escapeHtml(playerId)}</a></td>
        </tr>
      `).join("")
    : `<tr><td colspan="2" align="center" class="muted">尚無認領玩家。</td></tr>`;
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <center>
      <strong>Trip公開資料</strong><br>
      該Trip使用 ${summary.stats.gamesPlayed} 次，已知使用玩家如下(排除重複)<br>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}">參與紀錄</a>
      (正:${summary.scores.positive}/負:${summary.scores.negative})<a href="/trip.php?go=smess&id=${escapeHtml(tripId)}">評語詳細</a>
      <a href="/trips">Trip查詢</a>
    </center>
    <table border="1" class="table1" bordercolor="#CCCCCC" align="center">
      <tr class="table3">
        <td align="center" width="90">項目</td>
        <td align="center" width="240">狀態</td>
      </tr>
      <tr>
        <td align="center">Trip</td>
        <td align="center">${escapeHtml(tripId)}</td>
      </tr>
      <tr>
        <td align="center">登記</td>
        <td align="center">${summary.registered ? `<span class="health-mark health-ok">已登記</span>已登記` : `<span class="health-mark health-idle">未登記</span>未登記`}</td>
      </tr>
      <tr>
        <td align="center">排除</td>
        <td align="center">${summary.excluded ? `<span class="health-mark health-error">已排除</span><font color="#990000">已排除</font>` : `<span class="health-mark health-ok">未排除</span>未排除`}</td>
      </tr>
      <tr>
        <td align="center">戰績</td>
        <td align="center">正:${summary.stats.wins}/負:${summary.stats.losses}/場:${summary.stats.gamesPlayed}</td>
      </tr>
    </table>
    <br>
    <table border="1" class="table1" bordercolor="#CCCCCC" align="center">
      <tr class="table3">
        <td align="center" width="50">ID</td>
        <td align="center" width="180">玩家</td>
      </tr>
      ${playerRows}
    </table>
  `, "/trip.php"));
}

export function renderTripComments(tripId: string, scores: TripScoreSummary[] = [], options: { page?: number; pageSize?: number; totalScores?: number } = {}): string {
  const pagination = paginationLinks(options.totalScores, options.page, options.pageSize, `/trip.php?go=smess&id=${encodeURIComponent(tripId)}`);
  const rows = scores.length
    ? scores.map((score) => `
      <tr>
        <td align="center"><a href="/old_log.php?log_mode=on&amp;room_no=${escapeHtml(score.roomId)}">${escapeHtml(score.roomId)}</a></td>
        <td align="center"><a href="/trip.php?go=trip&id=${escapeHtml(score.reviewerTrip)}">${escapeHtml(score.reviewerTrip || "--")}</a></td>
        <td align="center">${score.score === 1 ? "正" : "負"}</td>
        <td align="center">${escapeHtml(score.message || "無評語")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" align="center" class="muted">沒有資料</td></tr>`;
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <center>
      <strong>評語</strong><br>
      <a href="/trip.php?go=trip&id=${escapeHtml(tripId)}">Trip公開資料</a>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}">參與紀錄</a>
      <a href="/trips">Trip查詢</a>
    </center>
    ${pagination}
    <table border="1" class="table1" bordercolor="#CCCCCC" align="center">
      <tr class="table3">
        <td align="center" width="70">村莊ID</td>
        <td align="center" width="100">評論者</td>
        <td align="center" width="50">評價</td>
        <td align="center" width="400">評語</td>
      </tr>
      ${rows}
    </table>
    ${pagination}
  `, "/trip.php"));
}

export function renderTripRating(roomId: string, tripId: string): string {
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <center>
      <strong>評分</strong><br>
      <a href="/trip.php?go=trip&id=${escapeHtml(tripId)}">Trip公開資料</a>
      <a href="/trip.php?go=smess&id=${escapeHtml(tripId)}">評語詳細</a>
      <a href="/old_log.php?log_mode=on&amp;room_no=${escapeHtml(roomId)}">過去紀錄</a>
    </center>
    <fieldset>
      <legend><strong>評分</strong></legend>
      <form name="trip" action="/trip.php?go=sce&amp;room=${escapeHtml(roomId)}&amp;trip=${escapeHtml(tripId)}" method="post" enctype="multipart/form-data" style="margin:10px 20px;">
        <ul>
          <li>請選擇正評價或負評價，一旦送出將不可恢復。</li>
          <li>正評 <input type="radio" name="sceis" value="1" disabled></li>
          <li>負評 <input type="radio" name="sceis" value="2" disabled></li>
          <li>意見 <input type="text" name="mess" size="30" value="" disabled></li>
          <li><input id="submit" name="submit" type="submit" value="送出" disabled></li>
        </ul>
        <p class="muted">此 Cloudflare 版本尚未保存 PHP <code>trip_score</code> 評分資料；本頁僅保留舊式入口與表單外觀。</p>
      </form>
    </fieldset>
  `, "/trip.php"));
}

export function renderTripRoomRecords(tripId: string, records: TripRoomRecordSummary[], options: { page?: number; pageSize?: number; totalRecords?: number; play?: number } = {}): string {
  const roomBasePath = `/trip.php?go=room&id=${encodeURIComponent(tripId)}${options.play ? `&play=${String(options.play)}` : ""}`;
  const pagination = paginationLinks(options.totalRecords, options.page, options.pageSize, roomBasePath);
  const recordRows = records.length
    ? records.map((record) => `
        <tr>
          <td align="center"><a href="/old_log.php?log_mode=on&amp;room_no=${encodeURIComponent(record.roomId)}" target="_blank">${escapeHtml(record.roomId)}</a></td>
          <td align="center"><a href="/player/${escapeHtml(record.playerId)}">${escapeHtml(record.nickname)}</a></td>
          <td align="center">${roleLabelHtml(record.role)}</td>
          <td align="center">${record.alive ? "生存" : "死亡"}</td>
          <td align="center">${record.winner ? referenceAssetImg(winnerIconPath(record.winner), `${winnerLabel(record.winner)}勝利`) : "不明"}</td>
          <td align="center">${record.day ?? "?"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="6" align="center" class="muted">玩家尚未登記或無資料。</td></tr>`;
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <center>
      <strong>Trip參與紀錄</strong><br>
      <a href="/trip.php?go=trip&id=${escapeHtml(tripId)}">Trip公開資料</a>
      <a href="/trips">Trip查詢</a>
      <br>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}">全部</a>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}&amp;play=8">8</a>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}&amp;play=16">16</a>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}&amp;play=22">22</a>
      <a href="/trip.php?go=room&id=${escapeHtml(tripId)}&amp;play=30">30</a>
    </center>
    ${pagination}
    <table border="1" class="table1" bordercolor="#CCCCCC" align="center">
      <tr class="table3">
        <td align="center" width="70">村莊ID</td>
        <td align="center" width="180">暱稱</td>
        <td align="center" width="80">職業</td>
        <td align="center" width="50">狀態</td>
        <td align="center" width="50">勝利</td>
        <td align="center" width="50">日數</td>
      </tr>
      ${recordRows}
    </table>
    ${pagination}
  `, "/trip.php"));
}

export function renderTripRegistration(): string {
  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <p>
      <a href="/trip.php?go=post">身份登錄</a>
       <a href="/trip.php?go=edit2">修改紀錄</a>
       <a href="/trip.php?go=edit">修改Trip</a>
       <a href="/trip.php?go=accadd">認領帳號</a>
       <a href="/trip.php?go=out">排除紀錄</a>
       <a href="/trip.php?go=icon">上傳頭像</a>
       <a href="/trips">Trip查詢</a>
    </p>
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
      <form name="trip" method="post" action="/trip.php?go=post" enctype="multipart/form-data" style="margin:10px 20px;">
        <strong>舊式登錄：</strong>
        TRIP <input type="text" name="name" maxlength="32" size="24" value="">
        密碼 <input type="password" name="password" maxlength="128" size="24" value="">
        <input id="submit" name="submit" type="submit" value="送出">
      </form>
    </fieldset>
    <fieldset>
      <legend><strong>認領帳號</strong></legend>
      <form name="trip" method="post" action="/trip.php?go=accadd" enctype="multipart/form-data" style="margin:10px 20px;">
        <ul>
          <li>請輸入登記之Trip，不是加密後的Trip。</li>
          <li>認領帳號與密碼為過去紀錄之帳號密碼，相同者將會加上Trip。</li>
          <li>TRIP <input type="text" name="name" size="24" value=""></li>
          <li>密碼 <input type="password" name="password" size="24" value=""></li>
          <li>認領帳號 <input type="text" name="aname" size="24" value=""></li>
          <li>認領密碼 <input type="password" name="apassword" size="24" value=""></li>
          <li>此 Cloudflare 版本不保存過去紀錄村民註冊密碼；請使用上方認領身份按鈕綁定目前玩家。</li>
        </ul>
        <input id="tripClaimLegacySubmit" name="submit" type="submit" value="送出" disabled>
      </form>
    </fieldset>
    <fieldset>
      <legend><strong>排除紀錄</strong></legend>
      <form name="trip" method="post" action="/trip.php?go=out" enctype="multipart/form-data" style="margin:10px 20px;">
        <ul>
          <li>請輸入登記之Trip，不是加密後的Trip。</li>
          <li>排除紀錄請輸入過去紀錄之玩家暱稱。</li>
        </ul>
        TRIP <input type="text" name="name" maxlength="32" size="24" value="">
        密碼 <input type="password" name="password" maxlength="128" size="24" value="">
        暱稱 <input type="text" name="aname" maxlength="120" size="24" value="">
        <input id="submit" name="submit" type="submit" value="送出">
      </form>
    </fieldset>
    <fieldset>
      <legend><strong>修改Trip</strong></legend>
      <form name="trip" method="post" action="/trip.php?go=edit" enctype="multipart/form-data" style="margin:10px 20px;">
        <ul>
          <li>舊的TRIP <input type="text" name="name" size="24" value=""></li>
          <li>管理密碼 <input type="password" name="password" size="24" value=""></li>
          <li>新的TRIP <input type="text" name="nname" size="24" value=""></li>
          <li>此 Cloudflare 版本不保存舊 PHP 管理密碼；請使用認領身份流程綁定目前玩家。</li>
        </ul>
        <input id="tripEditSubmit" name="submit" type="submit" value="送出" disabled>
      </form>
    </fieldset>
    <fieldset>
      <legend><strong>修改紀錄</strong></legend>
      <form name="trip" method="post" action="/trip.php?go=edit2" enctype="multipart/form-data" style="margin:10px 20px;">
        <ul>
          <li>請輸入登記之Trip，不是加密後的Trip。</li>
          <li>舊Trip請輸入加密前的，帳號密碼為過去紀錄村民註冊之密碼。</li>
          <li>過去紀錄相同的Trip與帳號與密碼將會取代Trip。</li>
          <li>TRIP <input type="text" name="name" size="24" value=""></li>
          <li>密碼 <input type="password" name="password" size="24" value=""></li>
          <li>舊TRIP <input type="text" name="lname" size="24" value=""></li>
          <li>帳號密碼 <input type="password" name="lpassword" size="24" value=""></li>
        </ul>
        <input id="tripEditRecordSubmit" name="submit" type="submit" value="送出" disabled>
      </form>
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
      function tripStateMark(label, state) {
        const className = state === "ok" ? "health-ok" : state === "error" ? "health-error" : "health-idle";
        return '<span class="health-mark ' + className + '">' + escapeClientHtml(label) + '</span>';
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
            '<tr><td><strong>　登記：</strong></td><td>' + (value.registered ? tripStateMark("已登記", "ok") + "已登記" : tripStateMark("未登記", "idle") + "未登記") + '</td></tr>',
            '<tr><td><strong>　排除：</strong></td><td>' + (value.excluded ? tripStateMark("已排除", "error") + '<font color="#990000">已排除</font>' : tripStateMark("未排除", "ok") + "未排除") + '</td></tr>',
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
  `, "/trip.php"));
}

function paginationLinks(totalItems: number | undefined, page: number | undefined, pageSize: number | undefined, basePath: string): string {
  if (!totalItems || !pageSize || totalItems <= pageSize) {
    return "";
  }
  const currentPage = Math.max(1, page ?? 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageHref = (targetPage: number) => `${basePath}${basePath.includes("?") ? "&" : "?"}page=${targetPage}`;
  const links = Array.from({ length: totalPages }, (_, index) => {
    const targetPage = index + 1;
    return targetPage === currentPage
      ? `<strong>[${escapeHtml(String(targetPage))}]</strong>`
      : `<a href="${pageHref(targetPage)}">[${escapeHtml(String(targetPage))}]</a>`;
  });
  return `<center class="bbs-pagination">${links.join(" ")}</center>`;
}

const BBS_REPLY_PAGE_SIZE = 10;

function bbsTopicLatestReplyPath(topic: BbsTopicSummary): string {
  const topicPath = bbsTopicPath(topic.id);
  const lastPage = Math.max(1, Math.ceil(topic.replyCount / BBS_REPLY_PAGE_SIZE));
  return lastPage > 1 ? `${topicPath}&page=${lastPage}` : topicPath;
}

export function renderBbs(topics: BbsTopicSummary[], options: { digestOnly?: boolean; page?: number; pageSize?: number; totalTopics?: number } = {}): string {
  const topicRows = topics.length
    ? topics.map((topic) => {
      const legacyTitle = `${topic.pinned ? "[置頂] " : ""}${topic.locked ? "[鎖定] " : ""}${topic.title}${topic.digest ? " (精華)" : ""}`;
      const topicPath = bbsTopicPath(topic.id);
      const latestReplyPath = bbsTopicLatestReplyPath(topic);
      return `<tr>
        <td align="center"><a href="${topicPath}">${escapeHtml(String(topic.id))}</a></td>
        <td><a href="${latestReplyPath}" title="${escapeHtml(legacyTitle)}">${bbsStatusMarks(topic, true)}${escapeHtml(topic.title)}</a></td>
        <td align="center">${escapeHtml(topic.name)}${topic.trip ? "◆Trip" : ""}</td>
        <td align="center">${escapeHtml(String(topic.replyCount))}</td>
        <td align="center">${escapeHtml(topic.updatedAt)}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="muted">${options.digestOnly ? "沒有精華" : "沒有主題"}</td></tr>`;
  const listTitle = options.digestOnly ? "精華主題列表" : "主題列表";
  const pagination = paginationLinks(options.totalTopics, options.page, options.pageSize, options.digestOnly ? "/bbs.php?go=dige" : "/bbs.php");

  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <p><a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php">全部主題</a> <a href="/bbs.php?go=dige">精華區</a></p>
    <fieldset>
      <legend><strong>${listTitle}</strong></legend>
      ${pagination}
      <div style="line-height:135%;margin:20px 20px 30px;">
        <strong>
          <table border="1" class="table1" bordercolor="#CCCCCC" align="center">
            <tr class="table3">
              <td align="center" width="50"> No.</td>
              <td width="320">標題</td>
              <td align="center" width="170">作者</td>
              <td align="center" width="40">回覆</td>
              <td align="center" width="150">最後時間</td>
            </tr>
            ${topicRows}
          </table>
        </strong>
      </div>
      ${pagination}
    </fieldset>
    <fieldset id="bbsPostForm">
      <legend><strong>發表主題</strong></legend>
      <form name="bbs" method="post" action="/bbs.php?go=post" enctype="multipart/form-data" style="margin:10px 20px;">
        <strong>舊式發表：</strong>
        暱稱 <input type="text" name="bname" maxlength="32" size="24">
        密碼 <input type="password" name="bpass" maxlength="128" size="24">
        標題 <input type="text" name="title" maxlength="50" size="24"><br>
        內容<br><textarea name="mess" rows="5" cols="64"></textarea><br>
        <input id="submit" name="submit" type="submit" value="發表">
      </form>
      <table class="form-table">
        <tr><td><label><strong>　名稱：</strong></label></td><td><input id="bbsName" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　Trip：</strong></label></td><td><input id="bbsTrip" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　密碼：</strong></label></td><td><input id="bbsPassword" type="password" maxlength="128" size="24"> <span class="muted">編輯/刪除用</span></td></tr>
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
            password: document.querySelector("#bbsPassword").value,
            title: document.querySelector("#bbsTitle").value,
            message: document.querySelector("#bbsMessage").value
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "發表失敗";
          return;
        }
        const topicId = Number(data.topicId);
        location.href = Number.isInteger(topicId) && topicId > 0 ? "/bbs.php?view=" + encodeURIComponent(String(topicId)) : "/bbs.php";
      });
    </script>
  `, options.digestOnly ? "/bbs.php?go=dige" : "/bbs.php"));
}

function bbsAuthorLabel(name: string, trip: boolean): string {
  return `${escapeHtml(name)}${trip ? "◆Trip" : ""}`;
}

function bbsTopicPath(topicId: number | string): string {
  return `/bbs.php?view=${encodeURIComponent(String(topicId))}`;
}

function formatBbsMessageHtml(message: string): string {
  const escaped = escapeHtml(message);
  return escaped
    .replace(/\[url\]((?:www\.|https?:\/\/|ftp:\/\/|telnet:\/\/)[^\["']+?)\[\/url\]/gi, (_match, rawUrl: string) => {
      const href = rawUrl.startsWith("www.") ? `http://${rawUrl}` : rawUrl;
      return `<a href="${escapeHtml(href)}" target="_blank">${escapeHtml(rawUrl)}</a>`;
    })
    .replace(/\[color=([#a-z0-9]+)\]([\s\S]+?)\[\/color\]/gi, (_match, color: string, content: string) => {
      if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) && !/^[a-z]+$/i.test(color)) {
        return content;
      }
      return `<font color="${escapeHtml(color)}">${content}</font>`;
    })
    .replace(/\[b\]([\s\S]+?)\[\/b\]/gi, "<b>$1</b>")
    .replace(/\r?\n/g, "<br />");
}

function bbsStatusMarks(topic: Pick<BbsTopicSummary, "pinned" | "locked" | "digest">, bracketed = false): string {
  const marks = [
    topic.pinned ? `<span class="bbs-status-mark bbs-topic-pinned">${bracketed ? "[置頂]" : "置頂"}</span>` : "",
    topic.locked ? `<span class="bbs-status-mark bbs-topic-locked">${bracketed ? "[鎖定]" : "鎖定"}</span>` : "",
    topic.digest ? `<span class="bbs-status-mark bbs-topic-digest">${bracketed ? "(精華)" : "精華"}</span>` : ""
  ].filter(Boolean);
  return marks.length ? marks.join(" ") : `<span class="bbs-status-mark">一般</span>`;
}

export function renderBbsTopic(topic: BbsTopicSummary, replies: BbsReplySummary[], options: { page?: number; pageSize?: number; totalReplies?: number } = {}): string {
  const topicPath = bbsTopicPath(topic.id);
  const pagination = paginationLinks(options.totalReplies, options.page, options.pageSize, topicPath);
  const replyRows = replies.length
    ? replies.map((reply) => `<tr><td class="table3">${bbsAuthorLabel(reply.name, reply.trip)}</td></tr>
        <tr><td class="table4"><div>${formatBbsMessageHtml(reply.message)}</div></td></tr>
        <tr><td class="table2"><a href="/bbs.php?go=edit&amp;id=${escapeHtml(String(reply.id))}">NO.${escapeHtml(String(reply.id))}</a> &lt;..&gt; [${escapeHtml(reply.createdAt)}]</td></tr>
        <tr><td class="table4">
            <textarea class="bbsReplyEditMessage" data-reply-id="${escapeHtml(String(reply.id))}" rows="3" cols="60">${escapeHtml(reply.message)}</textarea><br>
            <input class="bbsReplyEditPassword" data-reply-id="${escapeHtml(String(reply.id))}" type="password" maxlength="128" size="24" placeholder="回覆密碼">
            <button class="bbsReplyEditButton" data-reply-id="${escapeHtml(String(reply.id))}">編輯回覆</button>
            <button class="bbsReplyDeleteButton" data-reply-id="${escapeHtml(String(reply.id))}">刪除回覆</button>
          </td></tr>`).join("")
    : `<tr><td class="table4 muted">尚無回覆。</td></tr>`;

  const title = `${topic.pinned ? "[置頂] " : ""}${topic.locked ? "[鎖定] " : ""}${topic.title}${topic.digest ? " (精華)" : ""}`;
  const topicTitle = `${topic.pinned ? "[置頂] " : ""}${topic.locked ? "[鎖定] " : ""}<b>${escapeHtml(topic.title)}</b>${topic.digest ? " (精華)" : ""}`;
  const replyForm = topic.locked
    ? `<p class="muted">此主題已鎖定。</p>`
    : `<form name="bbs" method="post" action="/bbs.php?go=postre" enctype="multipart/form-data" style="margin:10px 20px;">
        <strong>舊式回覆：</strong>
        暱稱 <input type="text" name="bname" maxlength="32" size="24">
        密碼 <input type="password" name="bpass" maxlength="128" size="24"><br>
        內容<br><textarea name="mess" rows="5" cols="64"></textarea>
        <input type="hidden" name="id" value="${escapeHtml(String(topic.id))}"><br>
        <input id="submit" name="submit" type="submit" value="回覆">
      </form>
      <table class="form-table">
        <tr><td><label><strong>　名稱：</strong></label></td><td><input id="bbsReplyName" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　Trip：</strong></label></td><td><input id="bbsReplyTrip" maxlength="32" size="24"></td></tr>
        <tr><td><label><strong>　密碼：</strong></label></td><td><input id="bbsReplyPassword" type="password" maxlength="128" size="24"> <span class="muted">編輯/刪除用</span></td></tr>
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
              password: document.querySelector("#bbsReplyPassword").value,
              message: document.querySelector("#bbsReplyMessage").value
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            status.textContent = data.error || "回覆失敗";
            return;
          }
          const replyPage = Number(data.page);
          location.href = Number.isInteger(replyPage) && replyPage > 1 ? "${topicPath}&page=" + encodeURIComponent(String(replyPage)) : "${topicPath}";
        });
      </script>`;
  const moderationPanel = `<form name="bbs" method="post" action="/bbs.php?go=edit&amp;id=${escapeHtml(String(topic.id))}" enctype="multipart/form-data" style="margin:10px 20px;">
      您對文章編號${escapeHtml(String(topic.id))}進行管理，請選擇項目<br>
      <select name="editis">
        <option value="del">刪除</option>
        <option value="edit" selected>編輯</option>
        <option value="tolock">鎖定</option>
        <option value="totop">置頂</option>
        <option value="nolock">解鎖定</option>
        <option value="notop">解置頂</option>
        <option value="todige">加精華</option>
        <option value="nodige">解精華</option>
      </select>
      密碼 <input type="password" name="password" maxlength="128" size="24" value=""><br>
      <input id="submit" name="submit" type="submit" value="送出">
    </form>
    <table class="form-table">
      <tr><td><label><strong>　管理密碼：</strong></label></td><td><input id="bbsAdminToken" type="password" maxlength="128" size="32"></td></tr>
      <tr><td><strong>　項目：</strong></td><td>
        <label><input id="bbsModeratePinned" type="checkbox"${topic.pinned ? " checked" : ""}> 置頂</label>
        <label><input id="bbsModerateLocked" type="checkbox"${topic.locked ? " checked" : ""}> 鎖定</label>
        <label><input id="bbsModerateDigest" type="checkbox"${topic.digest ? " checked" : ""}> 精華</label>
      </td></tr>
      <tr><td><label><strong>　標題：</strong></label></td><td><input id="bbsEditTitle" maxlength="50" size="48" value="${escapeHtml(topic.title)}"></td></tr>
      <tr><td><label><strong>　本文：</strong></label></td><td><textarea id="bbsEditMessage" rows="5" cols="64">${escapeHtml(topic.message)}</textarea></td></tr>
      <tr><td><label><strong>　文章密碼：</strong></label></td><td><input id="bbsEditPassword" type="password" maxlength="128" size="24"> <span class="muted">一般使用者編輯/刪除用</span></td></tr>
      <tr><td></td><td><button id="bbsModerateButton">更新狀態</button> <button id="bbsTopicEditButton">編輯本文</button> <button id="bbsDeleteButton">刪除</button> <span id="bbsModerateStatus" class="muted"></span></td></tr>
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
        location.href = "${topicPath}";
      });
      document.querySelector("#bbsTopicEditButton").addEventListener("click", async () => {
        const status = document.querySelector("#bbsModerateStatus");
        const token = document.querySelector("#bbsAdminToken").value;
        localStorage.setItem("werewolf_cf_bbs_admin_token", token);
        status.textContent = "編輯中";
        const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/content", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-bbs-admin-token": token },
          body: JSON.stringify({
            title: document.querySelector("#bbsEditTitle").value,
            message: document.querySelector("#bbsEditMessage").value,
            password: document.querySelector("#bbsEditPassword").value
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "編輯失敗";
          return;
        }
        location.href = "${topicPath}";
      });
      document.querySelector("#bbsDeleteButton").addEventListener("click", async () => {
        const status = document.querySelector("#bbsModerateStatus");
        const token = document.querySelector("#bbsAdminToken").value;
        localStorage.setItem("werewolf_cf_bbs_admin_token", token);
        if (!confirm("刪除此主題與所有回覆？")) return;
        status.textContent = "刪除中";
        const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/moderation", {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-bbs-admin-token": token },
          body: JSON.stringify({ password: document.querySelector("#bbsEditPassword").value })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          status.textContent = data.error || "刪除失敗";
          return;
        }
        location.href = "/bbs.php";
      });
      document.querySelectorAll(".bbsReplyEditButton").forEach((button) => {
        button.addEventListener("click", async () => {
          const status = document.querySelector("#bbsModerateStatus");
          const token = document.querySelector("#bbsAdminToken").value;
          const replyId = button.getAttribute("data-reply-id");
          const messageInput = Array.from(document.querySelectorAll(".bbsReplyEditMessage")).find((input) => input.getAttribute("data-reply-id") === replyId);
          const passwordInput = Array.from(document.querySelectorAll(".bbsReplyEditPassword")).find((input) => input.getAttribute("data-reply-id") === replyId);
          localStorage.setItem("werewolf_cf_bbs_admin_token", token);
          if (!replyId || !messageInput) return;
          status.textContent = "編輯回覆中";
          const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/replies/" + encodeURIComponent(replyId) + "/moderation", {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-bbs-admin-token": token },
            body: JSON.stringify({ message: messageInput.value, password: passwordInput ? passwordInput.value : "" })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            status.textContent = data.error || "編輯回覆失敗";
            return;
          }
          location.href = "${topicPath}";
        });
      });
      document.querySelectorAll(".bbsReplyDeleteButton").forEach((button) => {
        button.addEventListener("click", async () => {
          const status = document.querySelector("#bbsModerateStatus");
          const token = document.querySelector("#bbsAdminToken").value;
          const replyId = button.getAttribute("data-reply-id");
          const passwordInput = Array.from(document.querySelectorAll(".bbsReplyEditPassword")).find((input) => input.getAttribute("data-reply-id") === replyId);
          localStorage.setItem("werewolf_cf_bbs_admin_token", token);
          if (!replyId || !confirm("刪除此回覆？")) return;
          status.textContent = "刪除回覆中";
          const res = await fetch("/api/bbs/topics/${escapeHtml(String(topic.id))}/replies/" + encodeURIComponent(replyId) + "/moderation", {
            method: "DELETE",
            headers: { "content-type": "application/json", "x-bbs-admin-token": token },
            body: JSON.stringify({ password: passwordInput ? passwordInput.value : "" })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            status.textContent = data.error || "刪除回覆失敗";
            return;
          }
          location.href = "${topicPath}";
        });
      });
    </script>`;

  return page("汝等是人是狼？ - Werewolf Cloudflare Port", shell(`
    <p><a href="/bbs.php?go=postre&amp;id=${escapeHtml(String(topic.id))}">回覆主題</a> <a href="/bbs.php">回列表</a></p>
    <fieldset>
      <legend><strong>文章列表</strong></legend>
      <div id="table5">
      ${pagination}
      <table border="1" class="table1" width="100%" align="center">
        <tr><td class="table3">${topicTitle}<br>${bbsAuthorLabel(topic.name, topic.trip)}</td></tr>
        <tr><td class="table4"><div>${formatBbsMessageHtml(topic.message)}</div></td></tr>
        <tr><td class="table2"><a href="/bbs.php?go=edit&amp;id=${escapeHtml(String(topic.id))}">NO.${escapeHtml(String(topic.id))}</a> &lt;..&gt; [${escapeHtml(topic.createdAt)}]</td></tr>
      </table>
      ${replies.length ? `<table class="table1" style="width: 600px" align="right">
        ${replyRows}
      </table>` : `<table class="table1" style="width: 600px" align="right">
        ${replyRows}
      </table>
      `}
      ${pagination}
      </div>
      <table class="form-table" style="clear:both;margin-top:12px;">
        <tr><td><strong>　狀態：</strong></td><td>${bbsStatusMarks(topic)}</td></tr>
        <tr><td><strong>　更新：</strong></td><td>${escapeHtml(topic.updatedAt)}</td></tr>
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
  `, "/bbs.php"));
}

export function renderRules(): string {
  return page("汝等是人是狼？ Werewolf Cloudflare Port 說明", shell(`
    <fieldset style="background-image:url('/assets/reference/img/rule_bg.jpg'); background-repeat:no-repeat; background-position:100% 100%; background-attachment:fixed;">
      <legend><strong>基本流程</strong></legend>
      <p><img class="title-img" src="/assets/reference/img/rule_title.jpg" alt="Rules"></p>
      <table border="0" style="margin-bottom:12px;">
        <tr><td><strong>＜參加遊戲時必須注意的事情＞</strong></td></tr>
        <tr><td><font color="red">關於遊戲中的內容請不要在遊戲以外的場合進行討論。特別是死亡之後公開其他人的角色，請絕對不要有這種行為。</font></td></tr>
        <tr><td bgcolor="#aaeeaa"><strong style="font-size:15pt;">＜「汝等是人是狼？」的基本規則＞</strong></td></tr>
      </table>
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
  `, "/rule.php"));
}

export function renderManual(): string {
  return page("Manual", shell(`
    <fieldset>
      <legend><strong>說明書</strong></legend>
      <table class="form-table">
        <tr><td><strong>　建立村子：</strong></td><td>首頁輸入村名、說明、人數與村子選項後建立。Trip限定、GM制、替身君、限時、公開票與角色追加都在同一表單設定。</td></tr>
        <tr><td><strong>　登錄入村：</strong></td><td>進入房間後填寫玩家ID、暱稱、Trip、希望角色與頭像。Trip限定村必須使用已登記且未排除的 Trip。</td></tr>
        <tr><td><strong>　開始遊戲：</strong></td><td>房主或 GM 可直接開始；居民可投開始票，8人以上達有效票數後自動開始，替身君會折抵一票。</td></tr>
        <tr><td><strong>　白天行動：</strong></td><td>生存玩家公開發言並投票。平手時會重新投票一次；啟用公開票或投票顯示時，畫面會公開對應的投票狀態。</td></tr>
        <tr><td><strong>　夜晚行動：</strong></td><td>人狼、占卜師、獵人、子狐、貓又依角色使用能力；人狼、妖狐、共有者、戀人與靈界頻道會由 Durable Object 依身份過濾。</td></tr>
        <tr><td><strong>　GM操作：</strong></td><td>GM可私語、廣播、換日、裁定勝負、調整生死/角色/旗標、切換共有公開與頻道限制。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>身份與紀錄</strong></legend>
      <table class="form-table">
        <tr><td><strong>　Trip：</strong></td><td><a href="/trip.php">身份登錄</a> 可登記、認領與排除 Trip；<a href="/trips">Trip查詢</a> 顯示公開狀態與彙總戰績，不公開 Trip hash。</td></tr>
        <tr><td><strong>　頭像：</strong></td><td><a href="/icon_view.php">頭像一覽</a> 可選擇參考預設圖；<a href="/icon_upload.php">頭像上傳</a> 可上傳或刪除 R2-backed 個人頭像。</td></tr>
        <tr><td><strong>　過去紀錄：</strong></td><td><a href="/old_log.php">過去紀錄</a> 顯示結束村，支援通常、逆序、靈界、逝者與公開/玩家/靈界/GM視點。</td></tr>
        <tr><td><strong>　戰績：</strong></td><td><a href="/leaderboard">戰績排行榜</a>、<a href="/stats.php">勝率分析</a> 與玩家頁使用 D1 結束紀錄彙總。</td></tr>
        <tr><td><strong>　討論：</strong></td><td><a href="/bbs.php">人狼討論</a> 可發主題、回覆、瀏覽精華，管理者可置頂、鎖定與標記精華。</td></tr>
      </table>
    </fieldset>
    <fieldset>
      <legend><strong>相關文件</strong></legend>
      <table class="form-table">
        <tr><td><strong>　規則：</strong></td><td><a href="/rule.php">/rule.php</a></td></tr>
        <tr><td><strong>　Script Info：</strong></td><td><a href="/script_info.php">/script_info.php</a></td></tr>
        <tr><td><strong>　通訊協定：</strong></td><td><a href="/protocol">/protocol</a></td></tr>
        <tr><td><strong>　版本：</strong></td><td><a href="/version.php">/version.php</a></td></tr>
      </table>
    </fieldset>
  `, "/manual"));
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
        <tr><td><strong>　room_end_vote：</strong></td><td>要求廢村，白天或大廳可用；同一天不同生存玩家超過半數時房間結束且不宣告勝方。</td></tr>
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
  `, "/protocol"));
}

export function renderVersion(): string {
  return page("汝等是人是狼？[版本紀錄]", shell(`
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
  `, "/version.php"));
}

export function renderScriptInfo(): string {
  return page("汝等是人是狼？ Werewolf Cloudflare Port 系統特點", shell(`
    <fieldset style="background-image:url('/assets/reference/img/script_info_bg.jpg'); background-repeat:no-repeat; background-position:100% 100%; background-attachment:fixed;">
      <legend><strong>Script Info</strong></legend>
      <p><img class="title-img" src="/assets/reference/img/script_info_title.jpg" alt="Script Info"></p>
      <table border="0" style="margin-bottom:12px;">
        <tr><td bgcolor="#aaeeaa"><strong style="font-size:15pt;">＜加入遊戲的系統必備條件＞</strong></td></tr>
        <tr><td>為了加入遊戲您必須支援 JavaScript、Cookie，並讓電腦時鐘準時。建議畫面解析度 1024x768 以上。</td></tr>
        <tr><td bgcolor="#aaeeaa"><strong style="font-size:15pt;">＜和其他的script差在哪裡？＞</strong></td></tr>
      </table>
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
        <tr><td><strong>　版本：</strong></td><td><a href="/version.php">/version.php</a></td></tr>
        <tr><td><strong>　狀態：</strong></td><td><a href="/status">/status</a></td></tr>
        <tr><td><strong>　規則：</strong></td><td><a href="/rule.php">/rule.php</a></td></tr>
        <tr><td><strong>　通訊協定：</strong></td><td><a href="/protocol">/protocol</a></td></tr>
      </table>
    </fieldset>
  `, "/script_info.php"));
}

export type RenderRoomOptions = {
  autoReloadSeconds?: number;
  viewMode?: "player" | "spectator" | "heaven";
};

function normalizeAutoReloadSeconds(value: number | undefined): 0 | 15 | 20 | 30 {
  if (value !== undefined && value > 0 && value < 15) {
    return 15;
  }
  if (value === 15 || value === 20 || value === 30) {
    return value;
  }
  return 0;
}

function normalizeRoomViewMode(value: string | undefined | null): "player" | "spectator" | "heaven" {
  return value === "spectator" || value === "heaven" ? value : "player";
}

function roomViewHref(roomPath: string, viewMode: "player" | "spectator" | "heaven", autoReloadSeconds: 0 | 15 | 20 | 30): string {
  const params = [
    viewMode === "player" ? "" : `view=${encodeURIComponent(viewMode)}`,
    autoReloadSeconds > 0 ? `auto_reload=${autoReloadSeconds}` : ""
  ].filter(Boolean).join("&");
  return `${roomPath}${params ? `?${escapeHtml(params)}` : ""}`;
}

function roomReloadHref(roomPath: string, viewMode: "player" | "spectator" | "heaven", autoReloadSeconds: 0 | 15 | 20 | 30): string {
  return roomViewHref(roomPath, viewMode, autoReloadSeconds);
}

export function renderRoom(roomId: string, options: RenderRoomOptions = {}): string {
  const autoReloadSeconds = normalizeAutoReloadSeconds(options.autoReloadSeconds);
  const viewMode = normalizeRoomViewMode(options.viewMode);
  const roomPath = `/room/${escapeHtml(roomId)}`;
  const viewLabel = viewMode === "spectator" ? "旁觀視點" : viewMode === "heaven" ? "靈界視點" : "玩家視點";
  const autoReloadMeta = autoReloadSeconds > 0 ? `<meta http-equiv="refresh" content="${autoReloadSeconds}">` : "";
  return page(`Room ${roomId}`, `
    <script>document.body.classList.add("room-phase-lobby", "room-view-${viewMode}");</script>
    <table class="game-shell" data-room-id="${escapeHtml(roomId)}" data-room-view="${viewMode}">
      <tr>
        <td>
          <table class="game-header">
            <tr><th colspan="2">[${escapeHtml(roomId)}] 汝等是人是狼？</th></tr>
            <tr>
              <td style="width: 180px;">階段：<span id="phase">lobby</span></td>
              <td>
                勝利：<span id="winner" class="muted">未定</span>
                　<a href="/">首頁</a>
                　<a href="${roomPath}/records">對局紀錄</a>
                　<a href="${roomPath}/events">事件履歷</a>
                　<a href="${roomPath}/log">完整紀錄</a>
                　<button id="manualRefresh" type="button">手動更新</button>
                <label><input id="autoRefresh" type="checkbox"> 自動更新</label>
              </td>
            </tr>
            <tr>
              <td>更新</td>
              <td>
                [<a href="${roomReloadHref(roomPath, viewMode, 0)}">手動更新</a>]
                [自動更新:
                <a href="${roomReloadHref(roomPath, viewMode, 15)}">15秒</a>
                <a href="${roomReloadHref(roomPath, viewMode, 20)}">20秒</a>
                <a href="${roomReloadHref(roomPath, viewMode, 30)}">30秒</a>
                <a href="${roomReloadHref(roomPath, viewMode, 0)}">停止</a>]
                <small class="muted">目前：${autoReloadSeconds > 0 ? `${autoReloadSeconds}秒` : "手動"}</small>
              </td>
            </tr>
            <tr>
              <td>視點</td>
              <td>
                <strong>${viewLabel}</strong>
                [<a href="${roomViewHref(roomPath, "player", autoReloadSeconds)}">玩家</a>]
                [<a href="${roomViewHref(roomPath, "spectator", autoReloadSeconds)}">旁觀</a>]
                [<a href="${roomViewHref(roomPath, "heaven", autoReloadSeconds)}">靈界</a>]
                <small class="muted">PHP 版 game_play / game_view / heaven 入口對應</small>
              </td>
            </tr>
            <tr class="view-spectator-only">
              <td>旁觀</td>
              <td>只觀看公開資訊與玩家列表；登入、希望角色、頭像與能力操作列不顯示。</td>
            </tr>
            <tr class="view-heaven-only">
              <td>靈界</td>
              <td>死亡後視點入口；保留靈界發言按鈕，其他生存者登錄與能力操作列不顯示。</td>
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
              <td>登錄</td>
              <td>
                <img class="title-img" src="/assets/reference/img/user_regist_title.gif" alt="住民登錄">
                <a href="#nickname"><strong>[住民登錄]</strong></a>
                　<a href="/trip.php">[身份登錄]</a>
                　<a href="/trips">[Trip查詢]</a>
                　<a href="/">[返回]</a>
              </td>
            </tr>
            <tr class="view-player-only">
              <td><img class="title-img" src="/assets/reference/img/user_regist_handle_name.gif" alt="玩家暱稱">玩家暱稱</td>
              <td><input id="nickname" maxlength="32" size="28"> <button id="connect">進入房間</button> <button id="startVote" disabled>投開始一票</button> <button id="startGame">開始遊戲</button> <button id="leaveRoom" disabled>退出</button></td>
            </tr>
            <tr class="view-player-only">
              <td><img class="title-img" src="/assets/reference/img/user_regist_handle_trip.gif" alt="Trip">Trip</td>
              <td><input id="trip" maxlength="32" size="28"></td>
            </tr>
            <tr class="view-player-only">
              <td><img class="title-img" src="/assets/reference/img/user_regist_role.gif" alt="希望角色">希望角色</td>
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
                <div class="muted" style="margin-top:3px;">
                  <img class="title-img" src="/assets/reference/img/user_regist_role_none.gif" alt="無">無
                  <img class="title-img" src="/assets/reference/img/user_regist_role_human.gif" alt="村民">村民
                  <img class="title-img" src="/assets/reference/img/user_regist_role_wolf.gif" alt="人狼">人狼
                  <img class="title-img" src="/assets/reference/img/user_regist_role_mage.gif" alt="占卜師">占卜師
                  <img class="title-img" src="/assets/reference/img/user_regist_role_necromancer.gif" alt="靈能者">靈能者
                  <img class="title-img" src="/assets/reference/img/user_regist_role_mad.gif" alt="狂人">狂人
                  <img class="title-img" src="/assets/reference/img/user_regist_role_guard.gif" alt="獵人">獵人
                  <img class="title-img" src="/assets/reference/img/user_regist_role_common.gif" alt="共有者">共有者
                  <img class="title-img" src="/assets/reference/img/user_regist_role_fox.gif" alt="妖狐">妖狐
                  <img class="title-img" src="/assets/reference/img/user_regist_role_betr.gif" alt="背德者">背德者
                </div>
              </td>
            </tr>
            <tr class="view-player-only">
              <td><img class="title-img" src="/assets/reference/img/user_regist_icon.gif" alt="頭像">頭像</td>
              <td><input id="avatarFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="28"> <button id="uploadAvatar">頭像</button> <button id="removeAvatar">刪頭像</button> <small class="muted">PNG/JPEG/GIF/WebP 512KiB以下</small></td>
            </tr>
            <tr class="view-player-only">
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
                <small><a href="/icon_view.php">頭像一覽</a></small>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr class="view-player-only">
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
            <tr><th>遺言</th></tr>
            <tr><td><div id="lastWordsLog" class="muted">尚無公開遺言。</div></td></tr>
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
                <button id="sendObjection" class="objection-button" disabled>${referenceAssetImg("img/objection.gif", "提出反對")}(<span id="objectionRemaining">2</span>)</button>
                <button id="sendRoomEndVote" disabled>廢</button>
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
  `, autoReloadMeta);
}
