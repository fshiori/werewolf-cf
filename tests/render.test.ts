import { describe, expect, it } from "vitest";
import { renderHome, renderPlayerProfile, renderRoom, renderRules } from "../src/render";

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
    expect(html).toContain("&lt;Test&gt;");
    expect(html).toContain("&lt;Friendly&gt;");
    expect(html).toContain("最大30");
    expect(html).toContain("/room/room_abc");
    expect(html).toContain("/api/stats/leaderboard");
    expect(html).toContain("排行榜 JSON");
    expect(html).toContain("/api/config");
    expect(html).toContain("設定 JSON");
    expect(html).toContain("/rules");
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

  it("renders room page with websocket client script", () => {
    const html = renderRoom("room_abc");

    expect(html).toContain("[room_abc]");
    expect(html).toContain("new WebSocket");
    expect(html).toContain("進入房間");
    expect(html).toContain("werewolf_cf_trip");
    expect(html).toContain("Trip");
    expect(html).toContain("avatarFile");
    expect(html).toContain("/api/assets/avatar");
    expect(html).toContain("/assets/avatar/");
    expect(html).toContain('profileLink.href = "/player/" + player.playerId;');
    expect(html).toContain("送出");
    expect(html).toContain("狼頻");
    expect(html).toContain("狐頻");
    expect(html).toContain("共有頻");
    expect(html).toContain("戀頻");
    expect(html).toContain("靈界");
    expect(html).toContain("GM私語");
    expect(html).toContain("gmWhisperTarget");
    expect(html).toContain("gm_chat");
    expect(html).toContain("gm_whisper");
    expect(html).toContain("gm_advance_phase");
    expect(html).toContain("GM換日");
    expect(html).toContain("gm_end_game");
    expect(html).toContain("GM裁定");
    expect(html).toContain("gm_set_alive");
    expect(html).toContain("GM復活");
    expect(html).toContain("gm_set_role");
    expect(html).toContain("GM改職");
    expect(html).toContain("gm_set_flag");
    expect(html).toContain("GM解除");
    expect(html).toContain("kick_player");
    expect(html).toContain("踢 ");
    expect(html).toContain("開始遊戲");
    expect(html).toContain("房主");
    expect(html).toContain("戰績");
    expect(html).toContain("/api/players/");
    expect(html).toContain("/stats");
    expect(html).toContain("void refreshStats();");
    expect(html).toContain("最近對局");
    expect(html).toContain("個人紀錄");
    expect(html).toContain("/api/rooms/");
    expect(html).toContain("/records");
    expect(html).toContain("playerRecords");
    expect(html).toContain("/api/players/\" + playerId + \"/records");
    expect(html).toContain("事件");
    expect(html).toContain("/events");
    expect(html).toContain("game.hostId !== currentPlayerId");
    expect(html).toContain("game.revoteCount");
    expect(html).toContain("currentPlayerAlive");
    expect(html).toContain("currentPlayerDead");
    expect(html).toContain("voteSummary");
    expect(html).toContain("votedPlayerIds");
    expect(html).toContain(".player-card.voted");
    expect(html).toContain("\" voted\"");
    expect(html).toContain("投票：");
    expect(html).toContain("actorCanAct");
    expect(html).toContain("function roleLabel(value)");
    expect(html).toContain('werewolf: "人狼"');
    expect(html).toContain('big_wolf: "大狼"');
    expect(html).toContain('fox: "妖狐"');
    expect(html).toContain('poison: "埋毒者"');
    expect(html).toContain('betrayer: "背德者"');
    expect(html).toContain('child_fox: "子狐"');
    expect(html).toContain('cat: "貓又"');
    expect(html).toContain("roleLabel(msg.role)");
    expect(html).toContain("winnerLabel(game.winner)");
    expect(html).toContain("isWolfRole(role)");
    expect(html).toContain("msg.authority");
    expect(html).toContain("權力者");
    expect(html).toContain("msg.lovers");
    expect(html).toContain("戀人：");
    expect(html).toContain("msg.foxes");
    expect(html).toContain("妖狐：");
    expect(html).toContain("msg.commons");
    expect(html).toContain("共有：");
    expect(html).toContain("玩家列表");
    expect(html).toContain("能力發動 / 投票");
    expect(html).toContain("wolf_chat");
    expect(html).toContain("fox_chat");
    expect(html).toContain("common_chat");
    expect(html).toContain("lovers_chat");
    expect(html).toContain("dead_chat");
    expect(html).toContain("revealed_roles");
    expect(html).toContain("wishRole");
    expect(html).toContain("<option value=\"seer\">占卜師</option>");
    expect(html).toContain("sendDeadChat");
    expect(html).toContain("lastWordsText");
    expect(html).toContain("setLastWords");
    expect(html).toContain("set_last_words");
    expect(html).toContain("last_words_ack");
    expect(html).toContain("isLover");
    expect(html).toContain("action_ack");
    expect(html).toContain("divination_result");
    expect(html).toContain("child_fox_result");
    expect(html).toContain("child_fox_divine");
    expect(html).toContain("cat_revive");
    expect(html).toContain("medium_result");
    expect(html).toContain("type: \"divine\"");
    expect(html).toContain("type: \"guard\"");
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

  it("renders implemented rules page", () => {
    const html = renderRules();

    expect(html).toContain("基本流程");
    expect(html).toContain("白天");
    expect(html).toContain("夜晚");
    expect(html).toContain("角色");
    expect(html).toContain("人狼 / 大狼");
    expect(html).toContain("Trip限定");
    expect(html).toContain("Durable Object alarm");
  });
});
