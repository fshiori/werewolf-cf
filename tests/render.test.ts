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
    expect(html).toContain("建立村子");
    expect(html).toContain("&lt;Test&gt;");
    expect(html).toContain("/room/room_abc");
    expect(html).toContain("建立房間");
  });

  it("renders room page with websocket client script", () => {
    const html = renderRoom("room_abc");

    expect(html).toContain("[room_abc]");
    expect(html).toContain("new WebSocket");
    expect(html).toContain("進入房間");
    expect(html).toContain("送出");
    expect(html).toContain("狼頻");
    expect(html).toContain("開始遊戲");
    expect(html).toContain("玩家列表");
    expect(html).toContain("能力發動 / 投票");
    expect(html).toContain("wolf_chat");
  });
});
