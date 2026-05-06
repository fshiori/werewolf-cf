import { describe, expect, it } from "vitest";
import { renderAdminRooms, renderAdminRoomsLogin, renderBbs, renderBbsTopic, renderFederatedList, renderHome, renderIconCatalog, renderLeaderboard, renderOldLogs, renderPlayerProfile, renderProtocol, renderRoom, renderRoomEvents, renderRoomRecords, renderRoomTranscript, renderRules, renderScriptInfo, renderStatus, renderTripLookup, renderTripRegistration, renderVersion, renderWinRateAnalysis } from "../src/render";
import { ROOM_CLIENT_SCRIPT } from "../src/room-client";

describe("render", () => {
  it("renders home with room rows and escaped names", () => {
    const html = renderHome([
      {
        id: "room_abc",
        name: "<Test>",
        comment: "<Friendly>",
        maxPlayers: 30,
        status: "lobby",
        createdAt: "2026-05-03 12:00:00",
        options: {
          poison: true,
          bigWolf: true,
          authority: true,
          decider: true,
          lovers: true,
          betrayer: true,
          childFox: true,
          twoFoxes: true,
          cat: true,
          lastWords: true,
          openVote: true,
          commonTalkVisible: true,
          deadRoleVisible: true,
          wishRole: true,
          tripRequired: true,
          gmEnabled: true,
          dummyBoy: true,
          customDummy: true,
          dummyName: "Custom Dummy",
          dummyLastWords: "Remember the dummy",
          realTime: true,
          dayMinutes: 5,
          nightMinutes: 2,
          selfVote: true,
          voteStatus: true
        }
      }
    ]);

    expect(html).toContain("<fieldset>");
    expect(html).toContain("選單");
    expect(html).toContain('background-image: url("/assets/reference/img/top_bg.jpg")');
    expect(html).toContain('/assets/reference/img/top_title.jpg');
    expect(html).toContain('alt="汝等是人是狼？"');
    expect(html).toContain("遊戲列表");
    expect(html).toContain("戰績排行榜");
    expect(html).toContain("Trip登記");
    expect(html).toContain("registerTripButton");
    expect(html).toContain("claimTripButton");
    expect(html).toContain("認領身份");
    expect(html).toContain("excludeTripButton");
    expect(html).toContain("removeTripExclusionButton");
    expect(html).toContain("解除排除");
    expect(html).toContain("/api/trips");
    expect(html).toContain("/api/trips/claim");
    expect(html).toContain("/api/trips/exclusions");
    expect(html).toContain("建立村子");
    expect(html).toContain("村子說明");
    expect(html).toContain("限時 5/2");
    expect(html).toContain('/assets/reference/img/waiting.gif');
    expect(html).toContain('/assets/reference/img/max30.gif');
    expect(html).toContain('/assets/reference/img/room_option_real_time.gif');
    expect(html).toContain('/assets/reference/img/room_option_poison.gif');
    expect(html).toContain('/assets/reference/img/room_option_wfbig.gif');
    expect(html).toContain('/assets/reference/img/room_option_rei.gif');
    expect(html).toContain('/assets/reference/img/room_option_trip.gif');
    expect(html).toContain('class="ref-icon"');
    expect(html).toContain("&lt;Test&gt;");
    expect(html).toContain("&lt;Friendly&gt;");
    expect(html).toContain("最大30");
    expect(html).toContain("/room/room_abc");
    expect(html).toContain("入村");
    expect(html).toContain("/list");
    expect(html).toContain("聯合列表");
    expect(html).toContain("/leaderboard");
    expect(html).toContain("戰績排行榜");
    expect(html).toContain("/stats");
    expect(html).toContain("勝率分析");
    expect(html).toContain("/icons");
    expect(html).toContain("頭像一覽");
    expect(html).toContain("/trip");
    expect(html).toContain("身份登錄");
    expect(html).toContain("/trips");
    expect(html).toContain("Trip查詢");
    expect(html).toContain("/bbs");
    expect(html).toContain("人狼討論");
    expect(html).toContain("/status");
    expect(html).toContain("伺服器狀態");
    expect(html).toContain("/rules");
    expect(html).toContain("/script-info");
    expect(html).toContain("Script Info");
    expect(html).toContain("/protocol");
    expect(html).toContain("通訊協定");
    expect(html).toContain("/version");
    expect(html).toContain("roomComment");
    expect(html).toContain("maxPlayers");
    expect(html).toContain("<option value=\"22\" selected>22</option>");
    expect(html).toContain("optionPoison");
    expect(html).toContain("optionBigWolf");
    expect(html).toContain("optionAuthority");
    expect(html).toContain("optionDecider");
    expect(html).toContain("optionLovers");
    expect(html).toContain("optionBetrayer");
    expect(html).toContain("optionChildFox");
    expect(html).toContain("optionTwoFoxes");
    expect(html).toContain("optionFoxNone");
    expect(html).toContain('name="optionFoxVariant" type="radio"');
    expect(html).toContain("追加なし");
    expect(html).toContain("optionCat");
    expect(html).toContain("optionLastWords");
    expect(html).toContain("optionOpenVote");
    expect(html).toContain("optionCommonTalkVisible");
    expect(html).toContain("optionDeadRoleVisible");
    expect(html).toContain("optionWishRole");
    expect(html).toContain("optionTripRequired");
    expect(html).toContain("optionGmEnabled");
    expect(html).toContain("gmTrip");
    expect(html).toContain("optionDummyBoy");
    expect(html).toContain("optionCustomDummy");
    expect(html).toContain("dummyName");
    expect(html).toContain("dummyLastWords");
    expect(html).toContain("optionRealTime");
    expect(html).toContain("optionDayMinutes");
    expect(html).toContain("optionNightMinutes");
    expect(html).toContain("optionSelfVote");
    expect(html).toContain("optionVoteStatus");
    expect(html).toContain("20人以上埋毒者選項");
    expect(html).toContain("20人以上時大狼出場");
    expect(html).toContain("16人以上權力者出場");
    expect(html).toContain("16人以上決定者出場");
    expect(html).toContain("13人以上戀人出場");
    expect(html).toContain("20人以上妖狐的選項");
    expect(html).toContain("20人以上妖狐的占");
    expect(html).toContain("20人以上兩隻妖狐");
    expect(html).toContain("20人以上貓又登場");
    expect(html).toContain("生存中可留下死亡時公開的遺言");
    expect(html).toContain("白天公開目前投票目標");
    expect(html).toContain("允許晚上顯示共生者悄悄話");
    expect(html).toContain("允許幽靈觀看角色");
    expect(html).toContain("允許加入時選擇希望角色");
    expect(html).toContain("沒有英數 Trip 身分碼將無法登錄成村民");
    expect(html).toContain("指定 Trip 進房後成為 GM，不加入角色分配");
    expect(html).toContain("加入替身君並從第一夜開始");
    expect(html).toContain("自訂替身君名稱及遺言");
    expect(html).toContain("允許玩家白天投票給自己");
    expect(html).toContain("已投票玩家以特殊底色顯示");
    expect(html).toContain("JSON.stringify({ name, comment, maxPlayers, playerId:");
    expect(html).toContain("options: { poison, bigWolf, authority, decider, lovers, betrayer, childFox, twoFoxes, cat, lastWords, openVote, commonTalkVisible, deadRoleVisible, wishRole, tripRequired, gmEnabled, gmTrip, dummyBoy, customDummy, dummyName, dummyLastWords, realTime, dayMinutes, nightMinutes, selfVote, voteStatus }");
    expect(html).toContain("埋毒");
    expect(html).toContain("大狼");
    expect(html).toContain("背德");
    expect(html).toContain("子狐");
    expect(html).toContain("雙狐");
    expect(html).toContain("貓又");
    expect(html).toContain("遺言");
    expect(html).toContain("公開票");
    expect(html).toContain("共有聲");
    expect(html).toContain("靈視");
    expect(html).toContain("希望");
    expect(html).toContain("Trip限定");
    expect(html).toContain("GM制");
    expect(html).toContain("替身");
    expect(html).toContain("自訂替身");
    expect(html).toContain("自投");
    expect(html).toContain("投票済");
    expect(html).toContain("leaderboardRows");
    expect(html).toContain("尚無戰績。");
    expect(html).toContain('link.href = "/player/" + entry.playerId;');
    expect(html).toContain(".room-link > a");
    expect(html).toContain(".room-comment { display: block; text-align: right; margin-left: 100px; color: #333333; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain("建立房間");
  });

  it("renders escaped runtime announcements", () => {
    const html = renderHome([], `<b>Maintenance</b>`);

    expect(html).toContain("&lt;b&gt;Maintenance&lt;/b&gt;");
    expect(html).not.toContain("<b>Maintenance</b>");
  });

  it("renders maintenance mode state on home", () => {
    const html = renderHome([], "Maintenance", true);

    expect(html).toContain("目前維護中，暫停建立新村。");
    expect(html).toContain('<button id="createRoom" disabled>建立房間</button>');
  });

  it("renders room page with external websocket client script", () => {
    const html = renderRoom("room_abc");

    expect(html).toContain("[room_abc]");
    expect(html).toContain('data-room-id="room_abc"');
    expect(html).toContain('<script src="/assets/room-client.js" defer></script>');
    expect(html).not.toContain("new WebSocket");
    expect(html).toContain("room-phase-lobby");
    expect(html).toContain("room-phase-night");
    expect(html).toContain('document.body.classList.add("room-phase-lobby");');
    expect(html).toContain("進入房間");
    expect(html).toContain(".player-card { width: 148px; border: 1px solid #b0b0b0; background: #fafafa; table-layout: fixed; }");
    expect(html).toContain(".player-name { padding-left: 5px; max-width: 96px; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain("#chatLog div, #gameLog div { border-top: 1px dashed silver; padding: 2px 4px; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain("body.room-phase-night .player-card.voted { background: #004000; color: snow; }");
    expect(html).toContain("body.room-phase-night .player-card.voted a { color: #ccffff; }");
    expect(html).toContain("Trip");
    expect(html).toContain("avatarFile");
    expect(html).toContain("defaultIcon");
    expect(html).toContain("user_icon/001.gif");
    expect(html).toContain("頭像一覽");
    expect(html).toContain("image/png,image/jpeg,image/gif,image/webp");
    expect(html).toContain("PNG/JPEG/GIF/WebP 512KiB以下");
    expect(html).toContain("removeAvatar");
    expect(html).toContain("刪頭像");
    expect(html).toContain("送出");
    expect(html).toContain("狼頻");
    expect(html).toContain("狐頻");
    expect(html).toContain("共有頻");
    expect(html).toContain("戀頻");
    expect(html).toContain("靈界");
    expect(html).toContain("GM私語");
    expect(html).toContain("gmWhisperTarget");
    expect(html).toContain("GM換日");
    expect(html).toContain("GM裁定");
    expect(html).toContain("GM復活");
    expect(html).toContain("GM改職");
    expect(html).toContain("GM解除");
    expect(html).toContain("開始遊戲");
    expect(html).toContain("房主");
    expect(html).toContain("戰績");
    expect(html).toContain("/room/room_abc/records");
    expect(html).toContain("對局紀錄");
    expect(html).toContain("最近對局");
    expect(html).toContain("個人紀錄");
    expect(html).toContain("對局紀錄");
    expect(html).toContain("playerRecords");
    expect(html).toContain("事件");
    expect(html).toContain("manualRefresh");
    expect(html).toContain("autoRefresh");
    expect(html).toContain("自動更新");
    expect(html).toContain("/events");
    expect(html).toContain("事件履歷");
    expect(html).toContain("/room/room_abc/log");
    expect(html).toContain("完整紀錄");
    expect(html).toContain(".player-card.voted");
    expect(html).toContain(".revealed-role");
    expect(html).toContain(".role-werewolf");
    expect(html).toContain("權力者");
    expect(html).toContain("玩家列表");
    expect(html).toContain("能力發動 / 投票");
    expect(html).toContain("wishRole");
    expect(html).toContain("<option value=\"seer\">占卜師</option>");
    expect(html).toContain("startVote");
    expect(html).toContain("leaveRoom");
    expect(html).toContain("sendDeadChat");
    expect(html).toContain("sendSelfTalk");
    expect(html).toContain("sendObjection");
    expect(html).toContain("soundNotify");
    expect(html).toContain("lastWordsText");
    expect(html).toContain("setLastWords");
  });

  it("serves room client behavior from a separate script artifact", () => {
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector("[data-room-id]")');
    expect(ROOM_CLIENT_SCRIPT).toContain("new WebSocket");
    expect(ROOM_CLIENT_SCRIPT).toContain("werewolf_cf_trip");
    expect(ROOM_CLIENT_SCRIPT).toContain("werewolf_cf_default_icon");
    expect(ROOM_CLIENT_SCRIPT).toContain("512 * 1024");
    expect(ROOM_CLIENT_SCRIPT).toContain("頭像需小於 512KiB");
    expect(ROOM_CLIENT_SCRIPT).toContain("/api/assets/avatar");
    expect(ROOM_CLIENT_SCRIPT).toContain('method: "DELETE"');
    expect(ROOM_CLIENT_SCRIPT).toContain("/assets/avatar/");
    expect(ROOM_CLIENT_SCRIPT).toContain("iconPath");
    expect(ROOM_CLIENT_SCRIPT).toContain("player.iconPath");
    expect(ROOM_CLIENT_SCRIPT).toContain("referenceImage(player.iconPath, player.nickname)");
    expect(ROOM_CLIENT_SCRIPT).toContain('referenceImage("img/grave.gif", "死亡")');
    expect(ROOM_CLIENT_SCRIPT).toContain('grave.addEventListener("mouseover"');
    expect(ROOM_CLIENT_SCRIPT).toContain('grave.addEventListener("mouseout"');
    expect(ROOM_CLIENT_SCRIPT).toContain("appendPlayerIcon(iconCell, player, initial)");
    expect(ROOM_CLIENT_SCRIPT).toContain('profileLink.href = "/player/" + player.playerId;');
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_whisper");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_advance_phase");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_end_game");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_alive");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_role");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_flag");
    expect(ROOM_CLIENT_SCRIPT).toContain("start_vote");
    expect(ROOM_CLIENT_SCRIPT).toContain("kick_player");
    expect(ROOM_CLIENT_SCRIPT).toContain("kick_vote");
    expect(ROOM_CLIENT_SCRIPT).toContain("leave_room");
    expect(ROOM_CLIENT_SCRIPT).toContain("function refreshAuxiliaryPanels()");
    expect(ROOM_CLIENT_SCRIPT).toContain("function configureAutoRefresh()");
    expect(ROOM_CLIENT_SCRIPT).toContain("werewolf_cf_auto_refresh");
    expect(ROOM_CLIENT_SCRIPT).toContain("setInterval(refreshAuxiliaryPanels, 15000)");
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector("#manualRefresh").addEventListener("click", refreshAuxiliaryPanels);');
    expect(ROOM_CLIENT_SCRIPT).toContain("/api/players/");
    expect(ROOM_CLIENT_SCRIPT).toContain("/stats");
    expect(ROOM_CLIENT_SCRIPT).toContain("/api/rooms/");
    expect(ROOM_CLIENT_SCRIPT).toContain("/records");
    expect(ROOM_CLIENT_SCRIPT).toContain("/api/players/\" + playerId + \"/records");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.hostId !== currentPlayerId");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.revoteCount");
    expect(ROOM_CLIENT_SCRIPT).toContain("function setRoomPhaseClass(phase)");
    expect(ROOM_CLIENT_SCRIPT).toContain('document.body.classList.add("room-phase-" + phase);');
    expect(ROOM_CLIENT_SCRIPT).toContain("currentPlayerAlive");
    expect(ROOM_CLIENT_SCRIPT).toContain("currentPlayerDead");
    expect(ROOM_CLIENT_SCRIPT).toContain("voteSummary");
    expect(ROOM_CLIENT_SCRIPT).toContain("votedPlayerIds");
    expect(ROOM_CLIENT_SCRIPT).toContain("\" voted\"");
    expect(ROOM_CLIENT_SCRIPT).toContain("投票：");
    expect(ROOM_CLIENT_SCRIPT).toContain("actorCanAct");
    expect(ROOM_CLIENT_SCRIPT).toContain("function roleLabel(value)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function roleIconPath(value)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function referenceImage(path, alt)");
    expect(ROOM_CLIENT_SCRIPT).toContain('werewolf: "人狼"');
    expect(ROOM_CLIENT_SCRIPT).toContain('big_wolf: "大狼"');
    expect(ROOM_CLIENT_SCRIPT).toContain('fox: "妖狐"');
    expect(ROOM_CLIENT_SCRIPT).toContain('poison: "埋毒者"');
    expect(ROOM_CLIENT_SCRIPT).toContain('betrayer: "背德者"');
    expect(ROOM_CLIENT_SCRIPT).toContain('child_fox: "子狐"');
    expect(ROOM_CLIENT_SCRIPT).toContain('cat: "貓又"');
    expect(ROOM_CLIENT_SCRIPT).toContain('werewolf: "img/role_wolf.gif"');
    expect(ROOM_CLIENT_SCRIPT).toContain('big_wolf: "img/role_heavywolf.gif"');
    expect(ROOM_CLIENT_SCRIPT).toContain('cat: "img/role_cat.gif"');
    expect(ROOM_CLIENT_SCRIPT).toContain('referenceImage("img/grave.gif", "死亡")');
    expect(ROOM_CLIENT_SCRIPT).toContain('image.src = "/assets/reference/" + path;');
    expect(ROOM_CLIENT_SCRIPT).toContain("roleLabel(msg.role)");
    expect(ROOM_CLIENT_SCRIPT).toContain('roleText.className = "revealed-role role-" + revealedRole;');
    expect(ROOM_CLIENT_SCRIPT).toContain("winnerLabel(game.winner)");
    expect(ROOM_CLIENT_SCRIPT).toContain("isWolfRole(role)");
    expect(ROOM_CLIENT_SCRIPT).toContain("msg.authority");
    expect(ROOM_CLIENT_SCRIPT).toContain("msg.lovers");
    expect(ROOM_CLIENT_SCRIPT).toContain("戀人：");
    expect(ROOM_CLIENT_SCRIPT).toContain("msg.foxes");
    expect(ROOM_CLIENT_SCRIPT).toContain("妖狐：");
    expect(ROOM_CLIENT_SCRIPT).toContain("msg.commons");
    expect(ROOM_CLIENT_SCRIPT).toContain("共有：");
    expect(ROOM_CLIENT_SCRIPT).toContain("wolf_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("objection");
    expect(ROOM_CLIENT_SCRIPT).toContain("playNotifySound");
    expect(ROOM_CLIENT_SCRIPT).toContain("function notifyStateSound(nextGame, previousGame)");
    expect(ROOM_CLIENT_SCRIPT).toContain("nextGame.revoteCount > previousGame.revoteCount");
    expect(ROOM_CLIENT_SCRIPT).toContain("nextGame.suddenDeathWarningAt !== previousGame.suddenDeathWarningAt");
    expect(ROOM_CLIENT_SCRIPT).toContain("notifyStateSound(msg, previousGame)");
    expect(ROOM_CLIENT_SCRIPT).toContain("werewolf_cf_sound");
    expect(ROOM_CLIENT_SCRIPT).toContain("#leaveRoom");
    expect(ROOM_CLIENT_SCRIPT).toContain("#startVote");
    expect(ROOM_CLIENT_SCRIPT).toContain("fox_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("common_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("lovers_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("dead_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("self_talk");
    expect(ROOM_CLIENT_SCRIPT).toContain("#sendSelfTalk");
    expect(ROOM_CLIENT_SCRIPT).toContain("[自言自語]");
    expect(ROOM_CLIENT_SCRIPT).toContain("revealed_roles");
    expect(ROOM_CLIENT_SCRIPT).toContain("set_last_words");
    expect(ROOM_CLIENT_SCRIPT).toContain("last_words_ack");
    expect(ROOM_CLIENT_SCRIPT).toContain("isLover");
    expect(ROOM_CLIENT_SCRIPT).toContain("action_ack");
    expect(ROOM_CLIENT_SCRIPT).toContain("divination_result");
    expect(ROOM_CLIENT_SCRIPT).toContain("child_fox_result");
    expect(ROOM_CLIENT_SCRIPT).toContain("child_fox_divine");
    expect(ROOM_CLIENT_SCRIPT).toContain("cat_revive");
    expect(ROOM_CLIENT_SCRIPT).toContain('game.phase === "night" && game.day > 1 && role === "cat" && !player.alive');
    expect(ROOM_CLIENT_SCRIPT).toContain("medium_result");
    expect(ROOM_CLIENT_SCRIPT).toContain("type: \"divine\"");
    expect(ROOM_CLIENT_SCRIPT).toContain("type: \"guard\"");
  });

  it("renders player profile page with stats and records fetches", () => {
    const html = renderPlayerProfile("player_abc");

    expect(html).toContain("個人戰績");
    expect(html).toContain("player_abc");
    expect(html).toContain("/assets/avatar/player_abc");
    expect(html).toContain("/api/players/\" + playerId + \"/stats");
    expect(html).toContain("/api/players/\" + playerId + \"/records");
    expect(html).toContain("最近參戰紀錄");
    expect(html).toContain("function roleLabel(value)");
  });

  it("renders Trip lookup page", () => {
    const html = renderTripLookup();

    expect(html).toContain("Trip查詢");
    expect(html).toContain("Trip公開資料");
    expect(html).toContain("tripLookupButton");
    expect(html).toContain("/api/trips/lookup?trip=");
    expect(html).toContain("werewolf_cf_trip");
    expect(html).toContain("escapeClientHtml");
    expect(html).toContain("encodeURIComponent(playerId)");
  });

  it("renders dedicated Trip registration page", () => {
    const html = renderTripRegistration();

    expect(html).toContain("身份登錄");
    expect(html).toContain("Trip公開資料");
    expect(html).toContain("registerTripButton");
    expect(html).toContain("claimTripButton");
    expect(html).toContain("excludeTripButton");
    expect(html).toContain("removeTripExclusionButton");
    expect(html).toContain("tripLookupButton");
    expect(html).toContain("/api/trips");
    expect(html).toContain("/api/trips/claim");
    expect(html).toContain("/api/trips/exclusions");
    expect(html).toContain("/api/trips/lookup?trip=");
    expect(html).toContain("werewolf_cf_trip");
    expect(html).toContain("werewolf_cf_nickname");
  });

  it("renders leaderboard as a normal HTML page", () => {
    const html = renderLeaderboard([
      { rank: 1, playerId: "player_top", gamesPlayed: 8, wins: 5, losses: 3 }
    ]);

    expect(html).toContain("戰績排行榜");
    expect(html).toContain("/player/player_top");
    expect(html).toContain("player_top");
    expect(html).toContain("<td>5</td>");
    expect(html).not.toContain("排行榜 JSON");
  });

  it("renders win-rate analysis as a normal HTML page", () => {
    const html = renderWinRateAnalysis([
      { winner: "villagers", label: "人勝", wins: 2, total: 4, rate: 50 },
      { winner: "werewolves", label: "狼勝", wins: 1, total: 4, rate: 25 },
      { winner: "foxes", label: "狐勝", wins: 1, total: 4, rate: 25 },
      { winner: "lovers", label: "戀勝", wins: 0, total: 4, rate: 0 }
    ]);

    expect(html).toContain("勝率分析");
    expect(html).toContain("－人勝－");
    expect(html).toContain("2 / 4");
    expect(html).toContain("勝率 50.00 %");
    expect(html).toContain("/api/stats/win-rate");
  });

  it("renders default icon catalog as a normal HTML page", () => {
    const html = renderIconCatalog();

    expect(html).toContain("頭像一覽");
    expect(html).toContain("/assets/reference/user_icon/001.gif");
    expect(html).toContain("/assets/reference/user_icon/010.gif");
    expect(html).toContain("#DDDDDD");
    expect(html).toContain("#FF9999");
    expect(html).toContain("32 x 32");
    expect(html).toContain("上傳頭像");
    expect(html).toContain("iconUploadFile");
    expect(html).toContain("iconUploadButton");
    expect(html).toContain("iconRemoveButton");
    expect(html).toContain("/api/assets/avatar");
    expect(html).toContain("頭像需小於 512KiB");
  });

  it("renders federated list as a normal HTML page", () => {
    const html = renderFederatedList([
      {
        id: "room_abc",
        name: "Test",
        comment: "Friendly",
        maxPlayers: 22,
        status: "lobby",
        createdAt: "2026-05-06 12:00:00",
        options: {
          poison: false,
          bigWolf: false,
          authority: false,
          decider: false,
          lovers: false,
          betrayer: false,
          childFox: false,
          twoFoxes: false,
          cat: false,
          lastWords: false,
          openVote: false,
          commonTalkVisible: false,
          deadRoleVisible: false,
          wishRole: false,
          dummyBoy: false,
          customDummy: false,
          dummyName: "替身君",
          dummyLastWords: "",
          realTime: false,
          dayMinutes: 3,
          nightMinutes: 1.5,
          selfVote: false,
          voteStatus: false
        }
      }
    ]);

    expect(html).toContain("聯合遊戲列表");
    expect(html).toContain("服務中");
    expect(html).toContain("本伺服器");
    expect(html).toContain("募集中");
    expect(html).toContain("[room_abc]");
    expect(html).toContain("Test村");
    expect(html).toContain("人數22");
  });

  it("renders remote federated room links", () => {
    const html = renderFederatedList([
      {
        id: "remote_room",
        name: "Remote",
        comment: "Away",
        maxPlayers: 16,
        status: "playing",
        createdAt: "2026-05-06 12:00:00",
        options: {
          poison: false,
          bigWolf: false,
          authority: false,
          decider: false,
          lovers: false,
          betrayer: false,
          childFox: false,
          twoFoxes: false,
          cat: false,
          lastWords: false,
          openVote: false,
          commonTalkVisible: false,
          deadRoleVisible: false,
          wishRole: false,
          dummyBoy: false,
          customDummy: false,
          dummyName: "替身君",
          dummyLastWords: "",
          realTime: false,
          dayMinutes: 3,
          nightMinutes: 1.5,
          selfVote: false,
          voteStatus: false
        },
        serverName: "遠端伺服器",
        serverUrl: "https://remote.example",
        roomUrl: "https://remote.example/room/remote_room",
        local: false
      }
    ]);

    expect(html).toContain("遠端伺服器");
    expect(html).toContain("https://remote.example/room/remote_room");
    expect(html).toContain("Remote村");
  });

  it("renders old log index with reference log links", () => {
    const html = renderOldLogs([
      {
        id: "room_finished",
        name: "Finished",
        comment: "",
        maxPlayers: 16,
        status: "ended",
        createdAt: "2026-05-06 12:00:00",
        options: {
          poison: true,
          bigWolf: false,
          authority: false,
          decider: false,
          lovers: false,
          betrayer: false,
          childFox: false,
          twoFoxes: false,
          cat: false,
          lastWords: false,
          openVote: true,
          commonTalkVisible: false,
          deadRoleVisible: false,
          wishRole: false,
          dummyBoy: false,
          customDummy: false,
          dummyName: "替身君",
          dummyLastWords: "",
          realTime: true,
          dayMinutes: 5,
          nightMinutes: 3,
          selfVote: false,
          voteStatus: false
        }
      }
    ]);

    expect(html).toContain("過去紀錄");
    expect(html).toContain("村No");
    expect(html).toContain("Finished 村");
    expect(html).toContain("/room/room_finished/log");
    expect(html).toContain("reverse_log=on");
    expect(html).toContain("heaven_talk=on");
    expect(html).toContain("heaven_only=on");
    expect(html).toContain("埋毒");
    expect(html).toContain("公開票");
    expect(html).toContain('<a href="/logs">過去紀錄</a>');
  });

  it("renders BBS as a normal HTML page", () => {
    const html = renderBbs([
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Hello",
        trip: true,
        replyCount: 2,
        pinned: true,
        locked: false,
        digest: true,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:30:00"
      }
    ]);

    expect(html).toContain("主題列表");
    expect(html).toContain("發表主題");
    expect(html).toContain("/bbs?digest=1");
    expect(html).toContain("[置頂] Welcome (精華)");
    expect(html).toContain("Alice◆Trip");
    expect(html).toContain("/api/bbs/topics");
    expect(html).toContain("bbsPostButton");
  });

  it("renders BBS digest list as a normal HTML page", () => {
    const html = renderBbs([], { digestOnly: true });

    expect(html).toContain("精華主題列表");
    expect(html).toContain("尚無精華主題。");
    expect(html).toContain("/bbs?digest=1");
  });

  it("renders BBS topic detail with replies", () => {
    const html = renderBbsTopic(
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip: true,
        replyCount: 1,
        pinned: false,
        locked: false,
        digest: false,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:10:00"
      },
      [
        {
          id: 1,
          topicId: 1,
          name: "Bob",
          message: "Reply body",
          trip: false,
          createdAt: "2026-05-06 12:10:00"
        }
      ]
    );

    expect(html).toContain("Topic body");
    expect(html).toContain("回覆列表");
    expect(html).toContain("Bob");
    expect(html).toContain("Reply body");
    expect(html).toContain("/api/bbs/topics/1/replies");
    expect(html).toContain("狀態");
    expect(html).toContain("主題管理");
    expect(html).toContain("bbsAdminToken");
    expect(html).toContain("werewolf_cf_bbs_admin_token");
    expect(html).toContain("/api/bbs/topics/1/moderation");
    expect(html).toContain('"x-bbs-admin-token": token');
    expect(html).toContain("bbsModeratePinned");
    expect(html).toContain("bbsModerateLocked");
    expect(html).toContain("bbsModerateDigest");
  });

  it("renders room records as a normal HTML page", () => {
    const html = renderRoomRecords("room_abc", [
      {
        id: 1,
        roomId: "room_abc",
        result: { winner: "werewolves", day: 2, players: [{ playerId: "player_a" }, { playerId: "player_b" }] },
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("村子對局紀錄");
    expect(html).toContain("/room/room_abc");
    expect(html).toContain("人狼勝利");
    expect(html).toContain("/assets/reference/img/victory_role_wolf.gif");
    expect(html).toContain("第 2 日");
    expect(html).toContain("2 人");
  });

  it("renders room events as a normal HTML page", () => {
    const html = renderRoomEvents("room_abc", [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "game_started",
        payload: { day: 1, players: 4, nickname: "Alice", text: "hello" },
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("村子事件履歷");
    expect(html).toContain("game_started");
    expect(html).toContain("player_a");
    expect(html).toContain("第1日");
    expect(html).toContain("4人");
    expect(html).toContain("發言:Alice");
    expect(html).toContain("內容:hello");
  });

  it("renders room transcript as a normal HTML page", () => {
    const html = renderRoomTranscript(
      "room_abc",
      [
        {
          id: 1,
          roomId: "room_abc",
          result: {
            winner: "villagers",
            day: 4,
            players: [
              { playerId: "player_a", nickname: "Alice", role: "seer", alive: true },
              { playerId: "player_b", nickname: "Bob", role: "werewolf", alive: false }
            ]
          },
          createdAt: "2026-05-06 12:00:00"
        }
      ],
      [
        {
          id: 1,
          roomId: "room_abc",
          playerId: "player_a",
          eventType: "game_started",
          payload: { day: 1, players: 4 },
          createdAt: "2026-05-06 12:01:00"
        },
        {
          id: 2,
          roomId: "room_abc",
          playerId: "player_a",
          eventType: "day_vote",
          payload: { visibility: "private", nickname: "Alice", targetPlayerId: "player_b", targetNickname: "Bob", phase: "day", day: 2, revoteCount: 1 },
          createdAt: "2026-05-06 12:02:00"
        },
        {
          id: 3,
          roomId: "room_abc",
          playerId: "player_b",
          eventType: "night_kill",
          payload: { visibility: "private", nickname: "Bob", targetPlayerId: "player_a", targetNickname: "Alice", phase: "night", day: 2 },
          createdAt: "2026-05-06 12:03:00"
        },
        {
          id: 4,
          roomId: "room_abc",
          playerId: "player_b",
          eventType: "wolf_chat",
          payload: { visibility: "private", nickname: "Bob", text: "howl", phase: "night", day: 2 },
          createdAt: "2026-05-06 12:04:00"
        },
        {
          id: 5,
          roomId: "room_abc",
          playerId: "player_gm",
          eventType: "gm_whisper",
          payload: { visibility: "private", nickname: "GM", text: "secret", phase: "night", day: 2 },
          createdAt: "2026-05-06 12:05:00"
        },
        {
          id: 6,
          roomId: "room_abc",
          playerId: "player_a",
          eventType: "self_talk",
          payload: { visibility: "private", nickname: "Alice", text: "mutter", phase: "night", day: 2 },
          createdAt: "2026-05-06 12:06:00"
        }
      ]
    );

    expect(html).toContain("村子完整紀錄");
    expect(html).toContain("村民勝利");
    expect(html).toContain("/assets/reference/img/victory_role_human.gif");
    expect(html).toContain("Alice (player_a)");
    expect(html).toContain("占卜師");
    expect(html).toContain("Bob (player_b)");
    expect(html).toContain("死亡");
    expect(html).toContain("遊戲開始");
    expect(html).toContain("第1日");
    expect(html).toContain("第 2 日 白天");
    expect(html).toContain("白天投票");
    expect(html).toContain("投票紀錄");
    expect(html).toContain("第 2 日 再投票 1");
    expect(html).toContain("投票者");
    expect(html).toContain("投票先");
    expect(html).toContain("第 2 日 夜晚");
    expect(html).toContain("襲擊");
    expect(html).toContain("位置");
    expect(html).toContain("襲擊行動");
    expect(html).toContain("人狼密談");
    expect(html).toContain("GM密語");
    expect(html).toContain("自言自語");
    expect(html).toContain('class="transcript-row transcript-location-kill"');
    expect(html).toContain('class="transcript-row transcript-location-wolf"');
    expect(html).toContain('class="transcript-row transcript-location-gm-whisper"');
    expect(html).toContain('class="transcript-row transcript-location-self"');
    expect(html).toContain(".transcript-location-wolf td { background: #000030; color: #ffccff; }");
    expect(html).toContain(".transcript-location-self td { background: #000030; color: snow; }");
    expect(html).toContain(".transcript-location-kill td { background: #cc3300; color: snow; font-weight: bold; }");
    expect(html).toContain("對象名:Bob");
  });

  it("filters room transcript heaven talk like old logs", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_system",
        eventType: "game_started",
        payload: { day: 1, players: 4 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_dead",
        eventType: "dead_chat",
        payload: { visibility: "private", nickname: "Dead", text: "heaven", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "howl", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ];

    const normal = renderRoomTranscript("room_abc", [], events);
    expect(normal).toContain("通常");
    expect(normal).toContain("howl");
    expect(normal).not.toContain("內容:heaven");

    const withHeaven = renderRoomTranscript("room_abc", [], events, { heavenTalk: true });
    expect(withHeaven).toContain("含靈界");
    expect(withHeaven).toContain("heaven");
    expect(withHeaven).toContain("howl");

    const heavenOnly = renderRoomTranscript("room_abc", [], events, { heavenOnly: true });
    expect(heavenOnly).toContain("逝者靈界");
    expect(heavenOnly).toContain("遊戲開始");
    expect(heavenOnly).toContain("heaven");
    expect(heavenOnly).not.toContain("內容:howl");
  });

  it("filters room transcript rows for explicit viewer modes", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_system",
        eventType: "game_started",
        payload: { day: 1, players: 4 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "howl", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_dead",
        eventType: "dead_chat",
        payload: { visibility: "private", nickname: "Dead", text: "heaven", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_seer",
        eventType: "self_talk",
        payload: { visibility: "private", nickname: "Seer", text: "mutter", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenTalk: true });
    expect(publicView).toContain("旁觀");
    expect(publicView).toContain("遊戲開始");
    expect(publicView).not.toContain("內容:howl");
    expect(publicView).not.toContain("內容:heaven");
    expect(publicView).not.toContain("內容:mutter");

    const playerView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "player_wolf", heavenTalk: true });
    expect(playerView).toContain("玩家 player_wolf");
    expect(playerView).toContain("howl");
    expect(playerView).not.toContain("內容:heaven");
    expect(playerView).not.toContain("內容:mutter");

    const deadView = renderRoomTranscript("room_abc", [], events, { viewerMode: "dead", heavenTalk: true });
    expect(deadView).toContain("靈界");
    expect(deadView).toContain("heaven");
    expect(deadView).not.toContain("內容:howl");
    expect(deadView).not.toContain("內容:mutter");

    const gmView = renderRoomTranscript("room_abc", [], events, { viewerMode: "gm", heavenTalk: true });
    expect(gmView).toContain("GM");
    expect(gmView).toContain("howl");
    expect(gmView).toContain("heaven");
    expect(gmView).toContain("mutter");
  });

  it("renders room transcript reverse log controls", () => {
    const html = renderRoomTranscript(
      "room_abc",
      [],
      [
        {
          id: 1,
          roomId: "room_abc",
          playerId: "player_first",
          eventType: "public_chat",
          payload: { nickname: "First", text: "first", phase: "day", day: 1 },
          createdAt: "2026-05-06 12:01:00"
        },
        {
          id: 2,
          roomId: "room_abc",
          playerId: "player_second",
          eventType: "public_chat",
          payload: { nickname: "Second", text: "second", phase: "day", day: 1 },
          createdAt: "2026-05-06 12:02:00"
        }
      ],
      { reverseLog: true }
    );

    expect(html).toContain("reverse_log=on");
    expect(html.indexOf("second")).toBeLessThan(html.indexOf("first"));
  });

  it("renders implemented rules page", () => {
    const html = renderRules();

    expect(html).toContain("基本流程");
    expect(html).toContain("白天");
    expect(html).toContain("夜晚");
    expect(html).toContain("角色");
    expect(html).toContain("/assets/reference/img/role_human.gif");
    expect(html).toContain("/assets/reference/img/role_wolf.gif");
    expect(html).toContain("/assets/reference/img/role_heavywolf.gif");
    expect(html).toContain("/assets/reference/img/role_mage.gif");
    expect(html).toContain("/assets/reference/img/role_fox.gif");
    expect(html).toContain("/assets/reference/img/role_cat.gif");
    expect(html).toContain("人狼 / 大狼");
    expect(html).toContain("Trip限定");
    expect(html).toContain("Durable Object alarm");
    expect(html).toContain("沉默時間推進");
    expect(html).toContain("最後2分警告");
  });

  it("renders version page with current implementation status", () => {
    const html = renderVersion();

    expect(html).toContain("版本資訊");
    expect(html).toContain("0.1.0");
    expect(html).toContain("Cloudflare Workers / TypeScript");
    expect(html).toContain("Durable Objects + WebSockets + alarms");
    expect(html).toContain("R2 avatar assets");
    expect(html).toContain("/api/health");
    expect(html).toContain("/api/version");
    expect(html).toContain("目前功能");
    expect(html).toContain("docs/test-results/2026-05-03-core-game-loop.md");
  });

  it("renders script info page", () => {
    const html = renderScriptInfo();

    expect(html).toContain("Script Info");
    expect(html).toContain("ref/diam1.3.61.kz_Build0912/script_info.php");
    expect(html).toContain("時間設定");
    expect(html).toContain("60秒沉默後推進1時間");
    expect(html).toContain("BBS 標題");
    expect(html).toContain("/protocol");
  });

  it("renders status page with health checks and runtime config", () => {
    const html = renderStatus({
      ok: true,
      checks: { worker: true, db: true, kv: true, durableObjects: true, r2: true },
      homeAnnouncement: "<Runtime>",
      maintenanceMode: false
    });

    expect(html).toContain("伺服器狀態");
    expect(html).toContain("正常運作");
    expect(html).toContain("Binding 檢查");
    expect(html).toContain("durableObjects");
    expect(html).toContain("&lt;Runtime&gt;");
  });

  it("renders room admin pages", () => {
    const login = renderAdminRoomsLogin();
    expect(login).toContain("廢村管理");
    expect(login).toContain("roomAdminToken");
    expect(login).toContain("werewolf_cf_room_admin_token");

    const html = renderAdminRooms([
      {
        id: "room_abc",
        name: "Test",
        comment: "",
        maxPlayers: 22,
        status: "playing",
        createdAt: "2026-05-06 12:00:00",
        options: {
          poison: false,
          bigWolf: false,
          authority: false,
          decider: false,
          lovers: false,
          betrayer: false,
          childFox: false,
          twoFoxes: false,
          cat: false,
          lastWords: false,
          openVote: false,
          commonTalkVisible: false,
          deadRoleVisible: false,
          wishRole: false,
          dummyBoy: false,
          customDummy: false,
          dummyName: "替身君",
          dummyLastWords: "",
          realTime: false,
          dayMinutes: 3,
          nightMinutes: 1.5,
          selfVote: false,
          voteStatus: false
        }
      }
    ]);

    expect(html).toContain("請選擇要廢除的村");
    expect(html).toContain("room_abc");
    expect(html).toContain("adminEndRoom");
    expect(html).toContain("/api/admin/rooms/");
    expect(html).toContain('"x-room-admin-token": roomAdminToken');
  });

  it("renders websocket protocol page", () => {
    const html = renderProtocol();

    expect(html).toContain("WebSocket 入口");
    expect(html).toContain("GET /ws/room/:roomId");
    expect(html).toContain("iconPath");
    expect(html).toContain("Client Messages");
    expect(html).toContain("wolf_chat / fox_chat / common_chat / lovers_chat");
    expect(html).toContain("self_talk");
    expect(html).toContain("gm_*");
    expect(html).toContain("start_vote");
    expect(html).toContain("kick_vote");
    expect(html).toContain("leave_room");
    expect(html).toContain("Server Messages");
    expect(html).toContain("game_state");
    expect(html).toContain("revealed_roles");
    expect(html).toContain("common_voice");
    expect(html).toContain("/api/protocol");
    expect(html).toContain("README.md#websocket-protocol");
  });
});
