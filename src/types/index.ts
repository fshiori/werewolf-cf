/**
 * 全域型別定義
 */

import type { D1Database, KVNamespace, DurableObjectNamespace, R2Bucket, DurableObject } from '@cloudflare/workers-types';
import type { RoomOptions } from './room-options';

// 環境變數
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  WEREWOLF_ROOM: DurableObjectNamespace<any>;
  R2: R2Bucket;
  ENVIRONMENT: 'development' | 'production';
  ADMIN_PASSWORD?: string;
  JWT_SECRET?: string;
  ASSETS?: any; // 靜態資源（Cloudflare Assets Fetcher）
  FEDERATED_SOURCES?: string; // JSON array of { name, url }
}

// 玩家角色類型
export type Role =
  | 'human'        // 村民
  | 'wolf'         // 狼人
  | 'wolf_partner' // 狼人夥伴
  | 'mage'         // 預言家
  | 'necromancer'  // 靈媒
  | 'mad'          // 狂人
  | 'guard'        // 獵人
  | 'common'       // 共有者
  | 'common_partner' // 共有者夥伴
  | 'fox'          // 妖狐
  | 'betr'         // 背德者
  | 'betr_partner' // 背德者夥伴
  | 'fosi'         // 子狐
  | 'poison'       // 埋毒者
  | 'wfbig'        // 大狼
  | 'authority'    // 權力者
  | 'decide'       // 決定者
  | 'lovers'       // 戀人
  | 'lovers_partner' // 戀人夥伴
  | 'cat'          // 貓又
  | 'GM';          // 遊戲管理員

// 玩家狀態
export type PlayerStatus = 'live' | 'dead';

// 遊戲階段
export type GamePhase = 'beforegame' | 'day' | 'night' | 'aftergame';

// 房間狀態
export type RoomStatus = 'waiting' | 'playing' | 'ended';

// 玩家資料
export interface Player {
  userNo: number;          // 玩家編號
  uname: string;           // 使用者名稱（唯一）
  handleName: string;      // 顯示名稱
  trip: string;            // Tripcode
  iconNo: number;          // 頭像編號
  sex: string;             // 性別
  wishRole?: Role | 'none'; // 希望角色（wish_role 啟用時使用）
  role: Role;              // 角色
  roleDesc?: string;       // 角色描述
  gColor?: string;         // 角色顏色
  live: PlayerStatus;      // 存活狀態
  score: number;           // 評分
  death?: number;          // 死亡標記
  marked?: number;         // 標記
  lastWords?: string;      // 遺言
  lastLoadDayNight?: string; // 最後載入的階段
  sessionId?: string;      // Session ID
  ipAddress?: string;      // IP 位址
}

// 房間資料
export interface RoomData {
  roomNo: number;          // 房間編號
  roomName: string;        // 房間名稱
  roomComment: string;     // 房間說明
  maxUser: number;         // 最大人數
  gameOption: string;      // 遊戲選項
  optionRole: string;      // 角色選項
  status: RoomStatus;      // 房間狀態
  date: number;            // 第幾天
  dayNight: GamePhase;     // 白天/夜晚
  victoryRole?: string;    // 勝利陣營
  dellook: number;         // 刪除觀看權限
  uptime: number;          // 最後更新時間
  lastUpdated: number;     // 最後活動時間
  players: Map<string, Player>; // 玩家清單
  messages: Message[];     // 訊息記錄
  timeSpent: number;       // 已消耗時間單位
  silenceTime?: number;    // 沈默時間
  isPrivate?: boolean;     // 是否為私人房間
  passwordHash?: string;   // 密碼雜湊（SHA-256）
  roomOptions?: RoomOptions; // 房間選項（整合 timeLimit, silenceMode 等）
  host?: string;              // 房長 uname（第一個加入的玩家）
}

// 訊息類型
export interface Message {
  id: string;
  roomNo: number;
  date: number;
  location: GamePhase;
  uname: string;
  handleName: string;
  sentence: string;
  fontType: 'normal' | 'strong' | 'weak' | 'heaven' | 'gm_to' | 'to_gm' | 'last_words';
  time: number;
  spendTime?: number;
}

// 投票資料
export interface Vote {
  roomNo: number;
  date: number;
  uname: string;
  targetUname: string;
  voteNumber: number;
  voteTimes: number;
  situation: string;
}

// Session 資料
export interface SessionData {
  sessionId: string;
  uname: string;
  roomNo: number;
  createdAt: number;
  expiresAt: number;
}

// WebSocket 訊息類型
export interface WSMessage {
  type: 'connected' | 'message' | 'system' | 'user_joined' | 'user_left' | 'phase_change' | 'time_update' | 'game_over' | 'night_action' | 'vote_result';
  data: any;
}

// Tripcode 評分
export interface TripScore {
  id: number;
  user: string;
  room: number;
  trip: string;
  mess: string;
  score: number;
}

export { RoomOptions, DEFAULT_ROOM_OPTIONS, parseRoomOptions } from './room-options';

// 頭像資料
export interface UserIcon {
  iconNo: number;
  iconName: string;
  iconFilename: string;
  iconWidth: number;
  iconHeight: number;
  color: string;
  sessionId?: string;
  look: number;
}
