import { describe, expect, it } from "vitest";
import { RoomDurableObject } from "../src/room";

type SentMessage = {
  type: string;
  message: string;
};

function roomObject(): RoomDurableObject {
  return new RoomDurableObject(
    { id: { name: "room_abc" } } as DurableObjectState,
    {} as Env
  );
}

function fakeSocket(messages: SentMessage[]): WebSocket {
  return {
    send(data: string) {
      messages.push(JSON.parse(data) as SentMessage);
    }
  } as WebSocket;
}

async function sendRaw(room: RoomDurableObject, socket: WebSocket, data: string): Promise<void> {
  await (room as unknown as { onMessage(socket: WebSocket, event: MessageEvent): Promise<void> }).onMessage(socket, { data } as MessageEvent);
}

describe("RoomDurableObject", () => {
  it("reports malformed websocket JSON without closing the socket handler", async () => {
    const room = roomObject();
    const messages: SentMessage[] = [];
    const socket = fakeSocket(messages);

    await sendRaw(room, socket, "{bad");
    await sendRaw(room, socket, JSON.stringify({ type: "chat", text: "still open" }));

    expect(messages).toEqual([
      { type: "error", message: "Invalid JSON" },
      { type: "error", message: "Join required" }
    ]);
  });
});
