/**
 * 房間管理測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  addPlayer,
  removePlayer,
  getPlayer,
  getAlivePlayers,
  getDeadPlayers,
  startGame,
  endGame,
  isRoomFull,
  hasPlayer,
  canStartGame,
  countAlivePlayers
} from '../room-manager';
import type { RoomData, Player } from '../types';

describe('Room Manager', () => {
  let room: RoomData;
  let testPlayer: Player;

  beforeEach(() => {
    room = createRoom({
      roomNo: 1,
      roomName: 'Test Room',
      maxUser: 16
    });

    testPlayer = {
      userNo: 0,
      uname: 'testuser',
      handleName: 'Test User',
      trip: 'ABC12345',
      iconNo: 1,
      sex: 'male',
      role: 'human',
      live: 'live',
      score: 0
    };
  });

  describe('建立房間', () => {
    it('應該建立新房間', () => {
      expect(room.roomNo).toBe(1);
      expect(room.roomName).toBe('Test Room');
      expect(room.maxUser).toBe(16);
      expect(room.status).toBe('waiting');
      expect(room.players.size).toBe(0);
    });

    it('應該設定正確的初始值', () => {
      expect(room.date).toBe(1);
      expect(room.dayNight).toBe('beforegame');
      expect(room.timeSpent).toBe(0);
    });
  });

  describe('加入玩家', () => {
    it('應該成功加入玩家', () => {
      const success = addPlayer(room, testPlayer);
      
      expect(success).toBe(true);
      expect(room.players.size).toBe(1);
      expect(room.players.has('testuser')).toBe(true);
      expect(testPlayer.userNo).toBe(1);
    });

    it('應該分配玩家編號', () => {
      addPlayer(room, { ...testPlayer, uname: 'user1' });
      addPlayer(room, { ...testPlayer, uname: 'user2' });
      
      expect(room.players.get('user1')?.userNo).toBe(1);
      expect(room.players.get('user2')?.userNo).toBe(2);
    });

    it('房間已滿應該無法加入', () => {
      const smallRoom = createRoom({ roomNo: 1, roomName: 'Small', maxUser: 2 });
      
      addPlayer(smallRoom, { ...testPlayer, uname: 'user1' });
      addPlayer(smallRoom, { ...testPlayer, uname: 'user2' });
      
      const success = addPlayer(smallRoom, { ...testPlayer, uname: 'user3' });
      
      expect(success).toBe(false);
    });

    it('重複使用者名稱應該失敗', () => {
      addPlayer(room, testPlayer);
      
      const success = addPlayer(room, { ...testPlayer, handleName: 'Another' });
      
      expect(success).toBe(false);
    });

    it('房間狀態非 waiting 時不應加入（legacy parity）', () => {
      room.status = 'playing';
      room.dayNight = 'day';

      const success = addPlayer(room, { ...testPlayer, uname: 'late-user' });
      expect(success).toBe(false);
      expect(room.players.size).toBe(0);
    });

    it('dayNight 非 beforegame 時不應加入（legacy parity）', () => {
      room.status = 'waiting';
      room.dayNight = 'night';

      const success = addPlayer(room, { ...testPlayer, uname: 'late-user-2' });
      expect(success).toBe(false);
      expect(room.players.size).toBe(0);
    });
  });

  describe('移除玩家', () => {
    it('應該成功移除玩家', () => {
      addPlayer(room, testPlayer);
      
      const success = removePlayer(room, 'testuser');
      
      expect(success).toBe(true);
      expect(room.players.has('testuser')).toBe(false);
    });

    it('移除不存在的玩家應該失敗', () => {
      const success = removePlayer(room, 'nonexistent');
      
      expect(success).toBe(false);
    });
  });

  describe('獲取玩家', () => {
    it('應該返回正確的玩家', () => {
      addPlayer(room, testPlayer);
      
      const player = getPlayer(room, 'testuser');
      
      expect(player).toBe(testPlayer);
    });

    it('不存在的玩家應該返回 undefined', () => {
      const player = getPlayer(room, 'nonexistent');
      
      expect(player).toBeUndefined();
    });
  });

  describe('獲取存活/死亡玩家', () => {
    beforeEach(() => {
      addPlayer(room, { ...testPlayer, uname: 'alive1', live: 'live' });
      addPlayer(room, { ...testPlayer, uname: 'alive2', live: 'live' });
      addPlayer(room, { ...testPlayer, uname: 'dead1', live: 'dead' });
    });

    it('應該返回所有存活玩家', () => {
      const alivePlayers = getAlivePlayers(room);
      
      expect(alivePlayers.length).toBe(2);
      expect(alivePlayers.every(p => p.live === 'live')).toBe(true);
    });

    it('應該返回所有死亡玩家', () => {
      const deadPlayers = getDeadPlayers(room);
      
      expect(deadPlayers.length).toBe(1);
      expect(deadPlayers[0].live).toBe('dead');
    });
  });

  describe('開始遊戲', () => {
    it('應該成功開始遊戲', () => {
      addPlayer(room, { ...testPlayer, uname: 'user1' });
      addPlayer(room, { ...testPlayer, uname: 'user2' });
      
      const success = startGame(room);
      
      expect(success).toBe(true);
      expect(room.status).toBe('playing');
      expect(room.dayNight).toBe('day');
    });

    it('人數不足無法開始', () => {
      addPlayer(room, testPlayer);
      
      const success = startGame(room);
      
      expect(success).toBe(false);
      expect(room.status).toBe('waiting');
    });

    it('已經在遊戲中無法再次開始', () => {
      addPlayer(room, { ...testPlayer, uname: 'user1' });
      addPlayer(room, { ...testPlayer, uname: 'user2' });
      
      startGame(room);
      
      const success = startGame(room);
      
      expect(success).toBe(false);
    });
  });

  describe('結束遊戲', () => {
    it('應該正確結束遊戲', () => {
      endGame(room, 'human');
      
      expect(room.status).toBe('ended');
      expect(room.victoryRole).toBe('human');
    });
  });

  describe('房間狀態檢查', () => {
    it('房間已滿檢查', () => {
      const smallRoom = createRoom({ roomNo: 1, roomName: 'Small', maxUser: 2 });
      
      addPlayer(smallRoom, { ...testPlayer, uname: 'user1' });
      addPlayer(smallRoom, { ...testPlayer, uname: 'user2' });
      
      expect(isRoomFull(smallRoom)).toBe(true);
    });

    it('玩家存在檢查', () => {
      addPlayer(room, testPlayer);
      
      expect(hasPlayer(room, 'testuser')).toBe(true);
      expect(hasPlayer(room, 'nonexistent')).toBe(false);
    });

    it('可以開始遊戲檢查', () => {
      addPlayer(room, { ...testPlayer, uname: 'user1' });
      addPlayer(room, { ...testPlayer, uname: 'user2' });
      
      expect(canStartGame(room)).toBe(true);
    });

    it('存活玩家計數', () => {
      addPlayer(room, { ...testPlayer, uname: 'alive1', live: 'live' });
      addPlayer(room, { ...testPlayer, uname: 'alive2', live: 'live' });
      addPlayer(room, { ...testPlayer, uname: 'dead1', live: 'dead' });
      
      expect(countAlivePlayers(room)).toBe(2);
    });
  });
});
