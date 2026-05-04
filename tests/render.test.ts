import { describe, expect, it } from "vitest";
import { renderHome, renderRoom } from "../src/render";

describe("render", () => {
  it("renders home with room rows and escaped names", () => {
    const html = renderHome([
      {
        id: "room_abc",
        name: "<Test>",
        status: "lobby",
        createdAt: "2026-05-03 12:00:00"
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
    expect(html).toContain("actorCanAct");
    expect(html).toContain("function roleLabel(value)");
    expect(html).toContain('werewolf: "人狼"');
    expect(html).toContain('fox: "妖狐"');
    expect(html).toContain("roleLabel(msg.role)");
    expect(html).toContain("winnerLabel(game.winner)");
    expect(html).toContain("msg.commons");
    expect(html).toContain("共有：");
    expect(html).toContain("玩家列表");
    expect(html).toContain("能力發動 / 投票");
    expect(html).toContain("wolf_chat");
    expect(html).toContain("action_ack");
    expect(html).toContain("divination_result");
    expect(html).toContain("medium_result");
    expect(html).toContain("type: \"divine\"");
    expect(html).toContain("type: \"guard\"");
  });
});
