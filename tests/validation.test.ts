import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  isRecord,
  parseClientMessage,
  validateChatText,
  validateNickname,
  validatePlayerId,
  validateRoomId,
  validateRoomName
} from "../src/validation";

describe("validation", () => {
  it("accepts generated room ids and rejects unsafe ids", () => {
    expect(validateRoomId("room_abc123XYZ")).toBe("room_abc123XYZ");
    expect(() => validateRoomId("../bad")).toThrow("Invalid room id");
  });

  it("accepts browser player ids and rejects empty ids", () => {
    expect(validatePlayerId("player_0123456789abcdef")).toBe("player_0123456789abcdef");
    expect(() => validatePlayerId("")).toThrow("Invalid player id");
  });

  it("normalizes nickname and room name", () => {
    expect(validateNickname(" Alice ")).toBe("Alice");
    expect(validateRoomName("  Test Room  ")).toBe("Test Room");
    expect(() => validateNickname("x".repeat(33))).toThrow("Nickname is too long");
    expect(() => validateRoomName("")).toThrow("Room name is required");
  });

  it("validates chat text", () => {
    expect(validateChatText(" hello ")).toBe("hello");
    expect(() => validateChatText("")).toThrow("Chat text is required");
    expect(() => validateChatText("x".repeat(501))).toThrow("Chat text is too long");
  });

  it("escapes html-sensitive characters", () => {
    expect(escapeHtml(`<b class="x">& hi</b>`)).toBe("&lt;b class=&quot;x&quot;&gt;&amp; hi&lt;/b&gt;");
  });

  it("parses only allowed client messages", () => {
    expect(parseClientMessage('{"type":"chat","text":"hi"}')).toEqual({ type: "chat", text: "hi" });
    expect(parseClientMessage('{"type":"wolf_chat","text":"secret"}')).toEqual({ type: "wolf_chat", text: "secret" });
    expect(parseClientMessage('{"type":"start_game"}')).toEqual({ type: "start_game" });
    expect(parseClientMessage('{"type":"vote","targetPlayerId":"player_1"}')).toEqual({ type: "vote", targetPlayerId: "player_1" });
    expect(parseClientMessage('{"type":"night_kill","targetPlayerId":"player_2"}')).toEqual({
      type: "night_kill",
      targetPlayerId: "player_2"
    });
    expect(parseClientMessage('{"type":"divine","targetPlayerId":"player_3"}')).toEqual({
      type: "divine",
      targetPlayerId: "player_3"
    });
    expect(parseClientMessage('{"type":"child_fox_divine","targetPlayerId":"player_3"}')).toEqual({
      type: "child_fox_divine",
      targetPlayerId: "player_3"
    });
    expect(parseClientMessage('{"type":"guard","targetPlayerId":"player_4"}')).toEqual({
      type: "guard",
      targetPlayerId: "player_4"
    });
    expect(() => parseClientMessage("{bad")).toThrow("Invalid JSON");
    expect(() => parseClientMessage('{"type":"unknown"}')).toThrow("Unknown message type");
  });

  it("recognizes records", () => {
    expect(isRecord({ type: "chat" })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(["chat"])).toBe(false);
  });
});
