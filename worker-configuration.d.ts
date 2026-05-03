interface Env {
  ROOM_DO: DurableObjectNamespace<import("./src/room").RoomDurableObject>;
  DB: D1Database;
  ASSETS: R2Bucket;
  CONFIG: KVNamespace;
}
