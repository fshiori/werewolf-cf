import { describe, expect, it } from "vitest";
import { renderAdminConfig, renderAdminConfigLogin, renderAdminIndex, renderAdminRooms, renderAdminRoomsLogin, renderBbs, renderBbsAdmin, renderBbsTopic, renderFederatedList, renderHome, renderIconCatalog, renderLeaderboard, renderLegacyGameFrame, renderManual, renderOldLogs, renderPlayerProfile, renderProtocol, renderRoom, renderRoomEvents, renderRoomRecords, renderRoomTranscript, renderRules, renderScriptInfo, renderStatus, renderTripComments, renderTripLookup, renderTripRating, renderTripRegistration, renderTripRoomRecords, renderVersion, renderWinRateAnalysis } from "../src/render";
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
          authority: false,
          decider: false,
          lovers: true,
          betrayer: true,
          childFox: true,
          twoFoxes: true,
          cat: true,
          lastWords: true,
          openVote: true,
          commonTalkVisible: true,
          channelRestrictions: {
            wolf: true,
            common: false,
            lovers: true,
            fox: false
          },
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

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("<fieldset>");
    expect(html).toContain('<body bgcolor="white">');
    expect(html).toContain("選單");
    expect(html).toContain('background-image: url("/assets/reference/img/top_bg.jpg")');
    expect(html).toContain('/assets/reference/img/top_title.jpg');
    expect(html).toContain('alt="汝等是人是狼？"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("＜＜ 請啟用JavaScript ＞＞");
    expect(html).toContain("PHP4 + MYSQLスクリプト");
    expect(html).toContain("配布ホームページ");
    expect(html).toContain("天の欠片");
    expect(html).toContain("網站管理者");
    expect(html).toContain('<a href="/admin.php" style="color:blue;" target="_blank">Werewolf CF</a>');
    expect(html).toContain("遊戲列表");
    expect(html).toContain("戰績排行榜");
    expect(html).toContain("管理選單");
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
    expect(html).toContain("/login.php?room_no=room_abc");
    expect(html).toContain("入村");
    expect(html).toContain("/list.php");
    expect(html).toContain("聯合列表");
    expect(html).toContain("/leaderboard");
    expect(html).toContain("戰績排行榜");
    expect(html).toContain("/stats.php");
    expect(html).toContain("勝率分析");
    expect(html).toContain("/icon_view.php");
    expect(html).toContain("頭像一覽");
    expect(html).toContain("/trip.php");
    expect(html).toContain("身份登錄");
    expect(html).toContain("/trips");
    expect(html).toContain("Trip查詢");
    expect(html).toContain("/icon_upload.php");
    expect(html).toContain("頭像上傳");
    expect(html).toContain("/bbs.php");
    expect(html).toContain("人狼討論");
    expect(html).toContain("/bbs.php?go=dige");
    expect(html).toContain("精華文章");
    expect(html).toContain("/status");
    expect(html).toContain("伺服器狀態");
    expect(html).toContain("/admin.php");
    expect(html).toContain("/rule.php");
    expect(html).toContain("/manual");
    expect(html).toContain("說明書");
    expect(html).toContain("/script_info.php");
    expect(html).toContain("Script Info");
    expect(html).toContain("/protocol");
    expect(html).toContain("通訊協定");
    expect(html).toContain("/version.php");
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
    expect(html).toContain('name="option_role_foxs" value="betr" type="radio"');
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
    expect(html).toContain("/assets/reference/img/room_option_poison.gif");
    expect(html).toContain("/assets/reference/img/room_option_authority.gif");
    expect(html).toContain("/assets/reference/img/room_option_decide.gif");
    expect(html).toContain("/assets/reference/img/room_option_betr.gif");
    expect(html).toContain("/assets/reference/img/room_option_cat.gif");
    expect(html).toContain("/assets/reference/img/room_option_will.gif");
    expect(html).toContain("/assets/reference/img/room_option_open_vote.gif");
    expect(html).toContain("/assets/reference/img/room_option_common.gif");
    expect(html).toContain("/assets/reference/img/room_option_wish_role.gif");
    expect(html).toContain("/assets/reference/img/room_option_gm.gif");
    expect(html).toContain("/assets/reference/img/room_option_voteme.gif");
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
    expect(html).toContain("頻道限:狼/戀");
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
    expect(html).toContain('form id="legacyRoomCreateForm" name="room" method="POST" action="/room_manager.php" onsubmit="return false"');
    expect(html).toContain('<input type="hidden" name="command" value="CREATE_ROOM">');
    expect(html).toContain('<input id="legacyCreatePlayerId" type="hidden" name="player_id" value="">');
    expect(html).toContain('<input id="roomName" name="room_name" maxlength="48" size="45"> 村');
    expect(html).toContain('<input id="roomComment" name="room_comment" maxlength="120" size="50">');
    expect(html).toContain('<select id="maxPlayers" name="max_user">');
    expect(html).toContain('name="game_option_real_time" value="real_time"');
    expect(html).toContain('name="option_role_poison" value="poison"');
    expect(html).toContain('name="option_role_foxs" value="betr"');
    expect(html).toContain('name="game_option_dummy_boy" value="dummy_boy"');
    expect(html).toContain('document.querySelector("#legacyCreatePlayerId").value = localStorage.getItem(playerKey);');
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
    expect(html).toContain('id="phaseWarning"');
    expect(html).toContain('<script src="/assets/room-client.js" defer></script>');
    expect(html).not.toContain("new WebSocket");
    expect(html).toContain("room-phase-lobby");
    expect(html).toContain("room-phase-night");
    expect(html).toContain('document.body.classList.add("room-phase-lobby", "room-view-player", "room-page-full");');
    expect(html).toContain('<a id="game_top" name="game_top"></a>');
    expect(html).toContain('data-room-page="full"');
    expect(html).toContain(".view-spectator-only, .view-heaven-only { display: none; }");
    expect(html).toContain("body.room-view-spectator .view-player-only");
    expect(html).toContain("body.room-view-heaven .room-registration-row { display: none; }");
    expect(html).toContain("body.room-view-heaven .view-heaven-only { display: table-row; }");
    expect(html).toContain("進入房間");
    expect(html).toContain(".player-grid { width: 800px; max-width: 100%; border: 1px dotted #000000; border-spacing: 5px; border-collapse: separate; font-size: 10pt; }");
    expect(html).toContain(".player-card { width: 148px; border: 1px solid #b0b0b0; background: #fafafa; table-layout: fixed; }");
    expect(html).toContain(".player-card > table { width: 100%; border-collapse: collapse; table-layout: fixed; }");
    expect(html).toContain(".player-card.start-voted { background: #ff50ff; }");
    expect(html).toContain(".player-name { padding-left: 5px; max-width: 96px; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain("#chatLog div, #gameLog div { border-top: 1px dashed silver; padding: 2px 4px; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain('#chatLog .chat-speaker { width: 200px; }');
    expect(html).toContain('#chatLog .chat-gm .chat-speaker, #chatLog .chat-gm .chat-message { color: red; }');
    expect(html).toContain('#chatLog .chat-dead .chat-speaker, #chatLog .chat-dead .chat-message { background-color: #cccccc; color: black; }');
    expect(html).toContain("#gameLog .game-log-system td { background-color: #efefef; color: black; font-weight: bold; }");
    expect(html).toContain("#gameLog .game-log-vote td { background-color: #999900; color: snow; font-weight: bold; }");
    expect(html).toContain("#gameLog .game-log-danger td { background-color: red; color: snow; font-weight: bold; }");
    expect(html).toContain("#lastWordsLog div { border-top: 1px dotted silver; padding: 2px 4px; overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain("#lastWordsLog .last-words-heading td { background-color: #ccddff; color: black; font-weight: bold; }");
    expect(html).toContain("#lastWordsLog .last-words-row { background-color: #eeeeff; color: black; }");
    expect(html).toContain("body.room-view-spectator .room-chat-controls { display: none; }");
    expect(html).toContain("body.room-view-heaven .room-live-chat-only { display: none; }");
    expect(html).toContain(".page-frame-only, .page-up-only, .page-vote-only, .page-vote-description, .page-bottom-only { display: none; }");
    expect(html).toContain("body.room-page-frame .room-aux-panel");
    expect(html).toContain("body.room-page-vote .room-registration-row,\n    body.room-page-bottom .room-registration-row { display: none; }");
    expect(html).toContain("body.room-page-up .room-panel-members");
    expect(html).toContain("body.room-page-up #chatLog { display: none; }");
    expect(html).toContain("body.room-page-up .game-header { display: none; }");
    expect(html).toContain("body.room-page-up .game-shell { width: 100%; margin: 0; }");
    expect(html).toContain("body.room-page-up .page-up-inline-only { display: inline; }");
    expect(html).toContain("body.room-page-vote .room-panel-actions,");
    expect(html).toContain("body.room-page-vote .room-panel-members,");
    expect(html).toContain("body.room-page-vote .room-panel-system { display: none; }");
    expect(html).toContain("body.room-page-vote .legacy-entry-map,");
    expect(html).toContain("body.room-page-vote .page-vote-description { display: none; }");
    expect(html).not.toContain("body.room-page-vote .page-vote-only { display: none; }");
    expect(html).toContain("body.room-phase-night .player-card.voted { background: #004000; color: snow; }");
    expect(html).toContain("body.room-phase-night .player-card.voted a { color: #ccffff; }");
    expect(html).toContain("Trip");
    expect(html).toContain("avatarFile");
    expect(html).toContain("defaultIcon");
    expect(html).toContain("/assets/reference/img/user_regist_title.gif");
    expect(html).toContain("/assets/reference/img/user_regist_handle_name.gif");
    expect(html).toContain("/assets/reference/img/user_regist_handle_trip.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role.gif");
    expect(html).toContain("/assets/reference/img/user_regist_icon.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_none.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_human.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_wolf.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_mage.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_necromancer.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_mad.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_guard.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_common.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_fox.gif");
    expect(html).toContain("/assets/reference/img/user_regist_role_betr.gif");
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
    expect(html).toContain('<div class="room-chat-controls">');
    expect(html).toContain('<button id="sendChat" class="room-live-chat-only">送出</button>');
    expect(html).toContain('<button id="sendDeadChat" disabled>靈界</button>');
    expect(html).toContain('<button id="sendRoomEndVote" class="room-live-chat-only" disabled>廢</button>');
    expect(html).toContain('id="gmControlPanel"');
    expect(html).toContain("GM行動");
    expect(html).toContain('id="gmStatus"');
    expect(html).toContain("#gmControlPanel .gm-controls-only { display: none; }");
    expect(html).toContain("body.room-gm #gmControlPanel .gm-controls-only { display: table-row; }");
    expect(html).toContain('<tr class="gm-controls-only">\n                    <td>發言</td>');
    expect(html).toContain("非GM");
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
    expect(html).toContain('<tr class="room-registration-row">\n              <td>登錄</td>');
    expect(html).toContain('<tr class="view-player-only room-registration-row">\n              <td><img class="title-img" src="/assets/reference/img/user_regist_handle_name.gif" alt="玩家暱稱">玩家暱稱</td>');
    expect(html).toContain("<a href=\"#nickname\"><strong>[住民登錄]</strong></a>");
    expect(html).toContain("<a href=\"/trip.php\">[身份登錄]</a>");
    expect(html).toContain("<a href=\"/trips\">[Trip查詢]</a>");
    expect(html).toContain("<a href=\"/\">[返回]</a>");
    expect(html).toContain('<small><a href="/icon_view.php">頭像一覽</a></small>');
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
    expect(html).toContain("[<a href=\"/room/room_abc\">手動更新</a>]");
    expect(html).toContain("<a href=\"/room/room_abc?auto_reload=15\">15秒</a>");
    expect(html).toContain("<a href=\"/room/room_abc?auto_reload=20\">20秒</a>");
    expect(html).toContain("<a href=\"/room/room_abc?auto_reload=30\">30秒</a>");
    expect(html).toContain("目前：手動");
    expect(html).toContain("玩家視點");
    expect(html).toContain('data-room-view="player"');
    expect(html).toContain("<a href=\"/room/room_abc?view=spectator\">旁觀</a>");
    expect(html).toContain("<a href=\"/room/room_abc?view=heaven\">靈界</a>");
    expect(html).toContain("PHP入口");
    expect(html).toContain("完整頁面");
    expect(html).toContain("PHP 版 frame/up/vote 入口的顯示模式");
    expect(html).toContain('<a href="/game_play.php?room_no=room_abc">game_play.php</a>');
    expect(html).toContain('<a href="/game_view.php?room_no=room_abc">game_view.php</a>');
    expect(html).toContain('<a href="/game_view.php?room_no=room_abc&amp;view=heaven">heaven</a>');
    expect(html).toContain('<a href="/game_frame.php?room_no=room_abc">game_frame.php</a>');
    expect(html).toContain('<a href="/game_up.php?room_no=room_abc">game_up.php</a>');
    expect(html).toContain('<a href="/game_vote.php?room_no=room_abc">game_vote.php</a>');
    expect(html).toContain('<a href="/login.php?room_no=room_abc">login.php</a>');
    expect(html).toContain('<a href="/user_manager.php?room_no=room_abc">user_manager.php</a>');
    expect(html).toContain('<a href="/game_play.php?go=out&amp;room_no=room_abc" target="_top">[登出]</a>');
    expect(html).toContain('form id="legacyUserRegisterForm" class="legacy-user-register-form" name="user" action="/user_manager.php?room_no=room_abc" method="POST" enctype="multipart/form-data" onsubmit="return false"');
    expect(html).toContain('<input type="hidden" name="command" value="regist">');
    expect(html).toContain('<input type="hidden" name="room_no" value="room_abc">');
    expect(html).toContain('<input id="nickname" name="handle_name" form="legacyUserRegisterForm" maxlength="32" size="28">');
    expect(html).toContain('<input id="trip" name="tripn" form="legacyUserRegisterForm" maxlength="32" size="28">');
    expect(html).toContain('<select id="wishRole" name="role" form="legacyUserRegisterForm">');
    expect(html).toContain('<select id="defaultIcon" name="icon_no" form="legacyUserRegisterForm">');
    expect(html).toContain("/events");
    expect(html).toContain("事件履歷");
    expect(html).toContain("/room/room_abc/log");
    expect(html).toContain("完整紀錄");
    expect(html).toContain(".player-card.voted");
    expect(html).toContain(".revealed-role");
    expect(html).toContain(".role-werewolf");
    expect(html).toContain("權力者");
    expect(html).toContain("玩家列表");
    expect(html).toContain('id="lobbyStartNotice"');
    expect(html).toContain('id="voteObserverPanel"');
    expect(html).toContain("能力發動 / 投票");
    expect(html).toContain('id="actionPrompt"');
    expect(html).toContain('id="voteReminder"');
    expect(ROOM_CLIENT_SCRIPT).toContain("function renderGameLogPanel(game)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function gameLogText(line)");
    expect(ROOM_CLIENT_SCRIPT).toContain('return "< < 早晨來臨 " + dayStart[1] + " 日目的早上開始 > >";');
    expect(ROOM_CLIENT_SCRIPT).toContain('return "< < 日落、黑暗的夜晚來臨 > >";');
    expect(ROOM_CLIENT_SCRIPT).toContain("row.className = gameLogClass(line);");
    expect(ROOM_CLIENT_SCRIPT).toContain('cell.textContent = "　　　　　　　　　　　　" + gameLogText(line);');
    expect(html).toContain("尚無公開遺言。");
    expect(html).toContain("wishRole");
    expect(html).toContain("<option value=\"seer\">占卜師</option>");
    expect(html).toContain("<option value=\"big_wolf\">大狼</option>");
    expect(html).toContain("<option value=\"poison\">埋毒者</option>");
    expect(html).toContain("<option value=\"betrayer\">背德者</option>");
    expect(html).toContain("<option value=\"child_fox\">子狐</option>");
    expect(html).toContain("<option value=\"cat\">貓又</option>");
    expect(html).toContain("startVote");
    expect(html).toContain("leaveRoom");
    expect(html).toContain("sendDeadChat");
    expect(html).toContain("sendSelfTalk");
    expect(html).toContain("sendObjection");
    expect(html).toContain("soundNotify");
    expect(html).toContain("/assets/reference/img/objection.gif");
    expect(html).toContain("objectionRemaining");
    expect(html).toContain("lastWordsText");
    expect(html).toContain("setLastWords");
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateVoteReminder(game, currentPlayer, currentPlayerAlive, votedPlayerIds)");
    expect(ROOM_CLIENT_SCRIPT).toContain("系統提醒：您目前還沒有投票。");
    expect(ROOM_CLIENT_SCRIPT).toContain("系統提醒：您目前還沒有投票，如果同側已經投票請忽略此訊息。");
    expect(ROOM_CLIENT_SCRIPT).toContain('warning.style.backgroundColor = "#FF0000";');
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateActionPrompt(game, currentPlayer, currentPlayerAlive, votedPlayerIds)");
    expect(ROOM_CLIENT_SCRIPT).toContain("請選擇咬人對象");
    expect(ROOM_CLIENT_SCRIPT).toContain("請選擇要占卜的對象");
    expect(ROOM_CLIENT_SCRIPT).toContain("請選擇護衛的人");
    expect(ROOM_CLIENT_SCRIPT).toContain("請選擇投票處死的對象");
    expect(ROOM_CLIENT_SCRIPT).toContain("function canUseNightRoleAction(game, currentPlayer, currentPlayerAlive)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function canUseRequiredNightRoleAction(game, currentPlayer, currentPlayerAlive)");
    expect(ROOM_CLIENT_SCRIPT).toContain("canUseRequiredNightRoleAction(game, currentPlayer, currentPlayerAlive)");
    expect(ROOM_CLIENT_SCRIPT).toContain("if (game.day === 0) return false;");
    expect(ROOM_CLIENT_SCRIPT).toContain("function hasCatReviveTarget(game, currentPlayer)");
    expect(ROOM_CLIENT_SCRIPT).toContain("role === \"cat\") return hasCatReviveTarget(game, currentPlayer)");
    expect(ROOM_CLIENT_SCRIPT).toContain("ownNightActionTarget");
    expect(ROOM_CLIENT_SCRIPT).toContain("已選擇");
    expect(ROOM_CLIENT_SCRIPT).toContain("const nightActionDone = Boolean");
    expect(ROOM_CLIENT_SCRIPT).toContain("!nightActionDone");
    expect(ROOM_CLIENT_SCRIPT).toContain("投票重新開始");
    expect(ROOM_CLIENT_SCRIPT).toContain('game.phase === "day" && game.revoteCount > 0');
    expect(ROOM_CLIENT_SCRIPT).toContain("お前はもう死んでいる・・・");
  });

  it("renders room page meta refresh for PHP-style auto reload", () => {
    const html = renderRoom("room_abc", { autoReloadSeconds: 20 });

    expect(html).toContain('<meta http-equiv="refresh" content="20">');
    expect(html).toContain("目前：20秒");

    const legacy = renderRoom("room_abc", { legacyPath: "/game_play.php" });
    expect(legacy).toContain('[<a href="/game_play.php?room_no=room_abc">手動更新</a>]');
    expect(legacy).toContain('<a href="/game_play.php?room_no=room_abc&amp;auto_reload=15">15秒</a>');

    const legacySpectator = renderRoom("room_abc", { viewMode: "spectator", legacyPath: "/login.php" });
    expect(legacySpectator).toContain('<a href="/login.php?room_no=room_abc&amp;auto_reload=15&amp;view=spectator">15秒</a>');
  });

  it("renders room spectator and heaven view links", () => {
    const spectator = renderRoom("room_abc", { viewMode: "spectator", autoReloadSeconds: 20 });
    expect(spectator).toContain("<title>汝等是人是狼？[觀戰]</title>");
    expect(spectator).toContain('document.body.classList.add("room-phase-lobby", "room-view-spectator", "room-page-full");');
    expect(spectator).toContain('data-room-view="spectator"');
    expect(spectator).toContain("旁觀視點");
    expect(spectator).toContain("只觀看公開資訊與玩家列表");
    expect(spectator).toContain("body.room-view-spectator .room-registration-row");
    expect(spectator).toContain("body.room-view-spectator .room-chat-controls { display: none; }");
    expect(spectator).toContain('<tr><th>玩家列表</th></tr>');
    expect(spectator).not.toContain('<tr class="view-player-only">\n        <td>\n          <table class="panel">\n            <tr><th>玩家列表</th></tr>');
    expect(spectator).toContain('<tr class="view-player-only room-panel-actions">\n        <td>\n          <table class="panel">\n            <tr><th>能力發動 / 投票</th></tr>');
    expect(spectator).toContain('<tr class="view-player-only room-registration-row">\n              <td><img class="title-img" src="/assets/reference/img/user_regist_handle_name.gif" alt="玩家暱稱">玩家暱稱</td>');
    expect(spectator).toContain('<a href="/room/room_abc?view=spectator&amp;auto_reload=15">15秒</a>');
    expect(spectator).toContain('<a href="/room/room_abc?view=heaven&amp;auto_reload=20">靈界</a>');
    expect(spectator).toContain('<a href="/game_view.php?room_no=room_abc&amp;auto_reload=20">game_view.php</a>');
    expect(spectator).toContain('<a href="/game_view.php?room_no=room_abc&amp;auto_reload=20&amp;view=heaven">heaven</a>');

    const heaven = renderRoom("room_abc", { viewMode: "heaven" });
    expect(heaven).toContain("room-view-heaven");
    expect(heaven).toContain('data-room-view="heaven"');
    expect(heaven).toContain("靈界視點");
    expect(heaven).toContain("死亡後視點入口");
    expect(heaven).toContain("body.room-view-heaven .room-registration-row");
    expect(heaven).toContain("body.room-view-heaven .room-live-chat-only { display: none; }");
    expect(heaven).toContain('<button id="sendDeadChat" disabled>靈界</button>');
    expect(heaven).toContain('<tr><th>玩家列表</th></tr>');
    expect(heaven).toContain('<tr class="view-player-only room-panel-actions">\n        <td>\n          <table class="panel">\n            <tr><th>能力發動 / 投票</th></tr>');
    expect(heaven).toContain("game_play / game_view / heaven");
  });

  it("renders PHP-style room panel modes", () => {
    const frame = renderRoom("room_abc", { pageMode: "frame" });
    expect(frame).toContain("<title>汝等是人是狼？＜遊戲＞</title>");
    expect(frame).toContain('document.body.classList.add("room-phase-lobby", "room-view-player", "room-page-frame");');
    expect(frame).toContain('data-room-page="frame"');
    expect(frame).toContain("框架入口");
    expect(frame).toContain("保留主要遊戲畫面與即時更新，隱藏診斷性紀錄面板。");
    expect(frame).toContain('data-legacy-entry="game_frame.php"');
    expect(frame).toContain('[<a href="/game_frame.php?room_no=room_abc">手動更新</a>]');
    expect(frame).toContain('<a href="/game_frame.php?room_no=room_abc&amp;auto_reload=15">15秒</a>');
    expect(frame).toContain("game_frame.php frameset");
    expect(frame).toContain("body.room-page-frame .room-registration-row");
    expect(frame).toContain("<tr><td>rows</td><td colspan=\"2\">85,*</td></tr>");
    expect(frame).toContain('<tr><td>frame name="up"</td><td>src</td><td><a href="/game_up.php?room_no=room_abc#game_top">game_up.php#game_top</a></td></tr>');
    expect(frame).toContain('<tr><td>frame name="bottom"</td><td>src</td><td><a href="/game_play.php?room_no=room_abc&amp;frame=bottom#game_top">game_play.php?frame=bottom#game_top</a></td></tr>');
    expect(frame).toContain('<tr class="room-aux-panel">');

    const bottom = renderRoom("room_abc", { pageMode: "bottom" });
    expect(bottom).toContain("<title>汝等是人是狼？＜遊戲＞</title>");
    expect(bottom).toContain('data-room-page="bottom"');
    expect(bottom).toContain("下方遊戲");
    expect(bottom).toContain("game_frame.php 下框；保留主遊戲輸出");
    expect(bottom).toContain("body.room-page-bottom .room-registration-row");
    expect(bottom).toContain("body.room-page-bottom .game-header .full-room-only { display: none; }");
    expect(bottom).toContain("body.room-page-bottom .legacy-entry-map,");
    expect(bottom).toContain("body.room-page-bottom .page-bottom-only { display: none; }");
    expect(bottom).toContain("body.room-page-bottom .room-chat-controls { display: none; }");
    expect(bottom).toContain('data-legacy-entry="game_play.php bottom"');
    expect(bottom).toContain('[<a href="/game_play.php?room_no=room_abc&amp;frame=bottom">手動更新</a>]');
    expect(bottom).toContain('<a href="/game_play.php?room_no=room_abc&amp;auto_reload=15&amp;frame=bottom">15秒</a>');
    expect(bottom).toContain("game_play.php 下框");
    expect(bottom).toContain('<tr><td>hidden chrome</td><td colspan="2">住民登錄、PHP入口列表、診斷紀錄面板</td></tr>');
    expect(bottom).toContain('<tr class="room-panel-members">');
    expect(bottom).toContain('<tr class="room-panel-chat">');
    expect(bottom).toContain('<tr class="room-aux-panel">');

    const up = renderRoom("room_abc", { pageMode: "up" });
    expect(up).toContain("<title>汝等是人是狼？＜發言＞</title>");
    expect(up).toContain('data-room-page="up"');
    expect(up).toContain("上方更新");
    expect(up).toContain("發言上框；保留發言、頻道按鈕與投票入口");
    expect(up).toContain("body.room-page-up .room-registration-row");
    expect(up).toContain('data-legacy-entry="game_up.php"');
    expect(up).toContain('[<a href="/game_up.php?room_no=room_abc">手動更新</a>]');
    expect(up).toContain('<a href="/game_up.php?room_no=room_abc&amp;auto_reload=15">15秒</a>');
    expect(up).toContain('form name="send"');
    expect(up).toContain('form class="legacy-send-form" name="send" action="/game_play.php?room_no=room_abc&amp;frame=bottom#game_top" method="POST" target="bottom" onsubmit="return false"');
    expect(up).toContain('<span class="page-up-inline-only legacy-up-vote-link">[<a href="/game_vote.php?room_no=room_abc#game_top" target="bottom">投票/能力</a>]</span>');
    expect(up).toContain('<input type="hidden" name="command" value="talk">');
    expect(up).toContain('<input type="hidden" name="room_no" value="room_abc">');
    expect(up).toContain('<input type="hidden" name="location" value="day">');
    expect(up).toContain('<input id="chatText" name="sentence" maxlength="500" size="72">');
    expect(up).toContain("<tr><td>form name=\"send\"</td><td>target</td><td>bottom</td></tr>");
    expect(up).toContain('<tr><td>vote_link</td><td colspan="2"><a href="/game_vote.php?room_no=room_abc#game_top">game_vote.php#game_top</a></td></tr>');
    expect(up).toContain('<tr class="room-panel-chat">');

    const vote = renderRoom("room_abc", { pageMode: "vote" });
    expect(vote).toContain("<title>汝等是人是狼？＜投票＞</title>");
    expect(vote).toContain('data-room-page="vote"');
    expect(vote).toContain("投票入口");
    expect(vote).toContain("著重能力發動與投票操作");
    expect(vote).toContain("body.room-page-vote .room-registration-row");
    expect(vote).toContain("body.room-page-vote .game-header .full-room-only,");
    expect(vote).toContain('data-legacy-entry="game_vote.php"');
    expect(vote).toContain('[<a href="/game_vote.php?room_no=room_abc">手動更新</a>]');
    expect(vote).toContain('<a href="/game_vote.php?room_no=room_abc&amp;auto_reload=15">15秒</a>');
    expect(vote).toContain("game_vote.php 投票 / 能力入口");
    expect(vote).toContain('action="game_vote.php?...#game_top" method="POST"');
    expect(vote).toContain("<tr><td>hidden</td><td>command</td><td>vote</td></tr>");
    expect(vote).toContain("<tr><td>等待室</td><td>situation</td><td>GAMESTART / KICK_DO / FKICK_DO</td></tr>");
    expect(vote).toContain("<tr><td>白天</td><td>situation</td><td>VOTE_KILL + vote_times</td></tr>");
    expect(vote).toContain("<tr><td>夜晚</td><td>situation</td><td>WOLF_EAT / MAGE_DO / FOSI_DO / GUARD_DO / CAT_DO</td></tr>");
    expect(vote).toContain('form class="legacy-vote-form" name="game_vote" action="/game_vote.php?room_no=room_abc#game_top" method="POST" onsubmit="return false"');
    expect(vote).toContain('<input type="hidden" name="command" value="vote">');
    expect(vote).toContain('<input type="hidden" name="room_no" value="room_abc">');
    expect(vote).toContain('<input type="hidden" name="situation" value="VOTE_KILL">');
    expect(vote).toContain('<input type="hidden" name="vote_times" value="1">');
    expect(vote).toContain('<input type="hidden" name="target_player_id" value="">');
    expect(vote).toContain('<input type="hidden" name="target_handle_name" value="">');
    expect(vote).toContain('<option value="GAMESTART">GAMESTART</option>');
    expect(vote).toContain('<option value="VOTE_KILL" selected>VOTE_KILL</option>');
    expect(vote).toContain('<option value="CAT_DO">CAT_DO</option>');
    expect(vote).toContain('<div id="legacyVoteTargetList">等待狀態更新</div>');
    expect(vote).toContain('<input type="radio" name="target_no" value="" disabled>');
    expect(vote).toContain('<input type="submit" value="投將該員\'處刑\'一票">');
    expect(vote).toContain('<input type="submit" value="咬下去">');
    expect(vote).toContain('class="table_votelist1"');
    expect(vote).toContain("投將該員'處刑'一票 / 咬下去 / 占卜對象 / 護衛對象 / 復活對象");
    expect(vote).toContain('<tr><td>back</td><td colspan="2"><a href="/game_up.php?room_no=room_abc#game_top">←上一頁&amp;重新整理</a></td></tr>');
    expect(vote).toContain("body.room-page-vote .room-panel-actions,");
    expect(vote).toContain("body.room-page-vote .room-panel-members,");
    expect(vote).toContain("body.room-page-vote .legacy-entry-map,");
    expect(vote).toContain("body.room-page-vote .page-vote-description { display: none; }");
    expect(vote).not.toContain("body.room-page-vote .page-vote-only { display: none; }");
    expect(vote).toContain('<tr class="view-player-only room-panel-actions">');
  });

  it("renders game_frame.php as a legacy frameset shell", () => {
    const html = renderLegacyGameFrame("room_abc", { autoReloadSeconds: 20 });
    expect(html).toContain("<title>汝等是人是狼？＜遊戲＞</title>");
    expect(html).toContain('<frameset rows="85,*" border="0" frameborder="0" framespacing="0" data-legacy-entry="game_frame.php">');
    expect(html).toContain('<frame name="up" src="/game_up.php?room_no=room_abc&amp;auto_reload=20#game_top" scrolling="no" noresize>');
    expect(html).toContain('<frame name="bottom" src="/game_play.php?room_no=room_abc&amp;auto_reload=20&amp;frame=bottom#game_top">');
    expect(html).toContain('<a href="/game_play.php?room_no=room_abc&amp;auto_reload=20&amp;frame=bottom#game_top">game_play.php#game_top</a>');
    expect(html).not.toContain('data-room-page="frame"');
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
    expect(ROOM_CLIENT_SCRIPT).toContain('tripLink.href = "/trips";');
    expect(ROOM_CLIENT_SCRIPT).toContain('tripLink.title = "Trip查詢";');
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_chat");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_whisper");
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateGmStatus()");
    expect(ROOM_CLIENT_SCRIPT).toContain('status.textContent = isGm ? "GM行動中" : "非GM";');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.body.classList.toggle("room-gm", isGm);');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.body.classList.toggle("room-non-gm", !isGm);');
    expect(ROOM_CLIENT_SCRIPT).toContain("function appendChatLine(channelLabel, markerColor, nickname, text, rowClass)");
    expect(ROOM_CLIENT_SCRIPT).toContain('messageCell.textContent = text || "";');
    expect(ROOM_CLIENT_SCRIPT).toContain('appendChatLine("(人狼)", "#cc0000", msg.nickname, msg.text, "chat-wolf");');
    expect(ROOM_CLIENT_SCRIPT).toContain('appendChatLine("(天國)", "#666666", msg.nickname, msg.text, "chat-dead");');
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_advance_phase");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_end_game");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_alive");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_role");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_flag");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_common_voice");
    expect(ROOM_CLIENT_SCRIPT).toContain("gm_set_channel_restrictions");
    expect(ROOM_CLIENT_SCRIPT).toContain("#gmEnableCommonVoice");
    expect(ROOM_CLIENT_SCRIPT).toContain("#gmDisableCommonVoice");
    expect(ROOM_CLIENT_SCRIPT).toContain("#gmSetChannelRestrictions");
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
    expect(ROOM_CLIENT_SCRIPT).toContain("function eventTypeLabel(eventType)");
    expect(ROOM_CLIENT_SCRIPT).toContain('eventTypeLabel(event.eventType)');
    expect(ROOM_CLIENT_SCRIPT).toContain('game_started: "遊戲開始"');
    expect(ROOM_CLIENT_SCRIPT).not.toContain('event.createdAt + "　" + event.eventType + player');
    expect(ROOM_CLIENT_SCRIPT).toContain("/api/players/\" + playerId + \"/records");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.hostId !== currentPlayerId");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.revoteCount");
    expect(ROOM_CLIENT_SCRIPT).toContain("function setRoomPhaseClass(phase)");
    expect(ROOM_CLIENT_SCRIPT).toContain('document.body.classList.add("room-phase-" + phase);');
    expect(ROOM_CLIENT_SCRIPT).toContain("function phaseLabel(game)");
    expect(ROOM_CLIENT_SCRIPT).toContain('" 日目 <small>(生存者" + aliveCount + "人)</small>"');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector("#phase").innerHTML = phaseLabel(game);');
    expect(ROOM_CLIENT_SCRIPT).toContain("function updatePhaseWarning(game)");
    expect(ROOM_CLIENT_SCRIPT).toContain('alert.style.backgroundColor = "#CC3300";');
    expect(ROOM_CLIENT_SCRIPT).toContain("快要日落了。請趕快投票");
    expect(ROOM_CLIENT_SCRIPT).toContain("快要日出了。請趕快投票");
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateLobbyStartNotice(game)");
    expect(ROOM_CLIENT_SCRIPT).toContain("需要遊戲全體人員投'開始遊戲'才能開始遊戲");
    expect(ROOM_CLIENT_SCRIPT).toContain("完成投票的玩家其名單背景顏色會變粉紅");
    expect(ROOM_CLIENT_SCRIPT).toContain("currentPlayerAlive");
    expect(ROOM_CLIENT_SCRIPT).toContain("currentPlayerDead");
    expect(ROOM_CLIENT_SCRIPT).toContain("voteSummary");
    expect(ROOM_CLIENT_SCRIPT).toContain("votedPlayerIds");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.openVote ? \"公開投票先\" : \"投票先非公開\"");
    expect(ROOM_CLIENT_SCRIPT).toContain("lobbyKickVoteTargets");
    expect(ROOM_CLIENT_SCRIPT).toContain("const lobbyStartVotedPlayerIds = new Set(game.lobbyStartVotedPlayerIds || []);");
    expect(ROOM_CLIENT_SCRIPT).toContain('lobbyStartVotedPlayerIds.has(player.playerId) ? " start-voted" : ""');
    expect(ROOM_CLIENT_SCRIPT).toContain("踢出投票：");
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateVoteObserverPanel(game, currentPlayer, currentPlayerDead, voteSummary, votedPlayerIds)");
    expect(ROOM_CLIENT_SCRIPT).toContain('const container = document.querySelector("#voteObserverPanel");');
    expect(ROOM_CLIENT_SCRIPT).toContain("container.innerHTML = \"\";");
    expect(ROOM_CLIENT_SCRIPT).toContain("旁觀視點");
    expect(ROOM_CLIENT_SCRIPT).toContain("靈界視點");
    expect(ROOM_CLIENT_SCRIPT).toContain("投票先非公開");
    expect(ROOM_CLIENT_SCRIPT).toContain("公開投票先");
    expect(ROOM_CLIENT_SCRIPT).toContain('game.phase === "night"');
    expect(ROOM_CLIENT_SCRIPT).toContain('"已行動 " + votedPlayerIds.size + "。"');
    expect(ROOM_CLIENT_SCRIPT).toContain('if (!game.openVote || !Object.keys(voteSummary).length) return;');
    expect(ROOM_CLIENT_SCRIPT).toContain("updateVoteObserverPanel(game, currentPlayer, currentPlayerDead, voteSummary, votedPlayerIds);");
    expect(ROOM_CLIENT_SCRIPT).toContain("function updateLegacyVoteTargetList(game, currentPlayer, currentPlayerAlive, currentPlayerId, canManageLobby, canUsePlayerAction)");
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector("#legacyVoteTargetList")');
    expect(ROOM_CLIENT_SCRIPT).toContain("let legacyVoteCommands = {};");
    expect(ROOM_CLIENT_SCRIPT).toContain('const legacyVoteForm = document.querySelector(".legacy-vote-form");');
    expect(ROOM_CLIENT_SCRIPT).toContain('legacyVoteForm.addEventListener("submit", (event) => {');
    expect(ROOM_CLIENT_SCRIPT).toContain('const selectedTarget = legacyVoteForm.querySelector(\'input[name="target_no"]:checked\');');
    expect(ROOM_CLIENT_SCRIPT).toContain("latestGame.players.find((player) => player.playerId === selectedTarget.value)");
    expect(ROOM_CLIENT_SCRIPT).toContain("syncLegacyVoteHiddenFields(legacyVoteCommands[selectedTarget.value], latestGame, targetPlayer);");
    expect(ROOM_CLIENT_SCRIPT).toContain("sendCommand(legacyVoteCommands[selectedTarget.value]);");
    expect(ROOM_CLIENT_SCRIPT).toContain("function legacySituationForCommand(command)");
    expect(ROOM_CLIENT_SCRIPT).toContain('start_vote: "GAMESTART"');
    expect(ROOM_CLIENT_SCRIPT).toContain('kick_vote: "KICK_DO"');
    expect(ROOM_CLIENT_SCRIPT).toContain('kick_player: "FKICK_DO"');
    expect(ROOM_CLIENT_SCRIPT).toContain('night_kill: "WOLF_EAT"');
    expect(ROOM_CLIENT_SCRIPT).toContain('child_fox_divine: "FOSI_DO"');
    expect(ROOM_CLIENT_SCRIPT).toContain('cat_revive: "CAT_DO"');
    expect(ROOM_CLIENT_SCRIPT).toContain("function syncLegacyVoteHiddenFields(command, game, targetPlayer)");
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector(\'.legacy-vote-form input[name="situation"]\')');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector(\'.legacy-vote-form select[name="situation_selector"]\')');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector(\'.legacy-vote-form input[name="vote_times"]\')');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector(\'.legacy-vote-form input[name="target_player_id"]\')');
    expect(ROOM_CLIENT_SCRIPT).toContain('document.querySelector(\'.legacy-vote-form input[name="target_handle_name"]\')');
    expect(ROOM_CLIENT_SCRIPT).toContain("const situationValue = legacySituationForCommand(command);");
    expect(ROOM_CLIENT_SCRIPT).toContain("situation.value = situationValue;");
    expect(ROOM_CLIENT_SCRIPT).toContain("situationSelector.value = situationValue;");
    expect(ROOM_CLIENT_SCRIPT).toContain('voteTimes.value = String((game && typeof game.revoteCount === "number" ? game.revoteCount : 0) + 1);');
    expect(ROOM_CLIENT_SCRIPT).toContain('targetPlayerId.value = targetPlayer ? targetPlayer.playerId : "";');
    expect(ROOM_CLIENT_SCRIPT).toContain('targetHandleName.value = targetPlayer ? targetPlayer.nickname : "";');
    expect(ROOM_CLIENT_SCRIPT).toContain("legacyTargetCommand(game, currentPlayer, currentPlayerAlive, currentPlayerId, canManageLobby, canUsePlayerAction, player)");
    expect(ROOM_CLIENT_SCRIPT).toContain('const selfTargetAllowed = game.phase === "day" && game.selfVote === true;');
    expect(ROOM_CLIENT_SCRIPT).toContain("(player.playerId === currentPlayerId && !selfTargetAllowed)");
    expect(ROOM_CLIENT_SCRIPT).toContain("updateLegacyVoteTargetList(game, currentPlayer, currentPlayerAlive, currentPlayerId, canManageLobby, canUsePlayerAction);");
    expect(ROOM_CLIENT_SCRIPT).toContain("syncLegacyVoteHiddenFields(undefined, game);");
    expect(ROOM_CLIENT_SCRIPT).toContain('radio.name = "target_no";');
    expect(ROOM_CLIENT_SCRIPT).toContain("legacyVoteCommands[player.playerId] = action.command;");
    expect(ROOM_CLIENT_SCRIPT).toContain('button.textContent = "投開始遊戲一票";');
    expect(ROOM_CLIENT_SCRIPT).toContain('const command = { type: "start_vote" };');
    expect(ROOM_CLIENT_SCRIPT).toContain('syncLegacyVoteHiddenFields(command, game);');
    expect(ROOM_CLIENT_SCRIPT).toContain('sendCommand(command);');
    expect(ROOM_CLIENT_SCRIPT).toContain('radio.addEventListener("change", () => syncLegacyVoteHiddenFields(action.command, game, player));');
    expect(ROOM_CLIENT_SCRIPT).toContain("radio.checked = true;");
    expect(ROOM_CLIENT_SCRIPT).toContain("syncLegacyVoteHiddenFields(action.command, game, player);");
    expect(ROOM_CLIENT_SCRIPT).toContain('button.addEventListener("click", () => {');
    expect(ROOM_CLIENT_SCRIPT).toContain('table.className = "vote-table";');
    expect(ROOM_CLIENT_SCRIPT).toContain('headingCell.textContent = phaseLabel(game);');
    expect(ROOM_CLIENT_SCRIPT).toContain('"投票給 " + (targetTotals[targetId] || 0) + " 票 →"');
    expect(ROOM_CLIENT_SCRIPT).toContain("\" voted\"");
    expect(ROOM_CLIENT_SCRIPT).toContain("投票：");
    expect(ROOM_CLIENT_SCRIPT).toContain("const dayVoteDone = Boolean");
    expect(ROOM_CLIENT_SCRIPT).toContain("const canUsePlayerAction =");
    expect(ROOM_CLIENT_SCRIPT).toContain("!dayVoteDone");
    expect(ROOM_CLIENT_SCRIPT).toContain("function roleLabel(value)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function roleIconPath(value)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function referenceImage(path, alt)");
    expect(ROOM_CLIENT_SCRIPT).toContain("function renderCurrentRole(roleValue, detailText)");
    expect(ROOM_CLIENT_SCRIPT).toContain("roleContainer.append(referenceImage(iconPath, roleLabel(roleValue)));");
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
    expect(ROOM_CLIENT_SCRIPT).toContain("renderCurrentRole(msg.role, wolves + commons + lovers + foxes + authority);");
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
    expect(ROOM_CLIENT_SCRIPT).toContain("room_end_vote");
    expect(ROOM_CLIENT_SCRIPT).toContain("#sendRoomEndVote");
    expect(ROOM_CLIENT_SCRIPT).toContain("game.roomEndVotedPlayerIds");
    expect(ROOM_CLIENT_SCRIPT).toContain("maxObjections - ((game.objectionCounts || {})[currentPlayerId] || 0)");
    expect(ROOM_CLIENT_SCRIPT).toContain("#objectionRemaining");
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
    expect(ROOM_CLIENT_SCRIPT).toContain("function renderLastWordsPanel(game)");
    expect(ROOM_CLIENT_SCRIPT).toContain('line.includes(" 的遺言：")');
    expect(ROOM_CLIENT_SCRIPT).toContain("尚無公開遺言。");
    expect(ROOM_CLIENT_SCRIPT).toContain("・早上發現死者的遺書");
    expect(ROOM_CLIENT_SCRIPT).toContain('const separator = " 的遺言：";');
    expect(ROOM_CLIENT_SCRIPT).toContain('nameCell.textContent = line.slice(0, separatorIndex) + " 的遺言";');
    expect(ROOM_CLIENT_SCRIPT).toContain("self_talk");
    expect(ROOM_CLIENT_SCRIPT).toContain("#sendSelfTalk");
    expect(ROOM_CLIENT_SCRIPT).toContain("的自言自語");
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

  it("keeps the external room client script parseable", () => {
    expect(() => new Function(ROOM_CLIENT_SCRIPT)).not.toThrow();
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
    expect(html).toContain("function roleIconPath(value)");
    expect(html).toContain("function appendRoleIcon(container, role)");
    expect(html).toContain('image.src = "/assets/reference/" + path;');
    expect(html).toContain("appendRoleIcon(div, record.role)");
  });

  it("renders Trip lookup page", () => {
    const html = renderTripLookup();

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("Trip查詢");
    expect(html).toContain("Trip公開資料");
    expect(html).toContain('form name="trip" action="/trip.php" method="get"');
    expect(html).toContain('name="sname" size="9"');
    expect(html).toContain('name="go" type="submit" value="search"');
    expect(html).toContain("tripLookupButton");
    expect(html).toContain("/api/trips/lookup?trip=");
    expect(html).toContain("werewolf_cf_trip");
    expect(html).toContain("escapeClientHtml");
    expect(html).toContain("function tripStateMark(label, state)");
    expect(html).toContain("health-mark");
    expect(html).toContain("encodeURIComponent(playerId)");
  });

  it("renders legacy Trip room-record capacity filter links", () => {
    const html = renderTripRoomRecords("ab12CD", [
      {
        id: 1,
        roomId: "room_trip",
        winner: "werewolves",
        day: 4,
        playerId: "player_trip",
        nickname: "Trip Player",
        role: "werewolf",
        alive: false,
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("Trip參與紀錄");
    expect(html).toContain("/trip.php?go=room&id=ab12CD");
    expect(html).toContain("/trip.php?go=room&id=ab12CD&amp;play=8");
    expect(html).toContain("/trip.php?go=room&id=ab12CD&amp;play=16");
    expect(html).toContain("/trip.php?go=room&id=ab12CD&amp;play=22");
    expect(html).toContain("/trip.php?go=room&id=ab12CD&amp;play=30");
    expect(html).toContain("/assets/reference/img/victory_role_wolf.gif");
    expect(html).toContain("人狼勝利");
  });

  it("renders legacy Trip room-record pagination links with capacity filters", () => {
    const html = renderTripRoomRecords("ab12CD", [], { page: 2, pageSize: 15, totalRecords: 31, play: 16 });

    expect(html).toContain("bbs-pagination");
    expect(html).toContain('<a href="/trip.php?go=room&id=ab12CD&play=16&page=1">[1]</a>');
    expect(html).toContain("<strong>[2]</strong>");
    expect(html).toContain('<a href="/trip.php?go=room&id=ab12CD&play=16&page=3">[3]</a>');
  });

  it("renders legacy Trip comment surface", () => {
    const html = renderTripComments("ab12CD", [
      {
        id: 1,
        roomId: "room_abc",
        reviewerTrip: "ef34GH",
        targetTrip: "ab12CD",
        message: "Good player",
        score: 1,
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("評語");
    expect(html).toContain("/trip.php?go=trip&id=ab12CD");
    expect(html).toContain("/trip.php?go=room&id=ab12CD");
    expect(html).toContain("村莊ID");
    expect(html).toContain("評論者");
    expect(html).toContain("評價");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc");
    expect(html).toContain("/trip.php?go=trip&id=ef34GH");
    expect(html).toContain("正");
    expect(html).toContain("Good player");
  });

  it("renders legacy Trip rating surface", () => {
    const html = renderTripRating("room_abc", "ab12CD");

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("評分");
    expect(html).toContain("/trip.php?go=trip&id=ab12CD");
    expect(html).toContain("/trip.php?go=smess&id=ab12CD");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc");
    expect(html).toContain('action="/trip.php?go=sce&amp;room=room_abc&amp;trip=ab12CD"');
    expect(html).toContain('name="sceis" value="1" disabled');
    expect(html).toContain('name="mess" size="30" value="" disabled');
    expect(html).toContain("trip_score");
  });

  it("renders dedicated Trip registration page", () => {
    const html = renderTripRegistration();

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("身份登錄");
    expect(html).toContain("Trip公開資料");
    expect(html).toContain("/trip.php?go=post");
    expect(html).toContain("/trip.php?go=edit2");
    expect(html).toContain("/trip.php?go=edit");
    expect(html).toContain("/trip.php?go=accadd");
    expect(html).toContain("/trip.php?go=out");
    expect(html).toContain("/trip.php?go=icon");
    expect(html).toContain("registerTripButton");
    expect(html).toContain("claimTripButton");
    expect(html).toContain("excludeTripButton");
    expect(html).toContain("removeTripExclusionButton");
    expect(html).toContain('form name="trip" method="post" action="/trip.php?go=post"');
    expect(html).toContain('form name="trip" method="post" action="/trip.php?go=out"');
    expect(html).toContain('type="text" name="name" maxlength="32" size="24" value=""');
    expect(html).toContain('type="password" name="password" maxlength="128" size="24" value=""');
    expect(html).toContain('type="text" name="aname" maxlength="120" size="24" value=""');
    expect(html).toContain('id="submit" name="submit" type="submit" value="送出"');
    expect(html).toContain('form name="trip" method="post" action="/trip.php?go=edit"');
    expect(html).toContain('form name="trip" method="post" action="/trip.php?go=edit2"');
    expect(html).toContain('form name="trip" method="post" action="/trip.php?go=accadd"');
    expect(html).toContain('type="text" name="nname" size="24" value=""');
    expect(html).toContain('type="text" name="lname" size="24" value=""');
    expect(html).toContain('type="password" name="lpassword" size="24" value=""');
    expect(html).toContain('type="text" name="aname" size="24" value=""');
    expect(html).toContain('type="password" name="apassword" size="24" value=""');
    expect(html).toContain('id="tripClaimLegacySubmit" name="submit" type="submit" value="送出" disabled');
    expect(html).toContain("此 Cloudflare 版本不保存舊 PHP 管理密碼");
    expect(html).toContain('name="aname"');
    expect(html).toContain("tripLookupButton");
    expect(html).toContain("/api/trips");
    expect(html).toContain("/api/trips/claim");
    expect(html).toContain("/api/trips/exclusions");
    expect(html).toContain("/api/trips/lookup?trip=");
    expect(html).toContain("werewolf_cf_trip");
    expect(html).toContain("werewolf_cf_nickname");
    expect(html).toContain("function tripStateMark(label, state)");
    expect(html).toContain("health-error");
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
      { winner: "lovers", label: "戀勝", wins: 0, total: 4, rate: 0 },
      { winner: "draw", label: "平手", wins: 0, total: 4, rate: 0 }
    ]);

    expect(html).toContain("勝率分析");
    expect(html).toContain("－人勝－");
    expect(html).toContain("－平手－");
    expect(html).toContain("2 / 4");
    expect(html).toContain("勝率 50.00 %");
    expect(html).toContain("/api/stats/win-rate");
  });

  it("renders default icon catalog as a normal HTML page", () => {
    const html = renderIconCatalog();

    expect(html).toContain("<title>用戶圖像一覽</title>");
    expect(html).toContain("頭像一覽");
    expect((html.match(/<a href="\/index.php">←返回<\/a>/g) ?? []).length).toBe(2);
    expect((html.match(/<a href="\/index.php">←返回<\/a><br>/g) ?? []).length).toBe(2);
    expect(html).not.toContain('<p><a href="/index.php">←返回</a></p>');
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/icon_view_title.jpg" alt="頭像一覽"><br>');
    expect(html).not.toContain('<p><img class="title-img" src="/assets/reference/img/icon_view_title.jpg" alt="頭像一覽"></p>');
    expect(html).toContain("/assets/reference/img/icon_view_bg.jpg");
    expect(html).toContain('<a href="/icon_upload.php#upload" style="font-size:12pt;color:blue;">→頭像登錄</a>');
    expect(html).toContain("/assets/reference/user_icon/001.gif");
    expect(html).toContain("/assets/reference/user_icon/010.gif");
    expect(html).toContain("#DDDDDD");
    expect(html).toContain("#FF9999");
    expect(html).toContain('<table border="0" style="font-size:12pt;margin:12px auto 18px;">');
    expect(html).toContain('width="32" height="32" border="2" style="border-color:#DDDDDD;"');
    expect(html).toContain('<td width="150px">(1)<br>明灰<br><font color="#DDDDDD">◆</font><span style="font-family:新細明體;">#DDDDDD</span><br><button class="iconPickButton" data-icon-path="user_icon/001.gif">使用</button></td>');
    expect(html).toContain("32 x 32");
    expect(html).toContain("iconPickStatus");
    expect(html).toContain("iconPickButton");
    expect(html).toContain('data-icon-path="user_icon/001.gif"');
    expect(html).toContain('localStorage.setItem("werewolf_cf_default_icon", iconPath)');
    expect(html).toContain("上傳頭像");
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/icon_upload_title.jpg" alt="上傳頭像"><br>');
    expect(html).not.toContain('<p><img class="title-img" src="/assets/reference/img/icon_upload_title.jpg" alt="上傳頭像"></p>');
    expect(html).toContain("/assets/reference/img/icon_upload_bg.jpg");
    expect(html).toContain('<a href="/icon_view.php" style="font-size:12pt;color:blue;">→圖像一覽</a>');
    expect(html).toContain('id="upload"');
    expect(html).toContain("iconUploadFile");
    expect(html).toContain("iconUploadButton");
    expect(html).toContain("iconRemoveButton");
    expect(html).toContain('action="/upload.php"');
    expect(html).toContain('name="player_id"');
    expect(html).toContain('name="icon_file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" size="80" style="border-width:1px;border-color:black;border-style:solid;background-color:aliceblue;"');
    expect(html).toContain("請勿上傳動態GIF");
    expect(html).toContain("圖像名稱");
    expect(html).toContain('name="icon_name" type="text" maxlength="20" size="20" style="border-width:1px;border-color:black;border-style:solid;background-color:aliceblue;"');
    expect(html).toContain('name="submit" type="submit" value="登錄" style="border-width:1px;border-color:black;border-style:solid;"');
    expect(html).toContain("圖像的顏色選擇");
    expect(html).toContain('name="color" value="#000000"');
    expect(html).toContain('name="color" value="#6699cc"');
    expect(html).toContain('name="color" value="#ff3366"');
    expect((html.match(/name="color" value="#[0-9a-f]{6}"/g) ?? []).length).toBe(216);
    expect(html).toContain('<input name="color" maxlength="7" size="10"');
    expect(html).not.toContain('name="color_custom"');
    expect(html).toContain("(例：#6699cc)");
    expect(html).toContain('action="/upload2.php"');
    expect(html).toContain("/api/assets/avatar");
    expect(html).toContain("頭像需小於 512KiB");
  });

  it("renders the legacy icon upload title for upload aliases", () => {
    const html = renderIconCatalog("/icon_upload.php");

    expect(html).toContain("<title>用戶圖像上傳</title>");
    expect(html).toContain('<b><a href="/icon_upload.php">頭像上傳</a></b>');
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
          authority: true,
          decider: true,
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
    ], [], { backPageHref: "/index.php?room=1&from=list" });

    expect(html).toContain("聯合遊戲列表");
    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain('<b><a href="/list.php">聯合列表</a></b>');
    expect(html).toContain('<a href="/index.php?room=1&amp;from=list">←返回</a>');
    expect(html).toContain('<td class="main">\n    <a href="/index.php?room=1&amp;from=list">←返回</a>');
    expect(html).toContain("服務中");
    expect(html).toContain("本伺服器");
    expect(html).toContain('<table border="0" cellpadding="0" cellspacing="0" style="width: 100%">');
    expect(html).toContain('<tr><td colspan="5"><hr></td></tr>');
    expect(html).toContain("募集中");
    expect(html).toContain("/assets/reference/img/waiting.gif");
    expect(html).toContain("/login.php?room_no=room_abc");
    expect(html).toContain("[room_abc]");
    expect(html).toContain("Test村");
    expect(html).toContain("人數22");
    expect(html).toContain('<td width="50">');
    expect(html).toContain('<td width="100">');
    expect(html).not.toContain("本伺服器 / 本伺服器");
  });

  it("renders remote federated room links", () => {
    const html = renderFederatedList(
      [
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
      ],
      [
        { name: "遠端伺服器", url: "https://remote.example", ok: true, roomCount: 1 },
        { name: "故障伺服器", url: "https://broken.example", ok: false, roomCount: 0, error: "HTTP 503" }
      ]
    );

    expect(html).toContain("遠端伺服器");
    expect(html).toContain("https://remote.example/room/remote_room");
    expect(html).toContain("Remote村");
    expect(html).toContain("/assets/reference/img/playing.gif");
    expect(html).toContain("聯合伺服器狀態");
    expect(html).toContain('<a href="https://remote.example">服務中</a>');
    expect(html).toContain('<td colspan="4"><a href="https://remote.example">https://remote.example</a></td>');
    expect(html).toContain('<a href="https://broken.example">失聯中</a>');
    expect(html).toContain('<td colspan="4"><a href="https://broken.example">https://broken.example</a></td>');
    expect(html).toContain("health-ok");
    expect(html).toContain("health-error");
    expect(html).toContain("故障伺服器");
    expect(html).toContain("連線失敗");
    expect(html).toContain("HTTP 503");
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
          bigWolf: true,
          authority: true,
          decider: true,
          lovers: true,
          betrayer: true,
          childFox: false,
          twoFoxes: false,
          cat: false,
          lastWords: false,
          openVote: true,
          commonTalkVisible: true,
          deadRoleVisible: true,
          wishRole: true,
          dummyBoy: true,
          customDummy: true,
          dummyName: "替身君",
          dummyLastWords: "",
          realTime: true,
          dayMinutes: 5,
          nightMinutes: 3,
          selfVote: false,
          voteStatus: false
        }
      }
    ], { winners: { room_finished: "villagers" } });

    expect(html).toContain("過去紀錄");
    expect(html).toContain("<title>汝等是人是狼？[過去紀錄]</title>");
    expect(html).toContain('<b><a href="/old_log.php">過去紀錄</a></b>');
    expect(html).toContain("村No");
    expect(html).toContain('<th colspan="12" class="column">選項</th>');
    expect(html).toContain("/assets/reference/img/old_log_bg.jpg");
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"><br>');
    expect(html).not.toContain('<p><img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"></p>');
    expect(html).toContain('<a href="/index.php">←返回</a> <a href="/old_log.php?all=1">[全部顯示]</a><br><br>');
    expect(html).not.toContain('<p><a href="/index.php">←返回</a> <a href="/old_log.php?all=1">[全部顯示]</a></p>');
    expect(html).toContain('form name="old_log" action="/old_log.php" method="get"');
    expect(html).toContain('name="search"');
    expect(html).toContain("Finished 村");
    expect(html).toContain("/old_log.php?all=1");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_finished");
    expect(html).toContain("/assets/reference/img/max16.gif");
    expect(html).toContain("最大16");
    expect(html).toContain("/assets/reference/img/victory_role_human.gif");
    expect(html).toContain("村民勝利");
    expect(html).toContain("reverse_log=on");
    expect(html).toContain("heaven_talk=on");
    expect(html).toContain("heaven_only=on");
    expect(html).toContain("埋毒");
    expect(html).toContain("公開票");
    expect(html).toContain("/assets/reference/img/room_option_wish_role.gif");
    expect(html).toContain("/assets/reference/img/room_option_dummy_boy.gif");
    expect(html).toContain("/assets/reference/img/room_option_decide.gif");
    expect(html).toContain("/assets/reference/img/room_option_authority.gif");
    expect(html).toContain("/assets/reference/img/room_option_wfbig.gif");
    expect(html).toContain("/assets/reference/img/room_option_betr.gif");
    expect(html).toContain("/assets/reference/img/rei.gif");
    expect(html).toContain("/assets/reference/img/conn_look.gif");
    expect(html).toContain("/assets/reference/img/room_option_lovers.gif");
    expect((html.match(/<td class="row old-log-option-cell">/g) ?? []).length).toBe(12);
    expect(html).toContain('<a href="/old_log.php">過去紀錄</a>');
  });

  it("preserves old log search terms in the reference search form", () => {
    const html = renderOldLogs([], { search: "Alpha & Beta" });

    expect(html).toContain("搜尋");
    expect(html).toContain('value="Alpha &amp; Beta"');
    expect(html).toContain('<td colspan="17" class="muted">沒有遊戲紀錄</td>');
  });

  it("renders old log pagination links with search terms", () => {
    const html = renderOldLogs([], { search: "Alpha & Beta", page: 2, pageSize: 25, totalRooms: 51 });

    expect(html).toContain("bbs-pagination");
    expect(html).toContain('<a href="/old_log.php?search=Alpha%20%26%20Beta&page=1">[1]</a>');
    expect(html).toContain("<strong>[2]</strong>");
    expect(html).toContain('<a href="/old_log.php?search=Alpha%20%26%20Beta&page=3">[3]</a>');
  });

  it("preserves old log index state in detail links", () => {
    const html = renderOldLogs([
      {
        id: "room_finished",
        name: "Finished",
        comment: "",
        maxPlayers: 16,
        status: "ended",
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
          dummyName: "",
          dummyLastWords: "",
          realTime: false,
          dayMinutes: 5,
          nightMinutes: 3,
          selfVote: false,
          voteStatus: false
        }
      }
    ], { search: "Alpha & Beta", page: 2, pageSize: 25, totalRooms: 51 });

    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_finished&amp;search=Alpha+%26+Beta&amp;page=2");
    expect(html).toContain("room_no=room_finished&amp;search=Alpha+%26+Beta&amp;page=2&amp;reverse_log=on");
  });

  it("renders transcript return links with preserved old log state", () => {
    const html = renderRoomTranscript("room_abc", [], [], { oldLogReturnHref: "/old_log.php?search=Alpha%20%26%20Beta&page=2" });

    expect(html).toContain('<a href="/old_log.php?search=Alpha%20%26%20Beta&amp;page=2">←返回</a>');
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

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain("主題列表");
    expect(html).toContain("發表主題");
    expect(html).toContain('<a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php?go=dige">精華區</a>');
    expect(html).not.toContain('<p><a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php">全部主題</a> <a href="/bbs.php?go=dige">精華區</a></p>');
    expect(html).toContain(".table1 { border-collapse: collapse; border: 1px solid #cccccc; }");
    expect(html).toContain('<table border="1" class="table1" bordercolor="#CCCCCC" align="center">');
    expect(html).toContain('<tr class="table3">');
    expect(html).toContain('<td align="center" width="50"> No.</td>');
    expect(html).toContain('<td width="320">標題</td>');
    expect(html).toContain('<td align="center" width="170">作者</td>');
    expect(html).toContain('<td align="center" width="40">回覆</td>');
    expect(html).toContain('<td align="center" width="150">最後時間</td>');
    expect(html).toContain('form name="bbs" method="post" action="/bbs.php?go=post"');
    expect(html).toContain('type="text" name="bname" maxlength="32" size="24"');
    expect(html).toContain('type="password" name="bpass" maxlength="128" size="24"');
    expect(html).toContain('type="text" name="title" maxlength="50" size="24"');
    expect(html).toContain('name="mess"');
    expect(html).toContain('id="submit" name="submit" type="submit" value="發表"');
    expect(html).toContain("[置頂] Welcome (精華)");
    expect(html).toContain("bbs-topic-pinned");
    expect(html).toContain("bbs-topic-digest");
    expect(html).toContain("Alice◆Trip");
    expect(html).toContain("/api/bbs/topics");
    expect(html).toContain("bbsPostButton");
    expect(html).toContain("bbsPassword");
    expect(html).toContain("編輯/刪除用");
    expect(html).toContain('password: document.querySelector("#bbsPassword").value');
    expect(html).toContain('"/bbs.php?view=" + encodeURIComponent(String(topicId))');
  });

  it("renders BBS digest list as a normal HTML page", () => {
    const html = renderBbs([], { digestOnly: true });

    expect(html).toContain("精華主題列表");
    expect(html).toContain('<b><a href="/bbs.php?go=dige">精華文章</a></b>');
    expect(html).toContain("沒有精華");
    expect(html).toContain('<a href="/bbs.php?go=post">發表主題</a> <a href="/bbs.php">全部主題</a>');
    expect(html).not.toContain('<a href="/bbs.php?go=dige">精華區</a>');
  });

  it("renders BBS topic pagination links", () => {
    const topics = Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      name: "Alice",
      title: `Topic ${index + 1}`,
      message: "Hello",
      trip: false,
      replyCount: 0,
      pinned: false,
      locked: false,
      digest: false,
      createdAt: "2026-05-06 12:00:00",
      updatedAt: "2026-05-06 12:00:00"
    }));
    const html = renderBbs(topics, { page: 2, pageSize: 15, totalTopics: 31 });

    expect(html).toContain("bbs-pagination");
    expect(html).toContain('<a href="/bbs.php?page=1">[1]</a>');
    expect(html).toContain("<strong>[2]</strong>");
    expect(html).toContain('<a href="/bbs.php?page=3">[3]</a>');
  });

  it("links BBS topic titles to the latest reply page", () => {
    const html = renderBbs([
      {
        id: 1,
        name: "Alice",
        title: "Long topic",
        message: "Hello",
        trip: false,
        replyCount: 11,
        pinned: false,
        locked: false,
        digest: false,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:30:00"
      }
    ]);

    expect(html).toContain('<a href="/bbs.php?view=1">1</a>');
    expect(html).toContain('<a href="/bbs.php?view=1&page=2" title="Long topic">');
  });

  it("renders BBS topic detail with replies", () => {
    const html = renderBbsTopic(
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic [b]body[/b]\n[color=#cc0000]red[/color]\n[url]https://example.test/path[/url]\n<script>",
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
          message: "Reply [url]www.example.test[/url]\n[b]body[/b]",
          trip: false,
          createdAt: "2026-05-06 12:10:00"
        }
      ]
    );

    expect(html).toContain("<title>汝等是人是狼？ - Werewolf Cloudflare Port</title>");
    expect(html).toContain('Topic <b>body</b><br /><font color="#cc0000">red</font><br /><a href="https://example.test/path" target="_blank">https://example.test/path</a><br />&lt;script&gt;');
    expect(html).toContain("文章列表");
    expect(html).toContain('<div id="table5">');
    expect(html).toContain('<table border="1" class="table1" width="100%" align="center">');
    expect(html).toContain('<td class="table3"><b>Welcome</b><br>Alice◆Trip</td>');
    expect(html).toContain('<td class="table2"><a href="/bbs.php?go=edit&amp;id=1">NO.1</a> &lt;..&gt; [2026-05-06 12:00:00]</td>');
    expect(html).toContain('<table class="table1" style="width: 600px" align="right">');
    expect(html).toContain("Bob");
    expect(html).toContain('Reply <a href="http://www.example.test" target="_blank">www.example.test</a><br /><b>body</b>');
    expect(html).toContain('<td class="table3">Bob</td>');
    expect(html).toContain('<td class="table2"><a href="/bbs.php?go=edit&amp;id=1">NO.1</a> &lt;..&gt; [2026-05-06 12:10:00]</td>');
    expect(html).toContain('form name="bbs" method="post" action="/bbs.php?go=postre"');
    expect(html).toContain('type="text" name="bname" maxlength="32" size="24"');
    expect(html).toContain('type="password" name="bpass" maxlength="128" size="24"');
    expect(html).toContain('name="mess"');
    expect(html).toContain('type="hidden" name="id" value="1"');
    expect(html).toContain('id="submit" name="submit" type="submit" value="回覆"');
    expect(html).toContain("/api/bbs/topics/1/replies");
    expect(html).toContain("bbsReplyPassword");
    expect(html).toContain('password: document.querySelector("#bbsReplyPassword").value');
    expect(html).toContain("replyPage");
    expect(html).toContain('&page=" + encodeURIComponent(String(replyPage))');
    expect(html).toContain("bbsReplyDeleteButton");
    expect(html).toContain("bbsReplyEditButton");
    expect(html).toContain("bbsReplyEditMessage");
    expect(html).toContain("bbsReplyEditPassword");
    expect(html).toContain("回覆密碼");
    expect(html).toContain("passwordInput ? passwordInput.value");
    expect(html).toContain('body: JSON.stringify({ password: passwordInput ? passwordInput.value : "" })');
    expect(html).toContain("/replies/\" + encodeURIComponent(replyId) + \"/moderation");
    expect(html).toContain("刪除此回覆？");
    expect(html).toContain("狀態");
    expect(html).toContain('<span class="bbs-status-mark">一般</span>');
    expect(html).toContain("主題管理");
    expect(html).toContain('form name="bbs" method="post" action="/bbs.php?go=edit&amp;id=1"');
    expect(html).toContain('name="editis"');
    expect(html).toContain('<option value="del">刪除</option>');
    expect(html).toContain('<option value="edit" selected>編輯</option>');
    expect(html).toContain('<option value="todige">加精華</option>');
    expect(html).toContain('type="password" name="password" maxlength="128" size="24" value=""');
    expect(html).toContain('id="submit" name="submit" type="submit" value="送出"');
    expect(html).toContain("bbsAdminToken");
    expect(html).toContain("werewolf_cf_bbs_admin_token");
    expect(html).toContain("/api/bbs/topics/1/moderation");
    expect(html).toContain("/api/bbs/topics/1/content");
    expect(html).toContain("bbsTopicEditButton");
    expect(html).toContain("bbsEditTitle");
    expect(html).toContain("bbsEditMessage");
    expect(html).toContain("bbsEditPassword");
    expect(html).toContain("一般使用者編輯/刪除用");
    expect(html).toContain('password: document.querySelector("#bbsEditPassword").value');
    expect(html).toContain('body: JSON.stringify({ password: document.querySelector("#bbsEditPassword").value })');
    expect(html).toContain('"x-bbs-admin-token": token');
    expect(html).toContain("bbsModeratePinned");
    expect(html).toContain("bbsModerateLocked");
    expect(html).toContain("bbsModerateDigest");
    expect(html).toContain("bbsDeleteButton");
    expect(html).toContain('method: "DELETE"');
    expect(html).toContain("刪除此主題與所有回覆？");
    expect(html).toContain('location.href = "/bbs.php";');
    expect(html).toContain('<a href="/bbs.php?go=postre&amp;id=1">回覆主題</a> <a href="/bbs.php">回列表</a>');
    expect(html).not.toContain('<p><a href="/bbs.php?go=postre&amp;id=1">回覆主題</a> <a href="/bbs.php">回列表</a></p>');
  });

  it("renders BBS reply pagination links", () => {
    const html = renderBbsTopic(
      {
        id: 1,
        name: "Alice",
        title: "Welcome",
        message: "Topic body",
        trip: false,
        replyCount: 11,
        pinned: false,
        locked: false,
        digest: false,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:10:00"
      },
      [],
      { page: 2, pageSize: 10, totalReplies: 11 }
    );

    expect(html).toContain("bbs-pagination");
    expect(html).toContain('<a href="/bbs.php?view=1&page=1">[1]</a>');
    expect(html).toContain("<strong>[2]</strong>");
  });

  it("renders locked BBS topics without an active reply form", () => {
    const html = renderBbsTopic(
      {
        id: 1,
        name: "Alice",
        title: "Locked topic",
        message: "Topic body",
        trip: false,
        replyCount: 0,
        pinned: false,
        locked: true,
        digest: false,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:00:00"
      },
      []
    );

    expect(html).toContain("此主題已鎖定。");
    expect(html).toContain("bbs-topic-locked");
    expect(html).not.toContain("bbsReplyName");
    expect(html).not.toContain("bbsReplyMessage");
    expect(html).not.toContain("bbsReplyPassword");
    expect(html).not.toContain("bbsReplyButton");
  });

  it("renders BBS admin index", () => {
    const topics = [
      {
        id: 1,
        name: "Alice",
        title: "<Welcome>",
        message: "Hello",
        trip: true,
        replyCount: 2,
        pinned: true,
        locked: false,
        digest: true,
        createdAt: "2026-05-06 12:00:00",
        updatedAt: "2026-05-06 12:30:00"
      }
    ];
    const html = renderBbsAdmin(topics);

    expect(html).toContain("討論管理");
    expect(html).toContain("&lt;Welcome&gt;");
    expect(html).toContain("Alice◆Trip");
    expect(html).toContain("bbs-topic-pinned");
    expect(html).toContain("bbs-topic-digest");
    expect(html).toContain("/bbs.php?view=1#bbsModerationForm");
    expect(html).toContain("BBS 管理密碼");

    const paginated = renderBbsAdmin(topics, { page: 2, pageSize: 15, totalTopics: 31 });
    expect(paginated).toContain("bbs-pagination");
    expect(paginated).toContain('<a href="/admin.php?go=bbs&page=1">[1]</a>');
    expect(paginated).toContain("<strong>[2]</strong>");
    expect(paginated).toContain('<a href="/admin.php?go=bbs&page=3">[3]</a>');
  });

  it("renders room records as a normal HTML page", () => {
    const html = renderRoomRecords("room_abc", [
      {
        id: 1,
        roomId: "room_abc",
        result: {
          winner: "werewolves",
          day: 2,
          players: [
            { playerId: "player_a", nickname: "Alice", role: "seer", alive: false },
            { playerId: "player_b", nickname: "Bob", role: "werewolf", alive: true }
          ]
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("村子對局紀錄");
    expect(html).toContain('<a href="/old_log.php">←返回</a>');
    expect(html).toContain("background-image:url('/assets/reference/img/old_log_bg.jpg')");
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"><br>');
    expect(html).toContain("/game_view.php?room_no=room_abc");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc");
    expect(html).toContain("/game_log.php?room_no=room_abc&amp;log_mode=on");
    expect(html).toContain("old_log.php</a> / <a href=\"/game_log.php?room_no=room_abc&amp;log_mode=on\">game_log.php</a>");
    expect(html).toContain("人狼勝利");
    expect(html).toContain("/assets/reference/img/victory_role_wolf.gif");
    expect(html).toContain("第 2 日");
    expect(html).toContain("2 人");
    expect(html).toContain("Alice (player_a)");
    expect(html).toContain("/assets/reference/img/role_mage.gif");
    expect(html).toContain("Bob (player_b)");
    expect(html).toContain("/assets/reference/img/role_wolf.gif");
    expect(html).toContain("死亡");
  });

  it("renders draw winners in room records with reference victory assets", () => {
    const html = renderRoomRecords("room_draw", [
      {
        id: 1,
        roomId: "room_draw",
        result: {
          winner: "draw",
          day: 4,
          players: []
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ]);

    expect(html).toContain("平手勝利");
    expect(html).toContain("/assets/reference/img/victory_role_draw.gif");
    expect(html).not.toContain("未定勝利");
  });

  it("preserves old log return state on room records and events pages", () => {
    const records = renderRoomRecords("room_abc", [], { oldLogReturnHref: "/old_log.php?search=Alpha%20%26%20Beta&page=2" });
    expect(records).toContain('<a href="/old_log.php?search=Alpha%20%26%20Beta&amp;page=2">←返回</a>');

    const events = renderRoomEvents("room_abc", [], { oldLogReturnHref: "/old_log.php?all=1" });
    expect(events).toContain('<a href="/old_log.php?all=1">←返回</a>');
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
    expect(html).toContain('<a href="/old_log.php">←返回</a>');
    expect(html).toContain("background-image:url('/assets/reference/img/old_log_bg.jpg')");
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"><br>');
    expect(html).toContain("/game_view.php?room_no=room_abc");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc");
    expect(html).toContain("/game_log.php?room_no=room_abc&amp;log_mode=on");
    expect(html).toContain('class="transcript-table" border="0" cellspacing="0" cellpadding="2" style="margin:12px 20px 18px;"');
    expect(html).toContain('<td class="transcript-time-cell"><strong>時間</strong></td><td class="transcript-type-cell"><strong>事件</strong></td><td class="transcript-speaker-cell"><strong>玩家</strong></td><td class="transcript-payload-cell"><strong>內容</strong></td>');
    expect(html).toContain('class="transcript-row transcript-location-game"');
    expect(html).toContain('<td class="transcript-speaker-cell"><span class="transcript-speaker-marker">◆</span>player_a</td>');
    expect(html).toContain("遊戲開始");
    expect(html).not.toContain(">game_started<");
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
          id: 7,
          roomId: "room_abc",
          playerId: "player_c",
          eventType: "day_vote",
          payload: { visibility: "private", nickname: "Carol", targetPlayerId: "player_b", targetNickname: "Bob", phase: "day", day: 2, revoteCount: 1 },
          createdAt: "2026-05-06 12:02:30"
        },
        {
          id: 8,
          roomId: "room_abc",
          playerId: "player_d",
          eventType: "day_vote",
          payload: { visibility: "private", nickname: "Dave", targetPlayerId: "player_a", targetNickname: "Alice", phase: "day", day: 2, revoteCount: 1 },
          createdAt: "2026-05-06 12:02:45"
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
        },
        {
          id: 9,
          roomId: "room_abc",
          playerId: "player_a",
          eventType: "room_end_requested",
          payload: { nickname: "Alice", phase: "day", day: 2 },
          createdAt: "2026-05-06 12:07:00"
        }
      ]
    );

    expect(html).toContain("村子完整紀錄");
    expect(html).toContain("background-image:url('/assets/reference/img/old_log_bg.jpg')");
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/old_log_title.jpg" alt="過去紀錄"><br>');
    expect(html).toContain("/game_view.php?room_no=room_abc");
    expect(html).toContain("村民勝利");
    expect(html).toContain("/assets/reference/img/victory_role_human.gif");
    expect(html).toContain("Alice (player_a)");
    expect(html).toContain("占卜師");
    expect(html).toContain("/assets/reference/img/role_mage.gif");
    expect(html).toContain("Bob (player_b)");
    expect(html).toContain("/assets/reference/img/role_wolf.gif");
    expect(html).toContain("死亡");
    expect(html).toContain("遊戲開始");
    expect(html).toContain("第1日");
    expect(html).toContain("第 2 日 白天");
    expect(html).toContain("白天投票");
    expect(html).toContain("投票紀錄");
    expect(html).toContain("第 2 日 再投票 1");
    expect(html).toContain("2 日目 ( 2 回目)");
    expect(html).toContain("投票回合:2");
    expect(html).toContain("得票：Bob：2票　Alice：1票");
    expect(html).toContain("vote-table");
    expect(html).toContain('class="vote-table" border="1" cellspacing="0" cellpadding="2" style="font-size:12pt;"');
    expect(html).toContain('colspan="4" align="center"');
    expect(html).toContain("vote-round-header");
    expect(html).toContain("vote-total-row");
    expect(html).toContain("vote-ballot-row");
    expect(html).toContain(".vote-table { border-collapse: collapse; background: transparent; }");
    expect(html).not.toContain("<strong>投票者</strong>");
    expect(html).toContain('<td align="left"><strong>Alice</strong></td>\n        <td>1票</td>\n        <td>投票給 2 票 →</td>\n        <td><strong> Bob </strong></td>');
    expect(html).toContain('<td align="left"><strong>Carol</strong></td>\n        <td>0票</td>\n        <td>投票給 2 票 →</td>\n        <td><strong> Bob </strong></td>');
    expect(html).toContain('<td align="left"><strong>Dave</strong></td>\n        <td>0票</td>\n        <td>投票給 1 票 →</td>\n        <td><strong> Alice </strong></td>');
    expect(html).toContain("第 2 日 夜晚");
    expect(html).toContain('class="transcript-table" border="0" cellspacing="0" cellpadding="2" style="margin:12px 20px 18px;"');
    expect(html).toContain('<td class="transcript-time-cell"><strong>時間</strong></td><td class="transcript-location-cell"><strong>位置</strong></td><td class="transcript-type-cell"><strong>種類</strong></td><td class="transcript-speaker-cell"><strong>發言/行動</strong></td><td class="transcript-payload-cell"><strong>內容</strong></td>');
    expect(html).toContain('class="transcript-day-heading"><td colspan="5">第 2 日 夜晚</td></tr>');
    expect(html).toContain(".transcript-table { width: 100%; border-collapse: collapse; font-size: 12pt; }");
    expect(html).toContain(".transcript-time-cell { width: 9em; white-space: nowrap; }");
    expect(html).toContain(".transcript-payload-cell { overflow-wrap: anywhere; word-break: break-word; }");
    expect(html).toContain(".transcript-speaker-marker { color: #666666; margin-right: 2px; }");
    expect(html).toContain(".transcript-day-heading td { background: #eeeeee; color: #000000; font-weight: bold; }");
    expect(html).toContain("襲擊");
    expect(html).toContain("位置");
    expect(html).toContain("襲擊行動");
    expect(html).toContain("人狼密談");
    expect(html).toContain("GM密語");
    expect(html).toContain("自言自語");
    expect(html).toContain("Alice <small>的自言自語</small>");
    expect(html).toContain("GM → ???");
    expect(html).toContain("要求廢村");
    expect(html).toContain("發言:Alice");
    expect(html).toContain('class="transcript-row transcript-location-kill"');
    expect(html).toContain('<td class="transcript-location-cell"><span class="location-badge">襲擊行動</span></td>');
    expect(html).toContain('<td class="transcript-type-cell">襲擊</td>');
    expect(html).toContain('<td class="transcript-speaker-cell"><span class="transcript-speaker-marker">◆</span>Bob</td>');
    expect(html).toContain('<td class="transcript-payload-cell">發言:Bob　第2日　對象:player_a　對象名:Alice');
    expect(html).toContain('class="transcript-row transcript-location-wolf"');
    expect(html).toContain('class="transcript-row transcript-location-gm-whisper"');
    expect(html).toContain('class="transcript-row transcript-location-self"');
    expect(html).toContain('class="transcript-row transcript-location-system"');
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
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_common_voice",
        payload: { enabled: true, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      },
      {
        id: 5,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_channel_restrictions",
        payload: { restrictions: { wolf: true, common: false, lovers: false, fox: true }, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:05:00"
      }
    ];

    const normal = renderRoomTranscript("room_abc", [], events);
    expect(normal).toContain("通常");
    expect(normal).toContain("howl");
    expect(normal).toContain("GM 共有公開調整");
    expect(normal).toContain("GM 頻道限制調整");
    expect(normal).toContain('class="transcript-row transcript-location-gm"');
    expect(normal).not.toContain("內容:heaven");

    const withHeaven = renderRoomTranscript("room_abc", [], events, { heavenTalk: true });
    expect(withHeaven).toContain("含靈界");
    expect(withHeaven).toContain("heaven");
    expect(withHeaven).toContain("howl");

    const heavenOnly = renderRoomTranscript("room_abc", [], events, { heavenOnly: true });
    expect(heavenOnly).toContain("逝者靈界");
    expect(heavenOnly).toContain("遊戲開始");
    expect(heavenOnly).toContain("heaven");
    expect(heavenOnly).toContain("GM 共有公開調整");
    expect(heavenOnly).toContain("GM 頻道限制調整");
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
      },
      {
        id: 5,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_whisper",
        payload: { visibility: "private", nickname: "GM", targetPlayerId: "player_wolf", targetNickname: "Wolf", text: "secret for wolf", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:05:00"
      },
      {
        id: 6,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_whisper",
        payload: { visibility: "private", nickname: "GM", targetPlayerId: "player_seer", targetNickname: "Seer", text: "secret for seer", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:06:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenTalk: true });
    expect(publicView).toContain("旁觀");
    expect(publicView).toContain("遊戲開始");
    expect(publicView).not.toContain("內容:howl");
    expect(publicView).not.toContain("內容:heaven");
    expect(publicView).not.toContain("內容:mutter");

    const playerView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "player_wolf", heavenTalk: true });
    expect(playerView).toContain("玩家 Wolf (player_wolf)");
    expect(playerView).toContain("玩家視點");
    expect(playerView).toContain("可見範圍");
    expect(playerView).toContain("顯示 Wolf (player_wolf) 的私人發言/行動、可聽見的同陣營密談與指向該玩家的GM密語");
    expect(playerView).toContain('<option value="player_wolf" selected>Wolf (player_wolf)</option>');
    expect(playerView).toContain("/room/room_abc/log?heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(playerView).toContain("howl");
    expect(playerView).toContain("secret for wolf");
    expect(playerView).toContain("GM → Wolf");
    expect(playerView).not.toContain("內容:heaven");
    expect(playerView).not.toContain("內容:mutter");
    expect(playerView).not.toContain("secret for seer");

    const deadView = renderRoomTranscript("room_abc", [], events, { viewerMode: "dead", heavenTalk: true });
    expect(deadView).toContain("靈界");
    expect(deadView).toContain("顯示公開、系統與靈界紀錄");
    expect(deadView).toContain("heaven");
    expect(deadView).not.toContain("內容:howl");
    expect(deadView).not.toContain("內容:mutter");

    const gmView = renderRoomTranscript("room_abc", [], events, { viewerMode: "gm", heavenTalk: true });
    expect(gmView).toContain("GM");
    expect(gmView).toContain("顯示全部保存紀錄");
    expect(gmView).toContain("howl");
    expect(gmView).toContain("heaven");
    expect(gmView).toContain("mutter");
  });

  it("preserves public vote tables while hiding non-open vote counts", () => {
    const privateVotes = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "day_vote",
        payload: { visibility: "private", nickname: "Alice", targetPlayerId: "player_b", targetNickname: "Bob", phase: "day", day: 2, revoteCount: 0 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_c",
        eventType: "day_vote",
        payload: { visibility: "private", nickname: "Carol", targetPlayerId: "player_b", targetNickname: "Bob", phase: "day", day: 2, revoteCount: 0 },
        createdAt: "2026-05-06 12:02:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], privateVotes, { viewerMode: "public" });
    expect(publicView).toContain("得票：非公開");
    expect(publicView).toContain("投票給→");
    expect(publicView).toContain("<strong> Bob </strong>");
    expect(publicView).not.toContain("投票給 2 票 →");
    expect(publicView).not.toContain("白天投票</td>");

    const gmView = renderRoomTranscript("room_abc", [], privateVotes, { viewerMode: "gm" });
    expect(gmView).toContain("得票：Bob：2票");
    expect(gmView).toContain("投票給 2 票 →");

    const openVotePublicView = renderRoomTranscript("room_abc", [], privateVotes.map((event) => ({
      ...event,
      payload: { ...(event.payload as Record<string, unknown>), visibility: "public" }
    })), { viewerMode: "public" });
    expect(openVotePublicView).toContain("得票：Bob：2票");
    expect(openVotePublicView).toContain("投票給 2 票 →");
    expect(openVotePublicView).toContain("白天投票</td>");
  });

  it("does not treat private transcript rows without player ids as system-visible rows", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "missing player id secret", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "game_started",
        payload: { day: 1, players: 4 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "public_chat",
        payload: { nickname: "System", text: "public import row", phase: "day", day: 1 },
        createdAt: "2026-05-06 12:03:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenTalk: true });
    expect(publicView).toContain("遊戲開始");
    expect(publicView).toContain("public import row");
    expect(publicView).not.toContain("missing player id secret");

    const deadView = renderRoomTranscript("room_abc", [], events, { viewerMode: "dead", heavenTalk: true });
    expect(deadView).toContain("遊戲開始");
    expect(deadView).not.toContain("missing player id secret");

    const heavenOnly = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenOnly: true });
    expect(heavenOnly).toContain("遊戲開始");
    expect(heavenOnly).not.toContain("missing player id secret");
  });

  it("renders join event labels and payload details in transcripts", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "player_joined",
        payload: { trip: true, gm: false },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_joined",
        payload: { trip: false, gm: true },
        createdAt: "2026-05-06 12:02:00"
      }
    ], { viewerMode: "public" });

    expect(html).toContain("玩家登錄");
    expect(html).toContain("GM 登錄");
    expect(html).toContain("Trip:有　GM:否");
    expect(html).toContain("Trip:無　GM:是");
    expect(html).toContain('class="transcript-row transcript-location-system"');
    expect(html).not.toContain(">player_joined<");
    expect(html).not.toContain(">gm_joined<");
  });

  it("renders room-created capacity details in transcript payloads", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_host",
        eventType: "room_created",
        payload: { name: "測試村", comment: "歡迎", maxPlayers: 22 },
        createdAt: "2026-05-06 12:01:00"
      }
    ], { viewerMode: "public" });

    expect(html).toContain("村子建立");
    expect(html).toContain("村名:測試村");
    expect(html).toContain("說明:歡迎");
    expect(html).toContain("定員:22人");
    expect(html).toContain('class="transcript-row transcript-location-system"');
  });

  it("renders admin room-ended events as localized system transcript rows", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "admin_room_ended",
        payload: { status: "ended" },
        createdAt: "2026-05-06 12:01:00"
      }
    ], { viewerMode: "public" });

    expect(html).toContain("管理廢村");
    expect(html).toContain("狀態:已結束");
    expect(html).toContain('class="transcript-row transcript-location-system"');
    expect(html).not.toContain(">admin_room_ended<");
  });

  it("uses payload actor ids for player-view ownership without making private rows public", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "divination",
        payload: {
          visibility: "private",
          playerId: "player_seer",
          nickname: "Seer",
          targetPlayerId: "player_wolf",
          targetNickname: "Wolf",
          result: "werewolf",
          phase: "night",
          day: 2
        },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "guard",
        payload: {
          visibility: "private",
          actorPlayerId: "player_guard",
          nickname: "Guard",
          targetPlayerId: "player_target",
          targetNickname: "Target",
          phase: "night",
          day: 2
        },
        createdAt: "2026-05-06 12:02:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenTalk: true });
    expect(publicView).not.toContain("結果:狼");
    expect(publicView).not.toContain("護衛行動");

    const seerView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "player_seer", heavenTalk: true });
    expect(seerView).toContain("Seer (player_seer)");
    expect(seerView).toContain("結果:狼");
    expect(seerView).not.toContain("護衛行動");

    const guardView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "player_guard", heavenTalk: true });
    expect(guardView).toContain("Guard (player_guard)");
    expect(guardView).toContain("護衛行動");
    expect(guardView).not.toContain("結果:狼");
  });

  it("shows player-view private channel rows the selected role could hear", () => {
    const records = [
      {
        id: 1,
        roomId: "room_abc",
        result: {
          winner: "villagers",
          day: 3,
          players: [
            { playerId: "player_wolf_a", nickname: "Wolf A", role: "werewolf", alive: true },
            { playerId: "player_wolf_b", nickname: "Wolf B", role: "big_wolf", alive: true },
            { playerId: "player_fox_a", nickname: "Fox A", role: "fox", alive: true },
            { playerId: "player_fox_b", nickname: "Fox B", role: "fox", alive: true },
            { playerId: "player_common_a", nickname: "Common A", role: "common", alive: true },
            { playerId: "player_common_b", nickname: "Common B", role: "common", alive: true },
            { playerId: "player_lover_a", nickname: "Lover A", role: "villager", alive: true, lover: true },
            { playerId: "player_lover_b", nickname: "Lover B", role: "seer", alive: true, lover: true },
            { playerId: "player_seer", nickname: "Seer", role: "seer", alive: true }
          ]
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ];
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_wolf_b",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf B", text: "pack message", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_fox_b",
        eventType: "fox_chat",
        payload: { visibility: "private", nickname: "Fox B", text: "fox message", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_common_b",
        eventType: "common_chat",
        payload: { visibility: "private", nickname: "Common B", text: "common message", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_lover_b",
        eventType: "lovers_chat",
        payload: { visibility: "private", nickname: "Lover B", text: "lover message", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      }
    ];

    const wolfView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_wolf_a", heavenTalk: true });
    expect(wolfView).toContain("pack message");
    expect(wolfView).not.toContain("fox message");
    expect(wolfView).not.toContain("common message");
    expect(wolfView).not.toContain("lover message");

    const foxView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_fox_a", heavenTalk: true });
    expect(foxView).toContain("fox message");
    expect(foxView).not.toContain("pack message");
    expect(foxView).not.toContain("common message");

    const commonView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_common_a", heavenTalk: true });
    expect(commonView).toContain("common message");
    expect(commonView).not.toContain("pack message");
    expect(commonView).not.toContain("fox message");

    const loverView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_lover_a", heavenTalk: true });
    expect(loverView).toContain("lover message");
    expect(loverView).not.toContain("pack message");
    expect(loverView).not.toContain("fox message");

    const seerView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_seer", heavenTalk: true });
    expect(seerView).not.toContain("pack message");
    expect(seerView).not.toContain("fox message");
    expect(seerView).not.toContain("common message");
    expect(seerView).not.toContain("lover message");
    expect(seerView).toContain("可聽見的同陣營密談");
  });

  it("does not show fox talk to child fox player views", () => {
    const records = [
      {
        id: 1,
        roomId: "room_abc",
        result: {
          winner: "foxes",
          day: 3,
          players: [
            { playerId: "player_fox", nickname: "Fox", role: "fox", alive: true },
            { playerId: "player_child_fox", nickname: "Child Fox", role: "child_fox", alive: true }
          ]
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ];
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_fox",
        eventType: "fox_chat",
        payload: { visibility: "private", nickname: "Fox", text: "fox private talk", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      }
    ];

    const foxView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_fox", heavenTalk: true });
    expect(foxView).toContain("fox private talk");

    const childFoxView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_child_fox", heavenTalk: true });
    expect(childFoxView).not.toContain("fox private talk");
  });

  it("infers player-view channel visibility from event payload roles when records are missing", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "viewer_wolf",
        eventType: "public_chat",
        payload: { nickname: "Viewer Wolf", role: "wolf wfbig", text: "hello", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "other_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Other Wolf", text: "pack imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "other_fox",
        eventType: "fox_chat",
        payload: { visibility: "private", nickname: "Other Fox", text: "fox imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ];

    const wolfView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "viewer_wolf", heavenTalk: true });
    expect(wolfView).toContain("Viewer Wolf (viewer_wolf)");
    expect(wolfView).toContain("pack imported");
    expect(wolfView).not.toContain("fox imported");
  });

  it("does not infer fox talk visibility from saved child-fox PHP roles", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "viewer_child_fox",
        eventType: "public_chat",
        payload: { nickname: "Viewer Child Fox", role: "fosi", text: "hello", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "other_fox",
        eventType: "fox_chat",
        payload: { visibility: "private", nickname: "Other Fox", text: "fox imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      }
    ];

    const childFoxView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "viewer_child_fox", heavenTalk: true });
    expect(childFoxView).toContain("Viewer Child Fox (viewer_child_fox)");
    expect(childFoxView).not.toContain("fox imported");
  });

  it("infers lovers transcript visibility from saved PHP role strings", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "viewer_lover",
        eventType: "public_chat",
        payload: { nickname: "Viewer Lover", role: "human lovers", text: "hello", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "other_lover",
        eventType: "lovers_chat",
        payload: { visibility: "private", nickname: "Other Lover", text: "lover imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "other_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Other Wolf", text: "pack imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ];

    const loverView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "viewer_lover", heavenTalk: true });
    expect(loverView).toContain("Viewer Lover (viewer_lover)");
    expect(loverView).toContain("lover imported");
    expect(loverView).not.toContain("pack imported");
  });

  it("infers common transcript visibility from saved PHP role strings", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "viewer_common",
        eventType: "public_chat",
        payload: { nickname: "Viewer Common", role: "common lovers", text: "hello", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "other_common",
        eventType: "common_chat",
        payload: { visibility: "private", nickname: "Other Common", text: "common imported", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "viewer_villager",
        eventType: "public_chat",
        payload: { nickname: "Viewer Villager", role: "human", text: "hi", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ];

    const commonView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "viewer_common", heavenTalk: true });
    expect(commonView).toContain("Viewer Common (viewer_common)");
    expect(commonView).toContain("common imported");

    const villagerView = renderRoomTranscript("room_abc", [], events, { viewerMode: "player", viewerPlayerId: "viewer_villager", heavenTalk: true });
    expect(villagerView).not.toContain("common imported");
  });

  it("uses saved record PHP lover role strings for player-view channel visibility", () => {
    const records = [
      {
        id: 1,
        roomId: "room_abc",
        result: {
          winner: "lovers",
          day: 3,
          players: [
            { playerId: "viewer_lover", nickname: "Viewer Lover", role: "human lovers", alive: true },
            { playerId: "plain_villager", nickname: "Plain Villager", role: "human", alive: true },
            { playerId: "wolf_lover", nickname: "Wolf Lover", role: "wolf lovers", alive: true }
          ]
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ];
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "wolf_lover",
        eventType: "lovers_chat",
        payload: { visibility: "private", nickname: "Wolf Lover", text: "record lover talk", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "wolf_lover",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf Lover", text: "record composite lover talk", location: "night wolf lovers", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      }
    ];

    const loverView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "viewer_lover", heavenTalk: true });
    expect(loverView).toContain("record lover talk");
    expect(loverView).toContain("record composite lover talk");

    const villagerView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "plain_villager", heavenTalk: true });
    expect(villagerView).not.toContain("record lover talk");
    expect(villagerView).not.toContain("record composite lover talk");
  });

  it("shows composite wolf or fox lover transcript rows to lover player views", () => {
    const records = [
      {
        id: 1,
        roomId: "room_abc",
        result: {
          winner: "villagers",
          day: 3,
          players: [
            { playerId: "player_lover", nickname: "Lover", role: "villager", alive: true, lover: true },
            { playerId: "player_villager", nickname: "Villager", role: "villager", alive: true },
            { playerId: "player_wolf", nickname: "Wolf", role: "werewolf", alive: true, lover: true },
            { playerId: "player_fox", nickname: "Fox", role: "fox", alive: true, lover: true }
          ]
        },
        createdAt: "2026-05-06 12:00:00"
      }
    ];
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "wolf lover message", location: "night wolf lovers", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_fox",
        eventType: "fox_chat",
        payload: { visibility: "private", nickname: "Fox", text: "fox lover message", location: "night fox lovers", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "pack only message", location: "night wolf", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      }
    ];

    const loverView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_lover", heavenTalk: true });
    expect(loverView).toContain("wolf lover message");
    expect(loverView).toContain("fox lover message");
    expect(loverView).toContain("人狼/戀人密談");
    expect(loverView).toContain("妖狐/戀人密談");
    expect(loverView).toContain('class="transcript-row transcript-location-wolf-lovers"');
    expect(loverView).toContain('class="transcript-row transcript-location-fox-lovers"');
    expect(loverView).not.toContain("pack only message");

    const villagerView = renderRoomTranscript("room_abc", records, events, { viewerMode: "player", viewerPlayerId: "player_villager", heavenTalk: true });
    expect(villagerView).not.toContain("wolf lover message");
    expect(villagerView).not.toContain("fox lover message");
  });

  it("uses saved PHP talk locations for transcript labels", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_common",
        eventType: "self_talk",
        payload: { visibility: "private", nickname: "Common", text: "blocked common fallback", location: "night self_talk", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_lover",
        eventType: "lovers_chat",
        payload: { visibility: "private", nickname: "Lover", text: "fallback lovers", location: "night lovers", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_common",
        eventType: "common_chat",
        payload: { visibility: "private", nickname: "Common", text: "common room", location: "night common", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ]);

    expect(html).toContain("夜晚自言自語");
    expect(html).toContain("戀人密談");
    expect(html).toContain("共有密談");
    expect(html).toContain('class="transcript-row transcript-location-self"');
    expect(html).toContain('class="transcript-row transcript-location-lovers"');
    expect(html).toContain('class="transcript-row transcript-location-common"');
    expect(html).toContain("blocked common fallback");
    expect(html).toContain("fallback lovers");
    expect(html).toContain("common room");
  });

  it("treats saved PHP heaven talk locations as heaven transcript rows", () => {
    const events = [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_dead",
        eventType: "public_chat",
        payload: { visibility: "private", nickname: "Dead", text: "legacy heaven row", location: "heaven", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_alive",
        eventType: "public_chat",
        payload: { nickname: "Alive", text: "ground row", location: "day public", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      }
    ];

    const publicView = renderRoomTranscript("room_abc", [], events, { viewerMode: "public", heavenTalk: true });
    expect(publicView).not.toContain("legacy heaven row");

    const deadView = renderRoomTranscript("room_abc", [], events, { viewerMode: "dead", heavenTalk: true });
    expect(deadView).toContain("legacy heaven row");
    expect(deadView).toContain('class="transcript-row transcript-location-dead"');

    const heavenOnly = renderRoomTranscript("room_abc", [], events, { viewerMode: "dead", heavenOnly: true });
    expect(heavenOnly).toContain("legacy heaven row");
    expect(heavenOnly).not.toContain("ground row");
  });

  it("uses saved PHP system talk locations for transcript labels", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "public_chat",
        payload: { nickname: "Alice", text: "kick vote", location: "beforegame system", phase: "lobby", day: 0 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_b",
        eventType: "public_chat",
        payload: { nickname: "Bob", text: "vote action", location: "day system", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_c",
        eventType: "public_chat",
        payload: { nickname: "Carol", text: "night action", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      }
    ]);

    expect(html).toContain("等待室系統");
    expect(html).toContain("白天系統");
    expect(html).toContain("夜晚系統");
    expect(html).toContain('class="transcript-row transcript-location-system"');
    expect(html).toContain("kick vote");
    expect(html).toContain("vote action");
    expect(html).toContain("night action");
  });

  it("localizes saved PHP system talk payload codes", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "public_chat",
        payload: { nickname: "Alice", text: "KICK_DO\tBob", location: "beforegame system", phase: "lobby", day: 0 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_b",
        eventType: "public_chat",
        payload: { nickname: "Bob", text: "VOTE_DO\tCarol", location: "day system", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "public_chat",
        payload: { nickname: "Wolf", text: "WOLF_EAT\tDave", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_cat",
        eventType: "public_chat",
        payload: { nickname: "Cat", text: "CAT_DO\tEve", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      },
      {
        id: 5,
        roomId: "room_abc",
        playerId: "player_host",
        eventType: "public_chat",
        payload: { nickname: "Host", text: "FKICK_DO\tFrank", location: "beforegame system", phase: "lobby", day: 0 },
        createdAt: "2026-05-06 12:05:00"
      },
      {
        id: 6,
        roomId: "room_abc",
        playerId: "player_seer",
        eventType: "public_chat",
        payload: { nickname: "Seer", text: "MAGE_DO\tGrace", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:06:00"
      },
      {
        id: 7,
        roomId: "room_abc",
        playerId: "player_fosi",
        eventType: "public_chat",
        payload: { nickname: "Child", text: "FOSI_DO\tHeidi", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:07:00"
      },
      {
        id: 8,
        roomId: "room_abc",
        playerId: "player_guard",
        eventType: "public_chat",
        payload: { nickname: "Guard", text: "GUARD_DO\tIvan", location: "night system", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:08:00"
      },
      {
        id: 9,
        roomId: "room_abc",
        playerId: "player_judy",
        eventType: "public_chat",
        payload: { nickname: "Judy", text: "OBJECTION", location: "day system", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:09:00"
      },
      {
        id: 10,
        roomId: "room_abc",
        playerId: "player_mallory",
        eventType: "public_chat",
        payload: { nickname: "Mallory", text: "ROOMEND", location: "day system", phase: "day", day: 2 },
        createdAt: "2026-05-06 12:10:00"
      }
    ]);

    expect(html).toContain("內容:對 Bob 投票踢出");
    expect(html).toContain("內容:將 Carol 投票處死");
    expect(html).toContain("內容:人狼對 Dave 鎖定為目標");
    expect(html).toContain("內容:貓又對 Eve 進行復活");
    expect(html).toContain("內容:村長對 Frank 強制踢出");
    expect(html).toContain("內容:對 Grace 進行占卜");
    expect(html).toContain("內容:子狐對 Heidi 進行占卜");
    expect(html).toContain("內容:對 Ivan 進行護衛");
    expect(html).toContain("內容:表示抗議");
    expect(html).toContain("內容:要求廢村");
    expect(html).not.toContain("內容:KICK_DO");
    expect(html).not.toContain("內容:VOTE_DO");
    expect(html).not.toContain("內容:GUARD_DO");
  });

  it("renders saved GM operation details in transcript payloads", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_alive",
        payload: { targetPlayerId: "player_target", targetNickname: "Target", alive: false, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_flag",
        payload: { targetPlayerId: "player_target", targetNickname: "Target", flag: "lover", enabled: true, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_common_voice",
        payload: { enabled: false, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_set_channel_restrictions",
        payload: { restrictions: { wolf: true, common: false, lovers: true, fox: false }, phase: "night", day: 2 },
        createdAt: "2026-05-06 12:04:00"
      },
      {
        id: 5,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "lovers_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "fallback", sourceChannel: "wolf", location: "night lovers", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:05:00"
      }
    ]);

    expect(html).toContain("GM 生死調整");
    expect(html).toContain("對象:player_target　對象名:Target　生死:死亡");
    expect(html).toContain("GM 旗標調整");
    expect(html).toContain("狀態:開啟　旗標:戀人");
    expect(html).toContain("GM 共有公開調整");
    expect(html).toContain("狀態:關閉");
    expect(html).toContain("GM 頻道限制調整");
    expect(html).toContain("頻道限制:人狼關閉、共有開啟、戀人關閉、妖狐開啟");
    expect(html).toContain("來源頻道:人狼");
  });

  it("renders lobby vote details in transcript payloads", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_a",
        eventType: "lobby_start_vote",
        payload: { nickname: "Alice", votedPlayerIds: ["player_a", "player_b"], required: 8, ready: false },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_b",
        eventType: "lobby_kick_vote",
        payload: { nickname: "Bob", targetPlayerId: "player_target", targetNickname: "Target", votedPlayerIds: ["player_a", "player_b", "player_c", "player_d", "player_e"], required: 5, ready: true },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_b",
        eventType: "player_kicked",
        payload: { targetPlayerId: "player_target", targetNickname: "Target", method: "vote", kickVotes: 5 },
        createdAt: "2026-05-06 12:03:00"
      },
      {
        id: 4,
        roomId: "room_abc",
        playerId: "player_h",
        eventType: "game_started",
        payload: { day: 1, players: 8, startVotes: 8 },
        createdAt: "2026-05-06 12:04:00"
      }
    ]);

    expect(html).toContain("開始投票");
    expect(html).toContain("踢人投票");
    expect(html).toContain("踢出玩家");
    expect(html).toContain("投票數:2　必要:8　成立:否");
    expect(html).toContain("投票數:5　必要:5　成立:是");
    expect(html).toContain("方式:居民投票");
    expect(html).toContain("踢出票:5");
    expect(html).toContain("開始票:8");
  });

  it("renders localized phase and draw labels in transcript payloads", () => {
    const html = renderRoomTranscript(
      "room_draw",
      [
        {
          id: 1,
          roomId: "room_draw",
          result: { winner: "draw", day: 4, players: [] },
          createdAt: "2026-05-06 12:00:00"
        }
      ],
      [
        {
          id: 1,
          roomId: "room_draw",
          playerId: "player_gm",
          eventType: "gm_advanced_phase",
          payload: { phase: "day", day: 2 },
          createdAt: "2026-05-06 12:01:00"
        },
        {
          id: 2,
          roomId: "room_draw",
          playerId: "player_a",
          eventType: "room_end_requested",
          payload: { nickname: "Alice", phase: "ended", day: 4 },
          createdAt: "2026-05-06 12:02:00"
        },
        {
          id: 3,
          roomId: "room_draw",
          playerId: "player_gm",
          eventType: "gm_ended_game",
          payload: { winner: "draw", phase: "ended", day: 4 },
          createdAt: "2026-05-06 12:03:00"
        }
      ]
    );

    expect(html).toContain("平手勝利");
    expect(html).toContain("階段:白天");
    expect(html).toContain("階段:已結束");
    expect(html).toContain("勝利:平手");
    expect(html).not.toContain("階段:day");
    expect(html).not.toContain("階段:ended");
    expect(html).not.toContain("勝利:未定");
  });

  it("renders finalized game-ended rows with localized winner and player counts", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: undefined,
        eventType: "game_ended",
        payload: { winner: "werewolves", day: 5, players: 12 },
        createdAt: "2026-05-06 12:01:00"
      }
    ]);

    expect(html).toContain("遊戲結束");
    expect(html).toContain("勝利:人狼");
    expect(html).toContain("第5日");
    expect(html).toContain("12人");
    expect(html).toContain('class="transcript-row transcript-location-game"');
    expect(html).not.toContain("勝利:werewolves");
    expect(html).not.toContain(">game_ended<");
  });

  it("renders role ability result labels in transcript payloads", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_seer",
        eventType: "divination",
        payload: { visibility: "private", nickname: "Seer", targetPlayerId: "player_wolf", targetNickname: "Wolf", result: "werewolf", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      },
      {
        id: 2,
        roomId: "room_abc",
        playerId: "player_child",
        eventType: "child_fox_divination",
        payload: { visibility: "private", nickname: "Child", targetPlayerId: "player_target", targetNickname: "Target", result: "failed", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:02:00"
      },
      {
        id: 3,
        roomId: "room_abc",
        playerId: "player_medium",
        eventType: "medium_result",
        payload: { visibility: "private", nickname: "Medium", targetPlayerId: "player_big_wolf", targetNickname: "Big Wolf", result: "big_wolf", phase: "day", day: 3 },
        createdAt: "2026-05-06 12:03:00"
      }
    ]);

    expect(html).toContain("占卜行動");
    expect(html).toContain("子狐占卜");
    expect(html).toContain("靈能結果");
    expect(html).not.toContain(">medium_result<");
    expect(html).toContain("結果:狼");
    expect(html).toContain("結果:失敗");
    expect(html).toContain("結果:大狼");
    expect(html).not.toContain("結果:werewolf");
    expect(html).not.toContain("結果:failed");
    expect(html).not.toContain("結果:big_wolf");
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
    expect(html.indexOf("內容:second")).toBeLessThan(html.indexOf("內容:first"));
  });

  it("reverses transcript vote tables with reverse log mode", () => {
    const html = renderRoomTranscript(
      "room_abc",
      [],
      [
        {
          id: 1,
          roomId: "room_abc",
          playerId: "player_a",
          eventType: "day_vote",
          payload: { visibility: "public", nickname: "Alice", targetPlayerId: "player_b", targetNickname: "Bob", phase: "day", day: 2, revoteCount: 0 },
          createdAt: "2026-05-06 12:01:00"
        },
        {
          id: 2,
          roomId: "room_abc",
          playerId: "player_c",
          eventType: "day_vote",
          payload: { visibility: "public", nickname: "Carol", targetPlayerId: "player_d", targetNickname: "Dave", phase: "day", day: 3, revoteCount: 0 },
          createdAt: "2026-05-06 12:02:00"
        },
        {
          id: 3,
          roomId: "room_abc",
          playerId: "player_e",
          eventType: "day_vote",
          payload: { visibility: "public", nickname: "Eve", targetPlayerId: "player_f", targetNickname: "Frank", phase: "day", day: 3, revoteCount: 0 },
          createdAt: "2026-05-06 12:03:00"
        }
      ],
      { reverseLog: true }
    );

    expect(html.indexOf("3 日目 ( 1 回目)")).toBeLessThan(html.indexOf("2 日目 ( 1 回目)"));
    expect(html.indexOf("<strong>Eve</strong>")).toBeLessThan(html.indexOf("<strong>Carol</strong>"));
  });

  it("preserves transcript viewer parameters across old-log display links", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "howl", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      }
    ], {
      viewerMode: "player",
      viewerPlayerId: "player_wolf",
      heavenTalk: true,
      reverseLog: true
    });

    expect(html).toContain("/room/room_abc/log?viewer=player&amp;viewer_player_id=player_wolf");
    expect(html).toContain("/room/room_abc/log?viewer=player&amp;viewer_player_id=player_wolf&amp;reverse_log=on&amp;heaven_talk=on");
    expect(html).toContain("/room/room_abc/log?reverse_log=on&amp;heaven_talk=on&amp;viewer=public");
    expect(html).toContain("/room/room_abc/log?reverse_log=on&amp;heaven_talk=on&amp;viewer=gm");
    expect(html).toContain("PHP視點");
    expect(html).toContain("旁觀：<a href=\"/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=public\">old_log.php</a> / <a href=\"/game_log.php?room_no=room_abc&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=public\">game_log.php</a>");
    expect(html).toContain("靈界：<a href=\"/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=dead\">old_log.php</a> / <a href=\"/game_log.php?room_no=room_abc&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=dead\">game_log.php</a>");
    expect(html).toContain("GM：<a href=\"/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=gm\">old_log.php</a> / <a href=\"/game_log.php?room_no=room_abc&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=gm\">game_log.php</a>");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(html).toContain("/game_log.php?room_no=room_abc&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf");
    expect(html).toContain("Wolf (player_wolf)：<a href=\"/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf\">old_log.php</a> / <a href=\"/game_log.php?room_no=room_abc&amp;log_mode=on&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=player&amp;viewer_player_id=player_wolf\">game_log.php</a>");
    expect(html).toContain('<a href="/old_log.php">←返回</a>');
    expect(html).toContain('<input type="hidden" name="reverse_log" value="on">');
    expect(html).toContain('<input type="hidden" name="heaven_talk" value="on">');
    expect(html).toContain('<option value="player_wolf" selected>Wolf (player_wolf)</option>');
  });

  it("includes transcript target players in player-view selectors", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_gm",
        eventType: "gm_whisper",
        payload: { visibility: "private", nickname: "GM", targetPlayerId: "player_target", targetNickname: "Target", text: "secret", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:01:00"
      }
    ]);

    expect(html).toContain('<option value="player_gm">GM (player_gm)</option>');
    expect(html).toContain('<option value="player_target">Target (player_target)</option>');
    expect(html).toContain("/room/room_abc/log?viewer=player&amp;viewer_player_id=player_target");
    expect(html).toContain("/old_log.php?log_mode=on&amp;room_no=room_abc&amp;viewer=player&amp;viewer_player_id=player_target");
    expect(html).toContain("/game_log.php?room_no=room_abc&amp;log_mode=on&amp;viewer=player&amp;viewer_player_id=player_target");
  });

  it("can render legacy transcript player-view forms for PHP aliases", () => {
    const html = renderRoomTranscript("room_abc", [], [
      {
        id: 1,
        roomId: "room_abc",
        playerId: "player_wolf",
        eventType: "wolf_chat",
        payload: { visibility: "private", nickname: "Wolf", text: "howl", phase: "night", day: 2 },
        createdAt: "2026-05-06 12:00:00"
      }
    ], {
      playerViewFormAction: "/old_log.php",
      playerViewHiddenInputs: { log_mode: "on", room_no: "room_abc" },
      legacyTranscriptPath: "/old_log.php",
      reverseLog: true,
      heavenTalk: true
    });

    expect(html).toContain('<form method="get" action="/old_log.php"');
    expect(html).toContain('<input type="hidden" name="log_mode" value="on">');
    expect(html).toContain('<input type="hidden" name="room_no" value="room_abc">');
    expect(html).toContain('<input type="hidden" name="viewer" value="player">');
    expect(html).toContain('<a href="/old_log.php?log_mode=on&amp;room_no=room_abc">通常</a>');
    expect(html).toContain('<a href="/old_log.php?log_mode=on&amp;room_no=room_abc&amp;reverse_log=on&amp;heaven_talk=on&amp;viewer=gm">GM</a>');
  });

  it("renders implemented rules page", () => {
    const html = renderRules();

    expect(html).toContain("<title>汝等是人是狼？ Werewolf Cloudflare Port 說明</title>");
    expect(html).toContain("基本流程");
    expect(html).toContain("/assets/reference/img/rule_bg.jpg");
    expect(html).toContain('<a href="/index.php">←返回</a><br>');
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/rule_title.jpg" alt="Rules">');
    expect(html).not.toContain('<p><img class="title-img" src="/assets/reference/img/rule_title.jpg" alt="Rules"></p>');
    expect(html).toContain("＜參加遊戲時必須注意的事情＞");
    expect(html).toContain("＜「汝等是人是狼？」的基本規則＞");
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

  it("renders manual page", () => {
    const html = renderManual();

    expect(html).toContain("說明書");
    expect(html).toContain("建立村子");
    expect(html).toContain("登錄入村");
    expect(html).toContain("GM操作");
    expect(html).toContain("/old_log.php");
    expect(html).toContain("/icon_view.php");
    expect(html).toContain("/icon_upload.php");
    expect(html).toContain("/trip.php");
    expect(html).toContain("/stats.php");
    expect(html).toContain("/bbs.php");
    expect(html).toContain("/rule.php");
    expect(html).toContain("/script_info.php");
    expect(html).toContain("/version.php");
    expect(html).toContain("/protocol");
  });

  it("renders version page with current implementation status", () => {
    const html = renderVersion();

    expect(html).toContain("<title>汝等是人是狼？[版本紀錄]</title>");
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

    expect(html).toContain("<title>汝等是人是狼？ Werewolf Cloudflare Port 系統特點</title>");
    expect(html).toContain("Script Info");
    expect(html).toContain('<b><a href="/script_info.php">Script Info</a></b>');
    expect(html).toContain("/assets/reference/img/script_info_bg.jpg");
    expect(html).toContain('<a href="/index.php">←返回</a><br>');
    expect(html).toContain('<img class="title-img" src="/assets/reference/img/script_info_title.jpg" alt="Script Info"><br><br>');
    expect(html).not.toContain('<p><img class="title-img" src="/assets/reference/img/script_info_title.jpg" alt="Script Info"></p>');
    expect(html).toContain("＜加入遊戲的系統必備條件＞");
    expect(html).toContain("支援 JavaScript、Cookie");
    expect(html).toContain("＜和其他的script差在哪裡？＞");
    expect(html).toContain("ref/diam1.3.61.kz_Build0912/script_info.php");
    expect(html).toContain("時間設定");
    expect(html).toContain("60秒沉默後推進1時間");
    expect(html).toContain("BBS 標題");
    expect(html).toContain("/version.php");
    expect(html).toContain("/rule.php");
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
    expect(html).toContain('<table class="form-table table1 admin-status-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain("正常運作");
    expect(html).toContain("health-ok");
    expect(html).toContain("health-idle");
    expect(html).toContain("Binding 檢查");
    expect(html).toContain('<table class="form-table table1 admin-status-binding-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain("durableObjects");
    expect(html).toContain("&lt;Runtime&gt;");

    const degraded = renderStatus({
      ok: false,
      checks: { worker: true, db: false },
      homeAnnouncement: null,
      maintenanceMode: true
    });
    expect(degraded).toContain("需要確認");
    expect(degraded).toContain("異常");
    expect(degraded).toContain("health-error");
  });

  it("renders room admin pages", () => {
    const login = renderAdminRoomsLogin();
    expect(login).toContain("廢村管理");
    expect(login).toContain('<table class="form-table table1 admin-room-login-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(login).toContain("roomAdminToken");
    expect(login).toContain("werewolf_cf_room_admin_token");

    const roomOptions = {
      poison: true,
      bigWolf: true,
      authority: false,
      decider: false,
      lovers: true,
      betrayer: false,
      childFox: false,
      twoFoxes: false,
      cat: false,
      lastWords: false,
      openVote: false,
      commonTalkVisible: false,
      channelRestrictions: {
        wolf: true,
        common: false,
        lovers: false,
        fox: true
      },
      deadRoleVisible: false,
      wishRole: false,
      tripRequired: true,
      gmEnabled: true,
      dummyBoy: false,
      customDummy: false,
      dummyName: "替身君",
      dummyLastWords: "",
      realTime: false,
      dayMinutes: 3,
      nightMinutes: 1.5,
      selfVote: false,
      voteStatus: false
    };
    const html = renderAdminRooms([
      {
        id: "room_abc",
        name: "Test",
        comment: "Need review",
        maxPlayers: 30,
        status: "playing",
        createdAt: "2026-05-06 12:00:00",
        options: roomOptions
      },
      {
        id: "room_ended",
        name: "Ended",
        comment: "",
        maxPlayers: 22,
        status: "ended",
        createdAt: "2026-05-06 11:00:00",
        options: roomOptions
      }
    ], "all", "secret token");

    expect(html).toContain("請選擇要廢除的村");
    expect(html).toContain("表示：");
    expect(html).toContain("<strong>全部</strong>");
    expect(html).toContain('<table class="form-table table1 admin-room-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="margin:12px 20px 18px;width:100%">');
    expect(html).toContain("/admin.php?go=rooms&amp;status=active&amp;token=secret%20token");
    expect(html).toContain("/admin.php?go=rooms&amp;status=ended&amp;token=secret%20token");
    expect(html).toContain("room_abc");
    expect(html).toContain("Need review");
    expect(html).toContain("room_ended");
    expect(html).toContain("已結束");
    expect(html).toContain("/assets/reference/img/playing.gif");
    expect(html).toContain("/assets/reference/img/max30.gif");
    expect(html).toContain("/assets/reference/img/room_option_poison.gif");
    expect(html).toContain("/assets/reference/img/room_option_wfbig.gif");
    expect(html).toContain("/assets/reference/img/room_option_lovers.gif");
    expect(html).toContain("/assets/reference/img/room_option_trip.gif");
    expect(html).toContain("埋毒 / 大狼 / 戀人");
    expect(html).toContain("頻道限:狼/狐");
    expect(html).toContain("Trip限定 / GM制");
    expect(html).toContain("/game_view.php?room_no=room_abc");
    expect(html).toContain("/game_log.php?room_no=room_abc&amp;log_mode=on");
    expect(html).toContain("/room/room_abc/events");
    expect(html).toContain("/admin.php?go=del&amp;id=room_abc&amp;token=secret%20token");
    expect(html).toContain("adminEndRoom");
    expect(html).toContain("/api/admin/rooms/");
    expect(html).toContain('"x-room-admin-token": roomAdminToken');
  });

  it("renders runtime config admin pages", () => {
    const login = renderAdminConfigLogin();
    expect(login).toContain("系統設定管理");
    expect(login).toContain('<table class="form-table table1 admin-config-login-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(login).toContain("configAdminToken");
    expect(login).toContain("werewolf_cf_config_admin_token");

    const html = renderAdminConfig({ homeAnnouncement: "<Notice>", maintenanceMode: true }, "secret token");
    expect(html).toContain("首頁公告");
    expect(html).toContain('<table class="form-table table1 admin-config-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain('<table class="form-table table1 admin-config-summary-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain("&lt;Notice&gt;");
    expect(html).toContain("configMaintenanceMode");
    expect(html).toContain("checked");
    expect(html).toContain("/api/admin/config");
    expect(html).toContain('"x-config-admin-token": configAdminToken');
    expect(html).toContain("werewolf_cf_config_admin_token");
  });

  it("renders admin navigation page", () => {
    const html = renderAdminIndex();

    expect(html).toContain("管理選單");
    expect(html).toContain('<table class="form-table table1 admin-menu-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain("/admin.php?go=rooms");
    expect(html).toContain("/admin.php?go=config");
    expect(html).toContain("/admin.php?go=bbs");
    expect(html).toContain("/admin.php?go=status");
    expect(html).toContain("/admin/status");
    expect(html).toContain('action="/admin.php?go=in"');
    expect(html).toContain('<table class="form-table table1 admin-login-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
    expect(html).toContain('name="apass"');
    expect(html).not.toContain('name="adpass"');
    expect(html).toContain("各管理功能仍需輸入對應管理密碼");
    expect(html).toContain('<table class="form-table table1 admin-help-table" border="1" cellspacing="1" cellpadding="2" bgcolor="#CCCCCC" style="width:100%;margin:12px 0 18px;">');
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
    expect(html).toContain("room_end_vote");
    expect(html).toContain("Server Messages");
    expect(html).toContain("game_state");
    expect(html).toContain("房間 <code>roomId</code>");
    expect(html).toContain("<code>openVote</code>/<code>selfVote</code>/<code>voteStatus</code>");
    expect(html).toContain("<code>gameStateFields</code>");
    expect(html).toContain("<code>roomId</code> / <code>phase</code> / <code>day</code>");
    expect(html).toContain("<code>lobbyStartVotedPlayerIds</code> / <code>lobbyKickVoteTargets</code>");
    expect(html).toContain("<code>phaseEndsAt</code> / <code>suddenDeathWarningAt</code>");
    expect(html).toContain("確認開始遊戲、投票、襲擊、占卜、護衛");
    expect(html).toContain("廢村請求");
    expect(html).toContain("GM 換日/裁定/生死/角色/旗標/選項調整");
    expect(html).toContain("<code>actionAckActions</code>");
    expect(html).toContain("<code>start_game</code> / <code>vote</code> / <code>night_kill</code>");
    expect(html).toContain("<code>gm_advance_phase</code> / <code>gm_end_game</code>");
    expect(html).toContain("<code>gm_set_common_voice</code> / <code>gm_set_channel_restrictions</code>");
    expect(html).toContain("revealed_roles");
    expect(html).toContain("common_voice");
    expect(html).toContain("/api/protocol");
    expect(html).toContain("README.md#websocket-protocol");
  });
});
