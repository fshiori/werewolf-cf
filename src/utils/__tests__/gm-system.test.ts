/**
 * GM (Game Master) 系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { RoomData, Player } from '../../types';
import {
  isGM,
  canUseHeavenChat,
  isValidGMAction,
  gmKill,
  gmResurrect,
  gmChangeRole,
  gmMark,
  gmDemmark,
  gmBroadcast,
  createHeavenMessage,
  createGMWhisper,
  getHeavenRecipients,
  executeGMAction
} from '../gm-system';

// Helper: 建立測試用房間資料
function createTestRoom(): RoomData {
  return {
    roomNo: 1,
    roomName: 'Test Room',
    roomComment: '',
    maxUser: 16,
    status: 'playing',
    date: 1,
    dayNight: 'day',
    timeSpent: 0,
    uptime: Date.now(),
    lastUpdated: Date.now(),
    dellook: 0,
    gameOption: '',
    optionRole: '',
    players: new Map()
  };
}

// Helper: 建立測試用玩家
function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    userNo: 1,
    uname: 'player1',
    handleName: 'Player1',
    trip: '',
    iconNo: 1,
    sex: 'male',
    role: 'human',
    live: 'live',
    score: 0,
    ...overrides
  };
}

describe('GM System', () => {
  describe('isGM', () => {
    it('應該正確識別 GM 玩家', () => {
      const gm = createTestPlayer({ role: 'GM', uname: 'gm1' });
      expect(isGM(gm)).toBe(true);
    });

    it('非 GM 玩家應該返回 false', () => {
      const human = createTestPlayer({ role: 'human' });
      expect(isGM(human)).toBe(false);
    });

    it('undefined 玩家應該返回 false', () => {
      expect(isGM(undefined)).toBe(false);
    });
  });

  describe('canUseHeavenChat', () => {
    it('死亡玩家可以使用天國聊天', () => {
      const dead = createTestPlayer({ live: 'dead' });
      expect(canUseHeavenChat(dead)).toBe(true);
    });

    it('存活玩家不能使用天國聊天', () => {
      const alive = createTestPlayer({ live: 'live' });
      expect(canUseHeavenChat(alive)).toBe(false);
    });

    it('undefined 玩家不能使用天國聊天', () => {
      expect(canUseHeavenChat(undefined)).toBe(false);
    });
  });

  describe('isValidGMAction', () => {
    it('應該接受所有有效的 GM 行動', () => {
      const validActions = ['GM_KILL', 'GM_RESU', 'GM_CHROLE', 'GM_MARK', 'GM_DEMARK', 'GM_CHANNEL', 'GM_DECL'];
      for (const action of validActions) {
        expect(isValidGMAction(action)).toBe(true);
      }
    });

    it('應該拒絕無效的 GM 行動', () => {
      expect(isValidGMAction('INVALID')).toBe(false);
      expect(isValidGMAction('gm_kill')).toBe(false);  // 大小寫敏感
      expect(isValidGMAction('')).toBe(false);
      expect(isValidGMAction('kill')).toBe(false);
    });
  });

  describe('gmKill', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', handleName: 'GM', role: 'GM' }));
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice' }));
      room.players.set('player2', createTestPlayer({ uname: 'player2', handleName: 'Bob' }));
    });

    it('GM 應該能殺害存活玩家', () => {
      const result = gmKill(room, 'player1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Alice');
      expect(room.players.get('player1')!.live).toBe('dead');
      expect(room.players.get('player1')!.death).toBeDefined();
    });

    it('不能殺害已死亡的玩家', () => {
      room.players.get('player1')!.live = 'dead';
      const result = gmKill(room, 'player1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('已經死亡');
    });

    it('不能殺害 GM 自己', () => {
      const result = gmKill(room, 'gm');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能殺害自己');
    });

    it('找不到的玩家應該返回錯誤', () => {
      const result = gmKill(room, 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('找不到');
    });
  });

  describe('gmResurrect', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', handleName: 'GM', role: 'GM' }));
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice', live: 'dead', death: Date.now() }));
    });

    it('GM 應該能復活已死亡的玩家', () => {
      const result = gmResurrect(room, 'player1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Alice');
      expect(room.players.get('player1')!.live).toBe('live');
      expect(room.players.get('player1')!.death).toBeUndefined();
    });

    it('不能復活仍然存活的玩家', () => {
      room.players.get('player1')!.live = 'live';
      const result = gmResurrect(room, 'player1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('仍然存活');
    });

    it('不能復活 GM 自己', () => {
      room.players.get('gm')!.live = 'dead';
      const result = gmResurrect(room, 'gm');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能復活自己');
    });

    it('找不到的玩家應該返回錯誤', () => {
      const result = gmResurrect(room, 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('找不到');
    });
  });

  describe('gmChangeRole', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice', role: 'human' }));
    });

    it('應該能變更玩家角色', () => {
      const result = gmChangeRole(room, 'player1', 'wolf');
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.role).toBe('wolf');
      expect(result.message).toContain('human');
      expect(result.message).toContain('wolf');
    });

    it('不能將玩家變成 GM', () => {
      const result = gmChangeRole(room, 'player1', 'GM');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能將玩家變成 GM');
      expect(room.players.get('player1')!.role).toBe('human');
    });

    it('找不到的玩家應該返回錯誤', () => {
      const result = gmChangeRole(room, 'nonexistent', 'wolf');
      expect(result.success).toBe(false);
      expect(result.message).toContain('找不到');
    });
  });

  describe('gmMark / gmDemmark', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice' }));
    });

    it('應該能標記玩家', () => {
      const result = gmMark(room, 'player1');
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.marked).toBe(1);
      expect(result.message).toContain('標記');
    });

    it('不能重複標記已標記的玩家', () => {
      room.players.get('player1')!.marked = 1;
      const result = gmMark(room, 'player1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('已經被標記');
    });

    it('應該能取消玩家標記', () => {
      room.players.get('player1')!.marked = 1;
      const result = gmDemmark(room, 'player1');
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.marked).toBeUndefined();
      expect(result.message).toContain('取消');
    });

    it('不能取消未標記的玩家', () => {
      const result = gmDemmark(room, 'player1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('尚未被標記');
    });

    it('找不到的玩家應該返回錯誤（mark）', () => {
      const result = gmMark(room, 'nonexistent');
      expect(result.success).toBe(false);
    });

    it('找不到的玩家應該返回錯誤（demark）', () => {
      const result = gmDemmark(room, 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('gmBroadcast', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', handleName: 'GM', role: 'GM' }));
    });

    it('應該建立 GM 廣播訊息', () => {
      const msg = gmBroadcast(room, 'gm', '系統公告：遊戲暫停');
      expect(msg).not.toBeNull();
      expect(msg!.sentence).toBe('系統公告：遊戲暫停');
      expect(msg!.fontType).toBe('strong');
      expect(msg!.uname).toBe('gm');
      expect(msg!.roomNo).toBe(1);
    });

    it('空訊息應該返回 null', () => {
      expect(gmBroadcast(room, 'gm', '')).toBeNull();
      expect(gmBroadcast(room, 'gm', '   ')).toBeNull();
    });

    it('不存在的 GM 也應該能廣播', () => {
      const msg = gmBroadcast(room, 'unknown_gm', 'test');
      expect(msg).not.toBeNull();
      expect(msg!.handleName).toBe('unknown_gm');
    });
  });

  describe('createHeavenMessage', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('dead1', createTestPlayer({ uname: 'dead1', handleName: 'Dead1', live: 'dead' }));
    });

    it('應該建立天國聊天訊息', () => {
      const msg = createHeavenMessage(room, 'dead1', '天國好無聊');
      expect(msg).not.toBeNull();
      expect(msg!.sentence).toBe('天國好無聊');
      expect(msg!.fontType).toBe('heaven');
      expect(msg!.uname).toBe('dead1');
      expect(msg!.handleName).toBe('Dead1');
    });

    it('空訊息應該返回 null', () => {
      expect(createHeavenMessage(room, 'dead1', '')).toBeNull();
      expect(createHeavenMessage(room, 'dead1', '   ')).toBeNull();
    });
  });

  describe('createGMWhisper', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', handleName: 'GM', role: 'GM' }));
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice' }));
    });

    it('應該建立 GM 私訊', () => {
      const whisper = createGMWhisper(room, 'gm', 'player1', '注意你的行為');
      expect(whisper).not.toBeNull();
      expect(whisper!.targetMessage.fontType).toBe('gm_to');
      expect(whisper!.targetMessage.sentence).toBe('注意你的行為');
      expect(whisper!.gmMessage.fontType).toBe('to_gm');
      expect(whisper!.gmMessage.sentence).toContain('Alice');
      expect(whisper!.gmMessage.sentence).toContain('注意你的行為');
    });

    it('空訊息應該返回 null', () => {
      expect(createGMWhisper(room, 'gm', 'player1', '')).toBeNull();
    });

    it('不存在的目標應該返回 null', () => {
      expect(createGMWhisper(room, 'gm', 'nonexistent', 'test')).toBeNull();
    });
  });

  describe('getHeavenRecipients', () => {
    it('應該返回死亡玩家和 GM', () => {
      const room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', role: 'GM' }));
      room.players.set('alive1', createTestPlayer({ uname: 'alive1', live: 'live' }));
      room.players.set('dead1', createTestPlayer({ uname: 'dead1', live: 'dead' }));
      room.players.set('dead2', createTestPlayer({ uname: 'dead2', live: 'dead' }));

      const recipients = getHeavenRecipients(room.players);
      expect(recipients).toContain('gm');
      expect(recipients).toContain('dead1');
      expect(recipients).toContain('dead2');
      expect(recipients).not.toContain('alive1');
      expect(recipients.length).toBe(3);
    });

    it('GM 即使存活也應該收到天國訊息', () => {
      const room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', role: 'GM', live: 'live' }));
      room.players.set('dead1', createTestPlayer({ uname: 'dead1', live: 'dead' }));

      const recipients = getHeavenRecipients(room.players);
      expect(recipients).toContain('gm');
      expect(recipients).toContain('dead1');
      expect(recipients.length).toBe(2);
    });

    it('沒有死亡玩家時應該只返回 GM', () => {
      const room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', role: 'GM' }));
      room.players.set('alive1', createTestPlayer({ uname: 'alive1', live: 'live' }));

      const recipients = getHeavenRecipients(room.players);
      expect(recipients).toEqual(['gm']);
    });

    it('沒有 GM 時應該只返回死亡玩家', () => {
      const room = createTestRoom();
      room.players.set('dead1', createTestPlayer({ uname: 'dead1', live: 'dead' }));
      room.players.set('alive1', createTestPlayer({ uname: 'alive1', live: 'live' }));

      const recipients = getHeavenRecipients(room.players);
      expect(recipients).toEqual(['dead1']);
    });
  });

  describe('executeGMAction', () => {
    let room: RoomData;

    beforeEach(() => {
      room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', handleName: 'GameMaster', role: 'GM' }));
      room.players.set('player1', createTestPlayer({ uname: 'player1', handleName: 'Alice', role: 'human' }));
      room.players.set('player2', createTestPlayer({ uname: 'player2', handleName: 'Bob', role: 'wolf' }));
    });

    it('GM_KILL 應該殺害玩家並產生廣播訊息', () => {
      const result = executeGMAction(room, 'gm', 'GM_KILL', 'player1');
      expect(result.success).toBe(true);
      expect(result.broadcastMessage).toBeDefined();
      expect(result.broadcastMessage!.fontType).toBe('strong');
      expect(room.players.get('player1')!.live).toBe('dead');
    });

    it('GM_RESU 應該復活死亡玩家並產生廣播訊息', () => {
      room.players.get('player1')!.live = 'dead';
      const result = executeGMAction(room, 'gm', 'GM_RESU', 'player1');
      expect(result.success).toBe(true);
      expect(result.broadcastMessage).toBeDefined();
      expect(room.players.get('player1')!.live).toBe('live');
    });

    it('GM_CHROLE 應該變更玩家角色', () => {
      const result = executeGMAction(room, 'gm', 'GM_CHROLE', 'player1', undefined, 'fox' as any);
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.role).toBe('fox');
      // 角色變更不產生廣播訊息
      expect(result.broadcastMessage).toBeUndefined();
    });

    it('GM_CHROLE 沒指定角色應該失敗', () => {
      const result = executeGMAction(room, 'gm', 'GM_CHROLE', 'player1');
      expect(result.success).toBe(false);
      expect(result.resultMessage).toContain('未指定');
    });

    it('GM_MARK 應該標記玩家', () => {
      const result = executeGMAction(room, 'gm', 'GM_MARK', 'player1');
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.marked).toBe(1);
    });

    it('GM_DEMARK 應該取消標記', () => {
      room.players.get('player1')!.marked = 1;
      const result = executeGMAction(room, 'gm', 'GM_DEMARK', 'player1');
      expect(result.success).toBe(true);
      expect(room.players.get('player1')!.marked).toBeUndefined();
    });

    it('GM_CHANNEL 應該產生廣播訊息', () => {
      const result = executeGMAction(room, 'gm', 'GM_CHANNEL', undefined, '系統公告');
      expect(result.success).toBe(true);
      expect(result.broadcastMessage).toBeDefined();
      expect(result.broadcastMessage!.sentence).toBe('系統公告');
      expect(result.broadcastMessage!.fontType).toBe('strong');
    });

    it('GM_CHANNEL 空訊息應該失敗', () => {
      const result = executeGMAction(room, 'gm', 'GM_CHANNEL', undefined, '');
      expect(result.success).toBe(false);
    });

    it('GM_DECL 應該成功', () => {
      const result = executeGMAction(room, 'gm', 'GM_DECL');
      expect(result.success).toBe(true);
      expect(result.resultMessage).toContain('拒絕');
    });

    it('無效行動應該失敗', () => {
      const result = executeGMAction(room, 'gm', 'INVALID_ACTION' as any);
      expect(result.success).toBe(false);
      expect(result.resultMessage).toContain('未知');
    });
  });

  describe('權限檢查', () => {
    it('非 GM 玩家不能使用 GM 行動（在 handleClientMessage 層級）', () => {
      const player = createTestPlayer({ role: 'human', live: 'live' });
      expect(isGM(player)).toBe(false);
    });

    it('GM 玩家在死亡後仍可使用 GM 行動', () => {
      const gm = createTestPlayer({ role: 'GM', live: 'dead' });
      expect(isGM(gm)).toBe(true);
    });

    it('存活 GM 不應該被當作天國使用者', () => {
      const gm = createTestPlayer({ role: 'GM', live: 'live' });
      // GM 看到天國訊息是因為 getHeavenRecipients 檢查 role === 'GM'
      // 但 canUseHeavenChat 檢查的是 live === 'dead'
      expect(canUseHeavenChat(gm)).toBe(false);
    });

    it('死亡 GM 可以使用天國聊天', () => {
      const gm = createTestPlayer({ role: 'GM', live: 'dead' });
      expect(canUseHeavenChat(gm)).toBe(true);
    });
  });

  describe('broadcastTo 整合測試', () => {
    it('天國訊息應該只發送給正確的接收者', () => {
      const room = createTestRoom();
      room.players.set('gm', createTestPlayer({ uname: 'gm', role: 'GM', live: 'live' }));
      room.players.set('alive1', createTestPlayer({ uname: 'alive1', live: 'live' }));
      room.players.set('dead1', createTestPlayer({ uname: 'dead1', live: 'dead' }));
      room.players.set('dead2', createTestPlayer({ uname: 'dead2', live: 'dead' }));

      const recipients = getHeavenRecipients(room.players);

      // 模擬 WebSocket sessions
      const sessions = new Map<string, { sent: string[] }>();
      sessions.set('gm', { sent: [] });
      sessions.set('alive1', { sent: [] });
      sessions.set('dead1', { sent: [] });
      sessions.set('dead2', { sent: [] });

      // 模擬 broadcastTo 行為
      const message = JSON.stringify({ type: 'message', data: { fontType: 'heaven' } });
      for (const uname of recipients) {
        const ws = sessions.get(uname);
        if (ws) {
          ws.sent.push(message);
        }
      }

      // 驗證只有正確的接收者收到訊息
      expect(sessions.get('gm')!.sent.length).toBe(1);
      expect(sessions.get('dead1')!.sent.length).toBe(1);
      expect(sessions.get('dead2')!.sent.length).toBe(1);
      expect(sessions.get('alive1')!.sent.length).toBe(0);
    });
  });
});
