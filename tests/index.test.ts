import { describe, expect, it } from "vitest";
import worker from "../src/index";

function envWithRooms(roomIds: string[]): Env {
  return {
    DB: {
      prepare(query: string) {
        return {
          bind(roomId: string) {
            return {
              async first() {
                return roomIds.includes(roomId) ? { id: roomId } : null;
              },
              async run() {
                return {};
              }
            };
          },
          async all() {
            return { results: [] };
          }
        };
      },
      async batch() {
        return [];
      }
    },
    ROOM_DO: {
      idFromName(name: string) {
        return { name } as DurableObjectId;
      },
      get() {
        return {
          async fetch() {
            return new Response("upgraded", { status: 101 });
          }
        } as unknown as DurableObjectStub;
      }
    },
    ASSETS: {} as R2Bucket,
    CONFIG: {} as KVNamespace
  } as unknown as Env;
}

describe("worker routes", () => {
  it("returns 404 for formatted room ids missing from D1", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_missing"), envWithRooms([]));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Room not found");
  });

  it("renders room pages that exist in D1", async () => {
    const response = await worker.fetch(new Request("http://example.test/room/room_exists"), envWithRooms(["room_exists"]));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("[room_exists]");
  });
});
