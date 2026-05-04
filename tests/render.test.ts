import { describe, expect, it } from "vitest";
import { renderHome, renderRoom } from "../src/render";

describe("render", () => {
  it("renders home with room rows and escaped names", () => {
    const html = renderHome([
      {
        id: "room_abc",
        name: "<Test>",
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
          openVote: true
        }
      }
    ]);

    expect(html).toContain("<fieldset>");
    expect(html).toContain("選單");
    expect(html).toContain("遊戲列表");
    expect(html).toContain("戰績排行榜");
    expect(html).toContain("建立村子");
    expect(html).toContain("&lt;Test&gt;");
    expect(html).toContain("/room/room_abc");
    expect(html).toContain("/api/stats/leaderboard");
    expect(html).toContain("排行榜 JSON");
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
    expect(html).toContain("options: { poison, bigWolf, authority, decider, lovers, betrayer, childFox, twoFoxes, cat, lastWords, openVote }");
    expect(html).toContain("埋毒");
    expect(html).toContain("大狼");
    expect(html).toContain("背德");
    expect(html).toContain("子狐");
    expect(html).toContain("雙狐");
    expect(html).toContain("貓又");
    expect(html).toContain("遺言");
    expect(html).toContain("公開票");
    expect(html).toContain("leaderboardRows");
    expect(html).toContain("尚無戰績。");
    expect(html).toContain("cell.textContent = String(value);");
    expect(html).toContain("建立房間");
  });

  it("renders escaped runtime announcements", () => {
    const html = renderHome([], `<b>Maintenance</b>`);

    expect(html).toContain("&lt;b&gt;Maintenance&lt;/b&gt;");
    expect(html).not.toContain("<b>Maintenance</b>");
  });

  it("renders room page with websocket client script", () => {
    const html = renderRoom("room_abc");

    expect(html).toContain("[room_abc]");
    expect(html).toContain("new WebSocket");
    expect(html).toContain("進入房間");
    expect(html).toContain("avatarFile");
    expect(html).toContain("/api/assets/avatar");
    expect(html).toContain("/assets/avatar/");
    expect(html).toContain("送出");
    expect(html).toContain("狼頻");
    expect(html).toContain("狐頻");
    expect(html).toContain("共有頻");
    expect(html).toContain("戀頻");
    expect(html).toContain("靈界");
    expect(html).toContain("開始遊戲");
    expect(html).toContain("房主");
    expect(html).toContain("戰績");
    expect(html).toContain("/api/players/");
    expect(html).toContain("/stats");
    expect(html).toContain("void refreshStats();");
    expect(html).toContain("最近對局");
    expect(html).toContain("/api/rooms/");
    expect(html).toContain("/records");
    expect(html).toContain("事件");
    expect(html).toContain("/events");
    expect(html).toContain("game.hostId !== currentPlayerId");
    expect(html).toContain("game.revoteCount");
    expect(html).toContain("currentPlayerAlive");
    expect(html).toContain("currentPlayerDead");
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
});
