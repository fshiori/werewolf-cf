/**
 * 房間管理系統
 */

import type { RoomData, Player, RoomStatus } from '../types';

/**
 * 建立新房間
 */
export function createRoom(config: {
  roomNo: number;
  roomName: string;
  roomComment?: string;
  maxUser?: number;
  gameOption?: string;
  optionRole?: string;
}): RoomData {
  return {
    roomNo: config.roomNo,
    roomName: config.roomName,
    roomComment: config.roomComment || '',
    maxUser: config.maxUser || 16,
    gameOption: config.gameOption || '',
    optionRole: config.optionRole || '',
    status: 'waiting',
    date: 1,
    dayNight: 'beforegame',
    players: new Map(),
    messages: [],
    timeSpent: 0,
    uptime: Date.now(),
    lastUpdated: Date.now(),
    dellook: 0
  };
}

/**
 * 加入玩家
 */
export function addPlayer(room: RoomData, player: Player): boolean {
  // legacy parity: 遊戲開始後（非 waiting / 非 beforegame）不可新加入
  if (room.status !== 'waiting' || room.dayNight !== 'beforegame') {
    return false;
  }

  // 檢查人數限制
  if (room.players.size >= room.maxUser) {
    return false;
  }

  // 檢查使用者名稱重複
  if (room.players.has(player.uname)) {
    return false;
  }

  // 分配玩家編號
  player.userNo = room.players.size + 1;

  // 加入玩家
  room.players.set(player.uname, player);
  room.lastUpdated = Date.now();

  return true;
}

/**
 * 移除玩家
 */
export function removePlayer(room: RoomData, uname: string): boolean {
  const result = room.players.delete(uname);
  if (result) {
    room.lastUpdated = Date.now();
  }
  return result;
}

/**
 * 獲取玩家
 */
export function getPlayer(room: RoomData, uname: string): Player | undefined {
  return room.players.get(uname);
}

/**
 * 獲取所有存活玩家
 */
export function getAlivePlayers(room: RoomData): Player[] {
  return Array.from(room.players.values()).filter(p => p.live === 'live');
}

/**
 * 獲取所有死亡玩家
 */
export function getDeadPlayers(room: RoomData): Player[] {
  return Array.from(room.players.values()).filter(p => p.live === 'dead');
}

/**
 * 開始遊戲
 */
export function startGame(room: RoomData): boolean {
  if (room.status !== 'waiting') {
    return false;
  }

  if (room.players.size < 2) {
    return false;
  }

  room.status = 'playing';
  room.dayNight = 'day';
  room.date = 1;
  room.timeSpent = 0;
  room.lastUpdated = Date.now();

  return true;
}

/**
 * 結束遊戲
 */
export function endGame(room: RoomData, winner: string): void {
  room.status = 'ended';
  room.victoryRole = winner;
  room.lastUpdated = Date.now();
}

/**
 * 更新時間
 */
export function updateTime(room: RoomData): void {
  room.lastUpdated = Date.now();
}

/**
 * 檢查房間是否已滿
 */
export function isRoomFull(room: RoomData): boolean {
  return room.players.size >= room.maxUser;
}

/**
 * 檢查玩家是否在房間內
 */
export function hasPlayer(room: RoomData, uname: string): boolean {
  return room.players.has(uname);
}

/**
 * 獲取公開的房間資訊
 */
export function getPublicRoomInfo(room: RoomData) {
  const players = Array.from(room.players.values()).map((player) => ({
    userNo: player.userNo,
    uname: player.uname,
    handleName: player.handleName,
    trip: player.trip,
    iconNo: player.iconNo,
    live: player.live,
  }));

  return {
    roomNo: room.roomNo,
    roomName: room.roomName,
    roomComment: room.roomComment,
    maxUser: room.maxUser,
    status: room.status,
    date: room.date,
    dayNight: room.dayNight,
    playerCount: room.players.size,
    players,
    lastUpdated: room.lastUpdated,
    host: room.host || null
  };
}

/**
 * 獲取玩家的公開資訊
 */
export function getPublicPlayerInfo(player: Player) {
  return {
    userNo: player.userNo,
    handleName: player.handleName,
    trip: player.trip,
    iconNo: player.iconNo,
    live: player.live,
    // 不包含角色資訊
  };
}

/**
 * 檢查房間是否可以開始遊戲
 */
export function canStartGame(room: RoomData): boolean {
  if (room.status !== 'waiting') {
    return false;
  }

  if (room.players.size < 2) {
    return false;
  }

  return true;
}

/**
 * 計算房間存活人數
 */
export function countAlivePlayers(room: RoomData): number {
  return getAlivePlayers(room).length;
}

/**
 * 計算房間死亡人數
 */
export function countDeadPlayers(room: RoomData): number {
  return getDeadPlayers(room).length;
}

/**
 * 清空房間
 */
export function clearRoom(room: RoomData): void {
  room.players.clear();
  room.messages = [];
  room.status = 'waiting';
  room.date = 1;
  room.dayNight = 'beforegame';
  room.timeSpent = 0;
  room.lastUpdated = Date.now();
}
