import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  isRecord,
  parseClientMessage,
  validateChatText,
  validateLastWordsText,
  validateNickname,
  validateOptionalLastWordsText,
  validatePlayerId,
  validateRoomCapacity,
  validateRoomComment,
  validateRoomId,
  validateRoomName,
  validateWishRole
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

  it("normalizes optional room comments", () => {
    expect(validateRoomComment("  Friendly village  ")).toBe("Friendly village");
    expect(validateRoomComment("   ")).toBe("");
    expect(() => validateRoomComment("x".repeat(121))).toThrow("Room comment is too long");
  });

  it("validates reference room capacities", () => {
    expect(validateRoomCapacity(8)).toBe(8);
    expect(validateRoomCapacity("22")).toBe(22);
    expect(() => validateRoomCapacity(15)).toThrow("Invalid room capacity");
  });

  it("validates wished roles", () => {
    expect(validateWishRole("none")).toBeUndefined();
    expect(validateWishRole("seer")).toBe("seer");
    expect(() => validateWishRole("cat")).toThrow("Invalid wished role");
  });

  it("validates chat text", () => {
    expect(validateChatText(" hello ")).toBe("hello");
    expect(() => validateChatText("")).toThrow("Chat text is required");
    expect(() => validateChatText("x".repeat(501))).toThrow("Chat text is too long");
  });

  it("validates last words text", () => {
    expect(validateLastWordsText(" final words ")).toBe("final words");
    expect(validateOptionalLastWordsText("   ")).toBe("");
    expect(() => validateLastWordsText("")).toThrow("Last words are required");
    expect(() => validateOptionalLastWordsText("x".repeat(501))).toThrow("Last words are too long");
    expect(() => validateLastWordsText("x".repeat(501))).toThrow("Last words are too long");
  });

  it("escapes html-sensitive characters", () => {
    expect(escapeHtml(`<b class="x">& hi</b>`)).toBe("&lt;b class=&quot;x&quot;&gt;&amp; hi&lt;/b&gt;");
  });

  it("parses only allowed client messages", () => {
    expect(parseClientMessage('{"type":"chat","text":"hi"}')).toEqual({ type: "chat", text: "hi" });
    expect(parseClientMessage('{"type":"join","playerId":"player_1","nickname":"Alice","wishRole":"seer"}')).toEqual({
      type: "join",
      playerId: "player_1",
      nickname: "Alice",
      wishRole: "seer"
    });
    expect(parseClientMessage('{"type":"wolf_chat","text":"secret"}')).toEqual({ type: "wolf_chat", text: "secret" });
    expect(parseClientMessage('{"type":"fox_chat","text":"secret"}')).toEqual({ type: "fox_chat", text: "secret" });
    expect(parseClientMessage('{"type":"common_chat","text":"secret"}')).toEqual({ type: "common_chat", text: "secret" });
    expect(parseClientMessage('{"type":"lovers_chat","text":"secret"}')).toEqual({ type: "lovers_chat", text: "secret" });
    expect(parseClientMessage('{"type":"dead_chat","text":"secret"}')).toEqual({ type: "dead_chat", text: "secret" });
    expect(parseClientMessage('{"type":"set_last_words","text":"bye"}')).toEqual({ type: "set_last_words", text: "bye" });
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
    expect(parseClientMessage('{"type":"cat_revive","targetPlayerId":"player_4"}')).toEqual({
      type: "cat_revive",
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
