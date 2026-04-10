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
  getVoteStats
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
      expect(voteData.voteCounts.get('player2')).toBe(0);
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
  });
});
