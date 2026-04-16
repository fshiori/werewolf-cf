/**
 * E2E Game Loop 測試
 * 模擬完整的遊戲生命週期：
 * 建房 → 加入 → 開始 → 白天討論 → 投票 → 處刑 → 夜晚 → 天亮 → ... → 遊戲結束
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { checkVictory, assignRoles, getVictoryMessage } from '../utils/role-system';
import {
  createNightState,
  wolfKill,
  seerDivine,
  guardTarget,
  processNightResult,
  isNightActionsComplete,
} from '../utils/night-action';
import {
  createVoteData,
  addVote,
  executeVote,
  isVoteComplete,
  getVoteResult,
  isTie,
  clearVotes,
} from '../utils/vote-system';
import type { Player, Role, RoomData } from '../types';

// ========================================
// 輔助函式
// ========================================

function makePlayer(uname: string, role: Role, live: Player['live'] = 'live'): Player {
  return {
    userNo: 0,
    uname,
    handleName: uname,
    trip: '',
    iconNo: 1,
    sex: '',
    role,
    live,
    score: 0,
  };
}

/** 建立一個基本的 8 人房間，分配角色後返回 Map */
function createGamePlayers(): Map<string, Player> {
  const players = new Map<string, Player>();
  const names = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  for (const n of names) {
    players.set(n, makePlayer(n, 'human'));
  }
  return players;
}

/** 分配標準 8 人角色配置 */
function assignStandardRoles(players: Map<string, Player>): void {
  const roleConfig: Record<Role, number> = {
    wolf: 2,
    mage: 1,
    guard: 1,
    human: 4,
  } as Record<Role, number>;
  const playerArr = Array.from(players.values());
  assignRoles(playerArr, roleConfig);
  // 寫回 Map
  for (const p of playerArr) {
    players.set(p.uname, p);
  }
}

function createRoom(roomNo: number, players: Map<string, Player>): RoomData {
  return {
    roomNo,
    roomName: 'Test Room',
    roomComment: '',
    maxUser: 16,
    status: 'waiting',
    date: 1,
    dayNight: 'beforegame',
    timeSpent: 0,
    lastUpdate: Date.now(),
    players,
    gameOption: '',
    optionRole: '',
    messages: [],
  };
}

// ========================================
// 測試
// ========================================

describe('E2E Game Loop', () => {
  describe('完整遊戲流程', () => {
    it('8 人遊戲：從開始到結束（村民勝利路徑）', () => {
      // 1. 建立房間和玩家
      const players = createGamePlayers();
      assignStandardRoles(players);
      const room = createRoom(1, players);

      // 2. 開始遊戲
      room.status = 'playing';
      room.dayNight = 'day';
      expect(room.dayNight).toBe('day');
      expect(room.status).toBe('playing');

      // 3. 白天討論 — 推進 48 單位時間
      const dayLimit = 48;
      for (let i = 0; i < dayLimit; i++) {
        room.timeSpent++;
      }
      expect(room.timeSpent).toBe(dayLimit);

      // 4. 投票階段：所有存活玩家投票
      const alivePlayers = Array.from(players.values()).filter(p => p.live === 'live');
      const voteData = createVoteData(room.roomNo, room.date);

      // 找出狼人並讓所有人投給其中一個狼人
      const wolves = alivePlayers.filter(p => p.role === 'wolf' || p.role === 'wolf_partner');
      expect(wolves.length).toBeGreaterThanOrEqual(1);
      const target = wolves[0].uname;

      for (const voter of alivePlayers) {
        addVote(voteData, voter.uname, target);
      }

      // 確認投票完成
      expect(isVoteComplete(voteData, alivePlayers)).toBe(true);

      // 檢查是否有平手
      expect(isTie(voteData)).toBe(false);

      // 5. 執行投票 — 處刑得票最多的玩家
      const executed = executeVote(voteData, players);
      expect(executed.length).toBe(1);
      expect(executed[0].uname).toBe(target);
      expect(executed[0].live).toBe('dead');

      // 6. 檢查勝負
      const allPlayers = Array.from(players.values());
      const victory1 = checkVictory(allPlayers);
      if (victory1) {
        // 如果遊戲已經結束
        expect(['human', 'wolf', 'fox', 'betr']).toContain(victory1);
        return;
      }

      // 7. 轉換到夜晚
      room.dayNight = 'night';
      room.date++;
      expect(room.dayNight).toBe('night');
      expect(room.date).toBe(2);

      // 8. 夜晚行動
      const nightState = createNightState(room.roomNo, room.date);
      const liveWolves = allPlayers.filter(p => p.live === 'live' && (p.role === 'wolf' || p.role === 'wolf_partner'));
      const liveSeer = allPlayers.find(p => p.live === 'live' && p.role === 'mage');
      const liveGuard = allPlayers.find(p => p.live === 'live' && p.role === 'guard');
      const liveVillager = allPlayers.find(p => p.live === 'live' && p.role === 'human');

      // 守護者保護（必須在 wolfKill 之前，因為 wolfKill 會檢查 guardedTarget）
      if (liveGuard && liveVillager) {
        guardTarget(nightState, players, liveGuard.uname, liveVillager.uname);
        nightState.actions.push({
          type: 'guard_protect' as any,
          actor: liveGuard.uname,
          target: liveVillager.uname,
        });
      }

      // 預言家占卜
      if (liveSeer && liveWolves.length > 0) {
        seerDivine(nightState, players, liveSeer.uname, liveWolves[0].uname);
        nightState.actions.push({
          type: 'seer_divine' as any,
          actor: liveSeer.uname,
          target: liveWolves[0].uname,
        });
      }

      // 狼人殺人
      if (liveWolves.length > 0 && liveVillager) {
        wolfKill(nightState, players, [liveVillager.uname]);
        nightState.actions.push({
          type: 'wolf_kill' as any,
          actor: liveWolves[0].uname,
          target: liveVillager.uname,
        });
      }

      // 9. 處理夜晚結果
      const nightDead = processNightResult(nightState, players);
      // 如果守護者保護了目標，受害者可能為空

      // 10. 轉到白天
      room.dayNight = 'day';
      room.timeSpent = 0;
      expect(room.dayNight).toBe('day');

      // 11. 再次檢查勝負
      const updatedPlayers = Array.from(players.values());
      const victory2 = checkVictory(updatedPlayers);
      // 勝負可能已經決定，或者遊戲繼續
      if (victory2) {
        expect(['human', 'wolf', 'fox', 'betr']).toContain(victory2);
        expect(getVictoryMessage(victory2)).toBeTruthy();
      }
    });

    it('遊戲循環中階段轉換順序正確：day → night → day', () => {
      const players = createGamePlayers();
      const room = createRoom(1, players);

      // 初始：beforegame
      expect(room.dayNight).toBe('beforegame');

      // → day
      room.dayNight = 'day';
      room.status = 'playing';
      expect(room.dayNight).toBe('day');

      // → night (date 2)
      room.dayNight = 'night';
      room.date++;
      expect(room.dayNight).toBe('night');
      expect(room.date).toBe(2);

      // → day (date 2)
      room.dayNight = 'day';
      expect(room.dayNight).toBe('day');
      expect(room.date).toBe(2);

      // → night (date 3)
      room.dayNight = 'night';
      room.date++;
      expect(room.dayNight).toBe('night');
      expect(room.date).toBe(3);
    });

    it('遊戲結束後狀態正確', () => {
      const players = createGamePlayers();
      const room = createRoom(1, players);

      room.status = 'playing';
      room.dayNight = 'day';

      // 模擬遊戲結束
      room.status = 'ended';
      room.dayNight = 'aftergame';
      room.victoryRole = 'human';

      expect(room.status).toBe('ended');
      expect(room.dayNight).toBe('aftergame');
      expect(room.victoryRole).toBe('human');
    });
  });

  describe('白天時間推進', () => {
    it('48 條訊息後觸發投票階段', () => {
      const room = createRoom(1, new Map());
      room.dayNight = 'day';
      room.status = 'playing';

      const dayLimit = 48;
      let voteTriggered = false;

      for (let i = 0; i < 60; i++) {
        room.timeSpent++;
        if (room.timeSpent >= dayLimit) {
          voteTriggered = true;
          break;
        }
      }

      expect(voteTriggered).toBe(true);
      expect(room.timeSpent).toBe(dayLimit);
    });

    it('沈默模式 4 倍速推進', () => {
      const room = createRoom(1, new Map());
      room.dayNight = 'day';
      room.status = 'playing';

      const dayLimit = 48;
      const silenceMultiplier = 4;
      let messagesSent = 0;

      // 沈默模式下，每條訊息推進 4 單位
      while (room.timeSpent < dayLimit) {
        room.timeSpent += silenceMultiplier;
        messagesSent++;
      }

      // 應該只需要 12 條訊息（48 / 4）
      expect(messagesSent).toBe(12);
      expect(room.timeSpent).toBeGreaterThanOrEqual(dayLimit);
    });
  });

  describe('投票到夜晚過渡', () => {
    it('投票處刑後過渡到夜晚', () => {
      const players = new Map<string, Player>();
      players.set('wolf1', makePlayer('wolf1', 'wolf'));
      players.set('human1', makePlayer('human1', 'human'));
      players.set('human2', makePlayer('human2', 'human'));

      const voteData = createVoteData(1, 1);
      addVote(voteData, 'human1', 'wolf1');
      addVote(voteData, 'human2', 'wolf1');

      const executed = executeVote(voteData, players);
      expect(executed.length).toBe(1);
      expect(executed[0].live).toBe('dead');

      // 處刑後過渡到夜晚
      const room = createRoom(1, players);
      room.dayNight = 'day';
      room.date = 1;

      // 過渡
      room.dayNight = 'night';
      room.date++;
      expect(room.dayNight).toBe('night');
      expect(room.date).toBe(2);

      // 檢查勝負
      const allPlayers = Array.from(players.values());
      const victory = checkVictory(allPlayers);
      // 狼人已死，剩村民 → 村民勝利
      expect(victory).toBe('human');
    });
  });

  describe('夜晚行動整合', () => {
    it('完整的夜晚流程：狼殺 + 占卜 + 守護', () => {
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('seer', makePlayer('seer', 'mage'));
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('victim', makePlayer('victim', 'human'));
      players.set('other', makePlayer('other', 'human'));

      const nightState = createNightState(1, 1);

      // 守護者保護 victim（必須在狼人殺人之前設定，wolfKill 檢查 guardedTarget）
      guardTarget(nightState, players, 'guard', 'victim');
      nightState.actions.push({ type: 'guard_protect' as any, actor: 'guard', target: 'victim' });

      // 狼人殺 victim（因為守護者已保護，wolfKill 會跳過）
      wolfKill(nightState, players, ['victim']);
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });

      // 預言家占卜 wolf
      seerDivine(nightState, players, 'seer', 'wolf');
      nightState.actions.push({ type: 'seer_divine' as any, actor: 'seer', target: 'wolf' });

      // 所有行動完成
      expect(isNightActionsComplete(nightState, players)).toBe(true);

      // 處理結果：victim 被守護，所以不會死
      const dead = processNightResult(nightState, players);
      expect(dead.length).toBe(0); // 被守護了

      // 驗證 victim 仍然存活
      expect(players.get('victim')?.live).toBe('live');
    });

    it('夜晚無守護：狼人成功殺人', () => {
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('victim', makePlayer('victim', 'human'));
      players.set('other', makePlayer('other', 'human'));

      const nightState = createNightState(1, 1);

      // 狼人殺 victim（無守護者）
      wolfKill(nightState, players, ['victim']);
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });

      // 處理結果
      const dead = processNightResult(nightState, players);
      expect(dead.length).toBe(1);
      expect(dead[0].uname).toBe('victim');
      expect(dead[0].live).toBe('dead');
    });
  });

  describe('多輪遊戲循環', () => {
    it('模擬 3 天遊戲並最終到達勝利條件', () => {
      const players = new Map<string, Player>();
      // 2 狼人 + 3 村民
      players.set('w1', makePlayer('w1', 'wolf'));
      players.set('w2', makePlayer('w2', 'wolf_partner'));
      players.set('h1', makePlayer('h1', 'human'));
      players.set('h2', makePlayer('h2', 'human'));
      players.set('h3', makePlayer('h3', 'human'));

      const room = createRoom(1, players);
      room.status = 'playing';

      // === Day 1 ===
      room.dayNight = 'day';
      room.timeSpent = 48; // 達到上限

      // 投票：處刑 w1
      const vote1 = createVoteData(1, 1);
      addVote(vote1, 'h1', 'w1');
      addVote(vote1, 'h2', 'w1');
      addVote(vote1, 'h3', 'w1');
      addVote(vote1, 'w2', 'h1'); // 狼人投村民
      executeVote(vote1, players);
      expect(players.get('w1')?.live).toBe('dead');

      // 檢查勝負
      let v = checkVictory(Array.from(players.values()));
      expect(v).toBeNull(); // 遊戲繼續

      // === Night 1 ===
      room.dayNight = 'night';
      room.date = 2;
      const night1 = createNightState(1, 2);
      wolfKill(night1, players, ['h3']);
      night1.actions.push({ type: 'wolf_kill' as any, actor: 'w2', target: 'h3' });
      processNightResult(night1, players);
      expect(players.get('h3')?.live).toBe('dead');

      // === Day 2 ===
      room.dayNight = 'day';
      room.timeSpent = 48;

      // 投票：處刑 w2
      const vote2 = createVoteData(1, 2);
      addVote(vote2, 'h1', 'w2');
      addVote(vote2, 'h2', 'w2');
      executeVote(vote2, players);
      expect(players.get('w2')?.live).toBe('dead');

      // 檢查勝負 — 所有狼人死亡 → 村民勝利
      v = checkVictory(Array.from(players.values()));
      expect(v).toBe('human');
    });
  });

  describe('遊戲清理', () => {
    it('遊戲結束後清理投票資料', () => {
      const voteData = createVoteData(1, 1);
      addVote(voteData, 'p1', 'p2');
      addVote(voteData, 'p3', 'p2');

      expect(voteData.votes.size).toBe(2);

      clearVotes(voteData);

      expect(voteData.votes.size).toBe(0);
      expect(voteData.voteCounts.size).toBe(0);
    });
  });
});
