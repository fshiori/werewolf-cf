export type RoomStatus = "lobby" | "playing" | "ended";

export interface RoomSummary {
  id: string;
  name: string;
  comment: string;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: string;
  options: RoomOptions;
}

export interface FederatedRoomSummary extends RoomSummary {
  serverName: string;
  serverUrl: string;
  roomUrl: string;
  local: boolean;
}

export interface FederatedServerStatus {
  name: string;
  url: string;
  ok: boolean;
  roomCount: number;
  error?: string;
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
  lastWords: boolean;
  openVote: boolean;
  commonTalkVisible: boolean;
  channelRestrictions?: ChannelRestrictions;
  deadRoleVisible: boolean;
  wishRole: boolean;
  tripRequired?: boolean;
  gmEnabled?: boolean;
  gmTripHash?: string;
  dummyBoy: boolean;
  customDummy: boolean;
  dummyName: string;
  dummyLastWords: string;
  realTime: boolean;
  dayMinutes: number;
  nightMinutes: number;
  selfVote: boolean;
  voteStatus: boolean;
}

export interface RoomMember {
  playerId: string;
  nickname: string;
  gm?: boolean;
}

export type ChannelRestriction = "wolf" | "common" | "lovers" | "fox";

export type ChannelRestrictions = Record<ChannelRestriction, boolean>;

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
  iconPath?: string;
  tripHash?: string;
  wishRole?: PlayerRole;
  authority?: boolean;
  decider?: boolean;
  lover?: boolean;
}

export interface PublicGamePlayer {
  playerId: string;
  nickname: string;
  alive: boolean;
  iconPath?: string;
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

export interface WinRateEntry {
  winner: GameWinner;
  label: string;
  wins: number;
  total: number;
  rate: number;
}

export interface TripPublicSummary {
  registered: boolean;
  excluded: boolean;
  players: string[];
  scores: {
    positive: number;
    negative: number;
  };
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
  };
}

export interface TripScoreSummary {
  id: number;
  roomId: string;
  reviewerTrip: string;
  targetTrip: string;
  message: string;
  score: 1 | 2;
  createdAt: string;
}

export interface TripRoomRecordSummary {
  id: number;
  roomId: string;
  winner?: GameWinner;
  day?: number;
  playerId: string;
  nickname: string;
  role: PlayerRole;
  alive: boolean;
  createdAt: string;
}

export interface GameRecordSummary {
  id: number;
  roomId: string;
  result: unknown;
  createdAt: string;
}

export interface PlayerGameRecordSummary {
  id: number;
  roomId: string;
  winner?: GameWinner;
  day?: number;
  playerId: string;
  nickname: string;
  role: PlayerRole;
  alive: boolean;
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

export interface BbsTopicSummary {
  id: number;
  name: string;
  title: string;
  message: string;
  trip: boolean;
  replyCount: number;
  pinned: boolean;
  locked: boolean;
  digest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BbsReplySummary {
  id: number;
  topicId: number;
  name: string;
  message: string;
  trip: boolean;
  createdAt: string;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  day: number;
  hostId?: string;
  players: GamePlayer[];
  votes: Record<string, string>;
  openVote: boolean;
  commonTalkVisible: boolean;
  channelRestrictions?: ChannelRestrictions;
  deadRoleVisible: boolean;
  wishRole: boolean;
  dummyBoy: boolean;
  dayMs: number;
  nightMs: number;
  realTime?: boolean;
  selfVote: boolean;
  voteStatus: boolean;
  revoteCount: number;
  nightKills: Record<string, string>;
  divinations: Record<string, string>;
  guards: Record<string, string>;
  catRevives: Record<string, string>;
  lastWords: Record<string, string>;
  objectionCounts?: Record<string, number>;
  roomEndVotes?: Record<string, number>;
  lobbyStartVotes?: Record<string, boolean>;
  lobbyKickVotes?: Record<string, string[]>;
  mediumReading?: MediumReading;
  winner?: GameWinner;
  phaseEndsAt?: string;
  suddenDeathWarningAt?: string;
  lastSpokenAt?: string;
  log: string[];
}

export type JoinClientMessage = {
  type: "join";
  playerId: string;
  nickname: string;
  trip?: string;
  wishRole?: PlayerRole;
  iconPath?: string;
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

export type CommonChatClientMessage = {
  type: "common_chat";
  text: string;
};

export type LoversChatClientMessage = {
  type: "lovers_chat";
  text: string;
};

export type DeadChatClientMessage = {
  type: "dead_chat";
  text: string;
};

export type SelfTalkClientMessage = {
  type: "self_talk";
  text: string;
};

export type GmChatClientMessage = {
  type: "gm_chat";
  text: string;
};

export type GmWhisperClientMessage = {
  type: "gm_whisper";
  targetPlayerId: string;
  text: string;
};

export type GmAdvancePhaseClientMessage = {
  type: "gm_advance_phase";
};

export type GmEndGameClientMessage = {
  type: "gm_end_game";
  winner: GameWinner;
};

export type GmSetAliveClientMessage = {
  type: "gm_set_alive";
  targetPlayerId: string;
  alive: boolean;
};

export type GmSetRoleClientMessage = {
  type: "gm_set_role";
  targetPlayerId: string;
  role: PlayerRole;
};

export type PlayerFlag = "authority" | "decider" | "lover";

export type GmSetFlagClientMessage = {
  type: "gm_set_flag";
  targetPlayerId: string;
  flag: PlayerFlag;
  enabled: boolean;
};

export type GmSetCommonVoiceClientMessage = {
  type: "gm_set_common_voice";
  enabled: boolean;
};

export type GmSetChannelRestrictionsClientMessage = {
  type: "gm_set_channel_restrictions";
  restrictions: ChannelRestrictions;
};

export type StartGameClientMessage = {
  type: "start_game";
};

export type StartVoteClientMessage = {
  type: "start_vote";
};

export type KickPlayerClientMessage = {
  type: "kick_player";
  targetPlayerId: string;
};

export type KickVoteClientMessage = {
  type: "kick_vote";
  targetPlayerId: string;
};

export type LeaveRoomClientMessage = {
  type: "leave_room";
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

export type SetLastWordsClientMessage = {
  type: "set_last_words";
  text: string;
};

export type ObjectionClientMessage = {
  type: "objection";
};

export type RoomEndVoteClientMessage = {
  type: "room_end_vote";
};

export type ClientMessage =
  | JoinClientMessage
  | ChatClientMessage
  | WolfChatClientMessage
  | FoxChatClientMessage
  | CommonChatClientMessage
  | LoversChatClientMessage
  | DeadChatClientMessage
  | SelfTalkClientMessage
  | GmChatClientMessage
  | GmWhisperClientMessage
  | GmAdvancePhaseClientMessage
  | GmEndGameClientMessage
  | GmSetAliveClientMessage
  | GmSetRoleClientMessage
  | GmSetFlagClientMessage
  | GmSetCommonVoiceClientMessage
  | GmSetChannelRestrictionsClientMessage
  | StartGameClientMessage
  | StartVoteClientMessage
  | KickPlayerClientMessage
  | KickVoteClientMessage
  | LeaveRoomClientMessage
  | VoteClientMessage
  | NightKillClientMessage
  | DivineClientMessage
  | ChildFoxDivineClientMessage
  | GuardClientMessage
  | CatReviveClientMessage
  | SetLastWordsClientMessage
  | ObjectionClientMessage
  | RoomEndVoteClientMessage;

export type ServerMessage =
  | { type: "joined"; roomId: string; playerId: string; members: RoomMember[] }
  | { type: "presence"; members: RoomMember[] }
  | { type: "chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "wolf_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "fox_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "common_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "lovers_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "dead_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "self_talk"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "gm_chat"; playerId: string; nickname: string; text: string; sentAt: string }
  | { type: "gm_whisper"; playerId: string; nickname: string; targetPlayerId: string; targetNickname: string; text: string; sentAt: string }
  | { type: "objection"; playerId: string; nickname: string; remaining: number; sentAt: string }
  | { type: "lobby_start_vote"; playerId: string; nickname: string; votedPlayerIds: string[]; required: number; ready: boolean; sentAt: string }
  | { type: "lobby_kick_vote"; playerId: string; nickname: string; targetPlayerId: string; targetNickname: string; votedPlayerIds: string[]; required: number; ready: boolean; sentAt: string }
  | { type: "revealed_roles"; roles: Record<string, PlayerRole> }
  | { type: "divination_result"; targetPlayerId: string; targetNickname: string; result: DivinationResult }
  | { type: "child_fox_result"; targetPlayerId: string; targetNickname: string; result: ChildFoxDivinationResult }
  | { type: "medium_result"; day: number; targetPlayerId: string; targetNickname: string; result: MediumResult }
  | { type: "last_words_ack" }
  | { type: "action_ack"; action: "vote" | "night_kill" | "guard" | "child_fox_divine" | "cat_revive" | "kick_player" | "leave_room" | "gm_set_common_voice" | "gm_set_channel_restrictions"; targetPlayerId: string }
  | {
      type: "game_state";
      phase: GamePhase;
      day: number;
      hostId?: string;
      revoteCount: number;
      commonTalkVisible: boolean;
      channelRestrictions: ChannelRestrictions;
      players: PublicGamePlayer[];
      openVote: boolean;
      voteStatus: boolean;
      votes: Record<string, string>;
      votedPlayerIds: string[];
      lobbyStartVotedPlayerIds?: string[];
      lobbyKickVoteTargets?: Array<{ targetPlayerId: string; votedPlayerIds: string[] }>;
      objectionCounts: Record<string, number>;
      roomEndVotedPlayerIds?: string[];
      winner?: GameWinner;
      phaseEndsAt?: string;
      suddenDeathWarningAt?: string;
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
