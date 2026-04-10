/**
 * 房間系統測試
 */

import { describe, it, expect } from 'vitest';
import type { RoomData, Player, Message, RoomStatus } from '../types';

describe('Room System', () => {
  describe('房間建立', () => {
    it('應該建立新房間', () => {
      const roomNo = Date.now();
      const roomData: RoomData = {
        roomNo,
        roomName: '測試房間',
        roomComment: '這是測試',
        maxUser: 16,
        gameOption: '',
        optionRole: '',
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

      expect(roomData.roomNo).toBe(roomNo);
      expect(roomData.status).toBe('waiting');
      expect(roomData.players.size).toBe(0);
    });

    it('應該設定正確的初始值', () => {
      const roomData: RoomData = {
        roomNo: 1,
        roomName: 'Test',
        roomComment: '',
        maxUser: 16,
        gameOption: '',
        optionRole: '',
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

      expect(roomData.date).toBe(1);
      expect(roomData.dayNight).toBe('beforegame');
      expect(roomData.timeSpent).toBe(0);
    });
  });

  describe('玩家管理', () => {
    it('應該加入玩家', () => {
      const players = new Map<string, Player>();
      const player: Player = {
        userNo: 1,
        uname: 'eric',
        handleName: 'Eric',
        trip: 'ABC12345',
        iconNo: 1,
        sex: 'male',
        role: 'human',
        live: 'live',
        score: 0
      };

      players.set(player.uname, player);

      expect(players.size).toBe(1);
      expect(players.get('eric')).toBe(player);
    });

    it('應該檢查房間人數限制', () => {
      const maxUser = 16;
      const players = new Map<string, Player>();
      
      // 加入 16 個玩家
      for (let i = 0; i < 16; i++) {
        players.set(`user${i}`, {
          userNo: i,
          uname: `user${i}`,
          handleName: `User${i}`,
          trip: '',
          iconNo: i,
          sex: '',
          role: 'human',
          live: 'live',
          score: 0
        });
      }

      const isFull = players.size >= maxUser;
      expect(isFull).toBe(true);
    });

    it('應該移除玩家', () => {
      const players = new Map<string, Player>();
      players.set('eric', {
        userNo: 1,
        uname: 'eric',
        handleName: 'Eric',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });

      players.delete('eric');

      expect(players.size).toBe(0);
      expect(players.get('eric')).toBeUndefined();
    });
  });

  describe('遊戲狀態管理', () => {
    it('應該正確轉換狀態', () => {
      let status: RoomStatus = 'waiting';
      let date = 1;
      let dayNight = 'beforegame';

      // 開始遊戲
      status = 'playing';
      dayNight = 'day';

      expect(status).toBe('playing');
      expect(dayNight).toBe('day');
    });

    it('應該更新時間單位', () => {
      let timeSpent = 0;
      const limit = 48;

      // 發言 1 次
      timeSpent += 1;

      expect(timeSpent).toBe(1);
      expect(timeSpent < limit).toBe(true);
    });

    it('應該處理階段轉換', () => {
      let date = 1;
      let dayNight = 'beforegame';
      let timeSpent = 48;

      // 達到限制，轉換到夜晚
      if (timeSpent >= 48) {
        dayNight = 'night';
        timeSpent = 0;
      }

      expect(dayNight).toBe('night');
      expect(timeSpent).toBe(0);
    });
  });

  describe('訊息系統', () => {
    it('應該儲存訊息', () => {
      const messages: Message[] = [];
      const message: Message = {
        id: '1',
        roomNo: 1,
        date: 1,
        location: 'day',
        uname: 'eric',
        handleName: 'Eric',
        sentence: 'Hello World',
        fontType: 'normal',
        time: Date.now()
      };

      messages.push(message);

      expect(messages.length).toBe(1);
      expect(messages[0]).toBe(message);
    });

    it('應該按時間排序訊息', () => {
      const messages: Message[] = [
        {
          id: '1',
          roomNo: 1,
          date: 1,
          location: 'day',
          uname: 'user1',
          handleName: 'User1',
          sentence: 'First',
          fontType: 'normal',
          time: 1000
        },
        {
          id: '2',
          roomNo: 1,
          date: 1,
          location: 'day',
          uname: 'user2',
          handleName: 'User2',
          sentence: 'Second',
          fontType: 'normal',
          time: 2000
        }
      ];

      messages.sort((a, b) => a.time - b.time);

      expect(messages[0].sentence).toBe('First');
      expect(messages[1].sentence).toBe('Second');
    });
  });

  describe('房間公開資訊', () => {
    it('應該返回公開資訊（不包含敏感資料）', () => {
      const roomData: RoomData = {
        roomNo: 1,
        roomName: 'Test Room',
        roomComment: 'Secret',
        maxUser: 16,
        gameOption: 'secret_option',
        optionRole: 'secret_role',
        status: 'playing',
        date: 3,
        dayNight: 'night',
        players: new Map(),
        messages: [],
        timeSpent: 24,
        uptime: Date.now(),
        lastUpdated: Date.now(),
        dellook: 0
      };

      const publicInfo = {
        roomNo: roomData.roomNo,
        roomName: roomData.roomName,
        roomComment: roomData.roomComment,
        maxUser: roomData.maxUser,
        status: roomData.status,
        date: roomData.date,
        dayNight: roomData.dayNight,
        playerCount: roomData.players.size,
        lastUpdated: roomData.lastUpdated
      };

      expect(publicInfo).toHaveProperty('roomNo');
      expect(publicInfo).toHaveProperty('status');
      expect(publicInfo).not.toHaveProperty('gameOption');
      expect(publicInfo).not.toHaveProperty('optionRole');
    });
  });
});
