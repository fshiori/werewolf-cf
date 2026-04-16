/**
 * 投票系統測試
 */

import { describe, it, expect } from 'vitest';
import {
  createVoteData,
  addVote,
  removeVote,
  getVoteResult,
  isTie,
  calculateWeightedVotes,
  isVoteComplete,
  executeVote,
  clearVotes,
  getVoteStats,
  getVotedUsers,
  resolveWeightedVoteResult,
  filterVoteDisplay,
  resolveVoteDisplayMode,
  canVoteTarget,
} from '../vote-system';
import type { Player } from '../types';

describe('Vote System', () => {
  describe('建立投票資料', () => {
    it('應該建立新的投票資料', () => {
      const voteData = createVoteData(1, 1);
      
      expect(voteData.roomNo).toBe(1);
      expect(voteData.date).toBe(1);
      expect(voteData.votes.size).toBe(0);
      expect(voteData.voteCounts.size).toBe(0);
    });
  });

  describe('加入投票', () => {
    it('應該成功加入投票', () => {
      const voteData = createVoteData(1, 1);
      const success = addVote(voteData, 'player1', 'player2');
      
      expect(success).toBe(true);
      expect(voteData.votes.get('player1')).toBe('player2');
      expect(voteData.voteCounts.get('player2')).toBe(1);
    });

    it('應該累積票數', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'player2');
      addVote(voteData, 'player3', 'player2');
      
      expect(voteData.voteCounts.get('player2')).toBe(2);
    });

    it('重複投票應該失敗', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'player2');
      const success = addVote(voteData, 'player1', 'player3');
      
      expect(success).toBe(false);
    });
  });

  describe('取消投票', () => {
    it('應該成功取消投票', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'player2');
      const success = removeVote(voteData, 'player1');
      
      expect(success).toBe(true);
      expect(voteData.votes.has('player1')).toBe(false);
      expect(voteData.voteCounts.get('player2')).toBeFalsy(); // deleted when count reaches 0
    });

    it('取消不存在的投票應該失敗', () => {
      const voteData = createVoteData(1, 1);
      const success = removeVote(voteData, 'player1');
      
      expect(success).toBe(false);
    });
  });

  describe('投票結果', () => {
    it('應該返回得票最多的玩家', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetA');
      addVote(voteData, 'player3', 'targetB');
      
      const result = getVoteResult(voteData);
      
      expect(result).toEqual(['targetA']);
    });

    it('平手時應該返回多個玩家', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetB');
      
      const result = getVoteResult(voteData);
      
      expect(result).toContain('targetA');
      expect(result).toContain('targetB');
    });
  });

  describe('平手檢測', () => {
    it('應該檢測平手', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetB');
      
      expect(isTie(voteData)).toBe(true);
    });

    it('單一獲勝者不應該是平手', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetA');
      addVote(voteData, 'player3', 'targetB');
      
      expect(isTie(voteData)).toBe(false);
    });
  });

  describe('權重投票', () => {
    it('權力者投票應該算 2 票', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      
      players.set('player1', {
        userNo: 1,
        uname: 'player1',
        handleName: 'Player1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'authority',
        live: 'live',
        score: 0
      });
      
      players.set('player2', {
        userNo: 2,
        uname: 'player2',
        handleName: 'Player2',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetA');
      
      const weighted = calculateWeightedVotes(voteData, players);
      
      expect(weighted.get('targetA')).toBe(3); // 2 + 1
    });
  });

  describe('投票完成檢查', () => {
    it('所有人都投票應該完成', () => {
      const voteData = createVoteData(1, 1);
      const players: Player[] = [
        { userNo: 1, uname: 'p1', handleName: 'P1', trip: '', iconNo: 1, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 2, uname: 'p2', handleName: 'P2', trip: '', iconNo: 2, sex: '', role: 'human', live: 'live', score: 0 }
      ];
      
      addVote(voteData, 'p1', 'targetA');
      addVote(voteData, 'p2', 'targetA');
      
      expect(isVoteComplete(voteData, players)).toBe(true);
    });

    it('有人沒投票不應該完成', () => {
      const voteData = createVoteData(1, 1);
      const players: Player[] = [
        { userNo: 1, uname: 'p1', handleName: 'P1', trip: '', iconNo: 1, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 2, uname: 'p2', handleName: 'P2', trip: '', iconNo: 2, sex: '', role: 'human', live: 'live', score: 0 }
      ];
      
      addVote(voteData, 'p1', 'targetA');
      
      expect(isVoteComplete(voteData, players)).toBe(false);
    });
  });

  describe('處刑', () => {
    it('應該處決得票最多的玩家', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      
      players.set('targetA', {
        userNo: 1,
        uname: 'targetA',
        handleName: 'TargetA',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetA');
      
      const executed = executeVote(voteData, players);
      
      expect(executed.length).toBe(1);
      expect(executed[0].uname).toBe('targetA');
      expect(executed[0].live).toBe('dead');
    });

    it('平手時應該處決所有得票最高的玩家', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      
      players.set('targetA', {
        userNo: 1,
        uname: 'targetA',
        handleName: 'A',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      players.set('targetB', {
        userNo: 2,
        uname: 'targetB',
        handleName: 'B',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetB');
      
      const executed = executeVote(voteData, players);
      
      expect(executed.length).toBe(2);
    });
  });

  describe('權重投票解析 (resolveWeightedVoteResult)', () => {
    const makePlayer = (uname: string, role: string): Player => ({
      userNo: 1,
      uname,
      handleName: uname,
      trip: '',
      iconNo: 1,
      sex: '',
      role: role as any,
      live: 'live',
      score: 0
    });

    it('單一最高票應該處決該玩家', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('voter1', makePlayer('voter1', 'human'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('voter3', makePlayer('voter3', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      addVote(voteData, 'voter1', 'targetA');
      addVote(voteData, 'voter2', 'targetA');
      addVote(voteData, 'voter3', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(false);
      expect(result.revote).toBe(false);
      expect(result.executed.length).toBe(1);
      expect(result.executed[0].uname).toBe('targetA');
      expect(result.executed[0].live).toBe('dead');
    });

    it('authority 投票權重應算 2 票，可改變結果', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('authority', makePlayer('authority', 'authority'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('voter3', makePlayer('voter3', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      // authority 投 targetA (2票), voter2 投 targetB (1票), voter3 投 targetB (1票)
      // targetA = 2, targetB = 2 → 平手（但因為無 decide → revote）
      addVote(voteData, 'authority', 'targetA');
      addVote(voteData, 'voter2', 'targetB');
      addVote(voteData, 'voter3', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(true);
      expect(result.revote).toBe(true);
      expect(result.executed.length).toBe(0);
    });

    it('authority 加權投票可打破平手', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('authority', makePlayer('authority', 'authority'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      // authority 投 targetA (2票), voter2 投 targetB (1票)
      // targetA = 2, targetB = 1 → targetA wins
      addVote(voteData, 'authority', 'targetA');
      addVote(voteData, 'voter2', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(false);
      expect(result.revote).toBe(false);
      expect(result.executed.length).toBe(1);
      expect(result.executed[0].uname).toBe('targetA');
    });

    it('平手且無 decide 玩家 → revote=true', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('voter1', makePlayer('voter1', 'human'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      addVote(voteData, 'voter1', 'targetA');
      addVote(voteData, 'voter2', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(true);
      expect(result.revote).toBe(true);
      expect(result.executed.length).toBe(0);
    });

    it('平手且有 decide 玩家在平手者中 → 直接處決 decide 玩家', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('voter1', makePlayer('voter1', 'human'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'decide'));

      addVote(voteData, 'voter1', 'targetA');
      addVote(voteData, 'voter2', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(true);
      expect(result.revote).toBe(false);
      expect(result.executed.length).toBe(1);
      expect(result.executed[0].uname).toBe('targetB');
      expect(result.executed[0].live).toBe('dead');
    });

    it('平手但 decide 不在平手者中 → revote', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('voter1', makePlayer('voter1', 'human'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('voter3', makePlayer('voter3', 'decide'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      // voter3 is decide but votes for targetA (not in the tied targets)
      addVote(voteData, 'voter1', 'targetA');
      addVote(voteData, 'voter2', 'targetB');
      addVote(voteData, 'voter3', 'targetA');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(false);
      expect(result.revote).toBe(false);
      expect(result.executed.length).toBe(1);
      expect(result.executed[0].uname).toBe('targetA');
    });

    it('空投票 → 無處決', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('targetA', makePlayer('targetA', 'human'));

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.executed.length).toBe(0);
      expect(result.isTie).toBe(false);
      expect(result.revote).toBe(false);
    });

    it('多人平手中有 decide → 只處決 decide 玩家', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      players.set('voter1', makePlayer('voter1', 'human'));
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('voter3', makePlayer('voter3', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'decide'));
      players.set('targetC', makePlayer('targetC', 'human'));

      addVote(voteData, 'voter1', 'targetA');
      addVote(voteData, 'voter2', 'targetB');
      addVote(voteData, 'voter3', 'targetC');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(true);
      expect(result.revote).toBe(false);
      expect(result.executed.length).toBe(1);
      expect(result.executed[0].uname).toBe('targetB');
      // targetA and targetC should still be alive
      expect(players.get('targetA')!.live).toBe('live');
      expect(players.get('targetC')!.live).toBe('live');
    });

    it('已死亡的玩家不計入加權投票', () => {
      const voteData = createVoteData(1, 1);
      const players = new Map<string, Player>();
      const deadVoter = makePlayer('deadVoter', 'authority');
      deadVoter.live = 'dead';
      players.set('deadVoter', deadVoter);
      players.set('voter2', makePlayer('voter2', 'human'));
      players.set('voter3', makePlayer('voter3', 'human'));
      players.set('targetA', makePlayer('targetA', 'human'));
      players.set('targetB', makePlayer('targetB', 'human'));

      // deadVoter is authority but dead — should not count
      // voter2 → targetA (1), voter3 → targetB (1) → tie, no decide → revote
      addVote(voteData, 'deadVoter', 'targetA');
      addVote(voteData, 'voter2', 'targetA');
      addVote(voteData, 'voter3', 'targetB');

      const result = resolveWeightedVoteResult(voteData, players);

      expect(result.isTie).toBe(true);
      expect(result.revote).toBe(true);
    });
  });

  describe('清空投票', () => {
    it('應該清空所有投票', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      clearVotes(voteData);
      
      expect(voteData.votes.size).toBe(0);
      expect(voteData.voteCounts.size).toBe(0);
    });
  });

  describe('投票統計', () => {
    it('應該返回排序的投票統計', () => {
      const voteData = createVoteData(1, 1);
      
      addVote(voteData, 'player1', 'targetA');
      addVote(voteData, 'player2', 'targetA');
      addVote(voteData, 'player3', 'targetB');
      
      const stats = getVoteStats(voteData);
      
      expect(stats[0].uname).toBe('targetA');
      expect(stats[0].count).toBe(2);
      expect(stats[1].uname).toBe('targetB');
      expect(stats[1].count).toBe(1);
    });

    it('getVotedUsers 應回傳已投票玩家（依投票順序）', () => {
      const voteData = createVoteData(1, 1);
      addVote(voteData, 'alice', 'targetA');
      addVote(voteData, 'bob', 'targetB');
      addVote(voteData, 'carol', 'targetA');

      expect(getVotedUsers(voteData)).toEqual(['alice', 'bob', 'carol']);
    });
  });

  describe('voteDisplay (投票結果展示)', () => {
    it('mode 0 應完全隱藏投票資訊', () => {
      const voteData = createVoteData(1, 1);
      addVote(voteData, 'p1', 'targetA');
      addVote(voteData, 'p2', 'targetA');

      const display = filterVoteDisplay(voteData, 0);

      expect(display.showResults).toBe(false);
      expect(display.voteCounts).toEqual([]);
      expect(display.voterMap).toBeNull();
    });

    it('mode 1 應顯示完整投票資訊', () => {
      const voteData = createVoteData(1, 1);
      addVote(voteData, 'p1', 'targetA');
      addVote(voteData, 'p2', 'targetB');

      const display = filterVoteDisplay(voteData, 1);

      expect(display.showResults).toBe(true);
      expect(display.voteCounts.length).toBe(2);
      expect(display.voterMap).not.toBeNull();
      expect(display.voterMap!.length).toBe(2);
      expect(display.voterMap![0]).toEqual({ voter: 'p1', target: 'targetA' });
    });

    it('mode 2 應只顯示票數不顯示誰投給誰', () => {
      const voteData = createVoteData(1, 1);
      addVote(voteData, 'p1', 'targetA');
      addVote(voteData, 'p2', 'targetA');
      addVote(voteData, 'p3', 'targetB');

      const display = filterVoteDisplay(voteData, 2);

      expect(display.showResults).toBe(true);
      expect(display.voteCounts.length).toBe(2);
      expect(display.voterMap).toBeNull();
    });
  });

  describe('openVote / voteMe parity helpers', () => {
    const makeTarget = (uname: string, live: 'live' | 'dead' = 'live'): Player => ({
      userNo: 1,
      uname,
      handleName: uname,
      trip: '',
      iconNo: 1,
      sex: '',
      role: 'human',
      live,
      score: 0,
    });

    it('resolveVoteDisplayMode: voteDisplay=0 + openVote=true 應回傳匿名模式(2)', () => {
      expect(resolveVoteDisplayMode(0, true)).toBe(2);
    });

    it('resolveVoteDisplayMode: 明確 voteDisplay 應優先於 openVote', () => {
      expect(resolveVoteDisplayMode(1, true)).toBe(1);
      expect(resolveVoteDisplayMode(2, false)).toBe(2);
    });

    it('canVoteTarget: voteMe 關閉時不允許自投', () => {
      const players = new Map<string, Player>([
        ['alice', makeTarget('alice')],
        ['bob', makeTarget('bob')],
      ]);

      expect(canVoteTarget(players, 'alice', 'alice', false)).toBe(false);
      expect(canVoteTarget(players, 'alice', 'bob', false)).toBe(true);
    });

    it('canVoteTarget: voteMe 開啟時允許自投，但目標必須存活', () => {
      const players = new Map<string, Player>([
        ['alice', makeTarget('alice')],
        ['bob', makeTarget('bob', 'dead')],
      ]);

      expect(canVoteTarget(players, 'alice', 'alice', true)).toBe(true);
      expect(canVoteTarget(players, 'alice', 'bob', true)).toBe(false);
      expect(canVoteTarget(players, 'alice', 'ghost', true)).toBe(false);
    });
  });
});
