export type RoomStatus = "lobby" | "playing" | "ended";

export interface RoomSummary {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: string;
  options: RoomOptions;
}

export interface RoomOptions {
  poison: boolean;
  bigWolf: boolean;
  authority: boolean;
  decider: boolean;
  lovers: boolean;
  betrayer: boolean;
  childFox: boolean;
  twoFoxes: boolean;
  cat: boolean;
}

export interface RoomMember {
  playerId: string;
  nickname: string;
}

export type PlayerRole =
  | "villager"
  | "werewolf"
  | "big_wolf"
  | "seer"
  | "medium"
  | "madman"
  | "guard"
  | "common"
  | "fox"
  | "poison"
  | "betrayer"
  | "child_fox"
  | "cat";
export type GamePhase = "lobby" | "day" | "night" | "ended";
export type GameWinner = "villagers" | "werewolves" | "foxes" | "lovers";
export type DivinationResult = "human" | "werewolf";
export type ChildFoxDivinationResult = DivinationResult | "failed";
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
  authority?: boolean;
  decider?: boolean;
  lover?: boolean;
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

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface LeaderboardEntry extends PlayerStats {
  rank: number;
}

export interface GameRecordSummary {
  id: number;
  roomId: string;
  result: unknown;
  createdAt: string;
}

export interface RoomEventSummary {
  id: number;
  roomId: string;
  playerId?: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
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
  guards: Record<string, string>;
  catRevives: Record<string, string>;
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

export type FoxChatClientMessage = {
  type: "fox_chat";
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

export type ChildFoxDivineClientMessage = {
  type: "child_fox_divine";
  targetPlayerId: string;
};

export type GuardClientMessage = {
  type: "guard";
  targetPlayerId: string;
};

export type CatReviveClientMessage = {
  type: "cat_revive";
  targetPlayerId: string;
};

export type ClientMessage =
  | JoinClientMessage
  | ChatClientMessage
  | WolfChatClientMessage
  | FoxChatClientMessage
  | StartGameClientMessage
  | VoteClientMessage
  | NightKillClientMessage
  | DivineClientMessage
  | ChildFoxDivineClientMessage
  | GuardClientMessage
  | CatReviveClientMessage;

export type ServerMessage =
  | { type: "joined"; roomId: string; playerId: string; members: RoomMember[] }
  | { type: "presence"; members: RoomMember[] }
  | { type: "chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "wolf_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "fox_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "divination_result"; targetPlayerId: string; targetNickname: string; result: DivinationResult }
  | { type: "child_fox_result"; targetPlayerId: string; targetNickname: string; result: ChildFoxDivinationResult }
  | { type: "medium_result"; day: number; targetPlayerId: string; targetNickname: string; result: MediumResult }
  | { type: "action_ack"; action: "vote" | "night_kill" | "guard" | "child_fox_divine" | "cat_revive"; targetPlayerId: string }
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
  | {
      type: "role";
      role: PlayerRole;
      wolves: RoomMember[];
      commons: RoomMember[];
      lovers: RoomMember[];
      foxes: RoomMember[];
      authority?: boolean;
    }
  | { type: "error"; message: string };
