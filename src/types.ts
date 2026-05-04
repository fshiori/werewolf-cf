export type RoomStatus = "lobby" | "playing" | "ended";

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

export type PlayerRole = "villager" | "werewolf" | "seer" | "medium";
export type GamePhase = "lobby" | "day" | "night" | "ended";
export type GameWinner = "villagers" | "werewolves";
export type DivinationResult = "human" | "werewolf";
export type MediumResult = "human" | "werewolf";

export interface MediumReading {
  day: number;
  targetPlayerId: string;
  targetNickname: string;
  result: MediumResult;
}

export interface GamePlayer {
  playerId: string;
  nickname: string;
  role: PlayerRole;
  alive: boolean;
}

export interface PublicGamePlayer {
  playerId: string;
  nickname: string;
  alive: boolean;
}

export interface PlayerStatUpdate {
  playerId: string;
  won: boolean;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  day: number;
  hostId?: string;
  players: GamePlayer[];
  votes: Record<string, string>;
  revoteCount: number;
  nightKills: Record<string, string>;
  divinations: Record<string, string>;
  mediumReading?: MediumReading;
  winner?: GameWinner;
  phaseEndsAt?: string;
  log: string[];
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

export type WolfChatClientMessage = {
  type: "wolf_chat";
  text: string;
};

export type StartGameClientMessage = {
  type: "start_game";
};

export type VoteClientMessage = {
  type: "vote";
  targetPlayerId: string;
};

export type NightKillClientMessage = {
  type: "night_kill";
  targetPlayerId: string;
};

export type DivineClientMessage = {
  type: "divine";
  targetPlayerId: string;
};

export type ClientMessage =
  | JoinClientMessage
  | ChatClientMessage
  | WolfChatClientMessage
  | StartGameClientMessage
  | VoteClientMessage
  | NightKillClientMessage
  | DivineClientMessage;

export type ServerMessage =
  | { type: "joined"; roomId: string; playerId: string; members: RoomMember[] }
  | { type: "presence"; members: RoomMember[] }
  | { type: "chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "wolf_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "divination_result"; targetPlayerId: string; targetNickname: string; result: DivinationResult }
  | { type: "medium_result"; day: number; targetPlayerId: string; targetNickname: string; result: MediumResult }
  | {
      type: "game_state";
      phase: GamePhase;
      day: number;
      hostId?: string;
      revoteCount: number;
      players: PublicGamePlayer[];
      votes: Record<string, string>;
      winner?: GameWinner;
      phaseEndsAt?: string;
      log: string[];
    }
  | { type: "role"; role: PlayerRole; wolves: RoomMember[] }
  | { type: "error"; message: string };
