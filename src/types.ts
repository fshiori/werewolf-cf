export type RoomStatus = "lobby";

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: string;
}

export interface RoomMember {
  playerId: string;
  nickname: string;
}

export type JoinClientMessage = {
  type: "join";
  playerId: string;
  nickname: string;
};

export type ChatClientMessage = {
  type: "chat";
  text: string;
};

export type ClientMessage = JoinClientMessage | ChatClientMessage;

export type ServerMessage =
  | { type: "joined"; roomId: string; playerId: string; members: RoomMember[] }
  | { type: "presence"; members: RoomMember[] }
  | { type: "chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "error"; message: string };
