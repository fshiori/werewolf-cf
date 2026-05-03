import { describe, expect, it } from "vitest";
import { buildChatMessage, buildJoinedMessage, buildPresenceMessage } from "../src/messages";

describe("messages", () => {
  it("builds joined messages", () => {
    expect(buildJoinedMessage("room_abc", "player_1", [])).toEqual({
      type: "joined",
      roomId: "room_abc",
      playerId: "player_1",
      members: []
    });
  });

  it("builds presence messages", () => {
    expect(buildPresenceMessage([{ playerId: "player_1", nickname: "Alice" }])).toEqual({
      type: "presence",
      members: [{ playerId: "player_1", nickname: "Alice" }]
    });
  });

  it("builds escaped chat messages", () => {
    expect(buildChatMessage("player_1", "Alice", "<hello>")).toMatchObject({
      type: "chat",
      playerId: "player_1",
      nickname: "Alice",
      text: "&lt;hello&gt;"
    });
  });
});
