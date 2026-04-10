/**
 * 夜晚行動測試
 */

import { describe, it, expect } from 'vitest';
import {
  createNightState,
  wolfKill,
  seerDivine,
  foxDivine,
  betrayerConvert,
  guardShoot,
  processNightResult,
  isNightActionsComplete,
  getNightSummary,
  randomWolfKill
} from '../night-action';
import type { Player } from '../types';

describe('Night Action System', () => {
  describe('建立夜晚狀態', () => {
    it('應該建立新的夜晚狀態', () => {
      const nightState = createNightState(1, 1);
      
      expect(nightState.roomNo).toBe(1);
      expect(nightState.date).toBe(1);
      expect(nightState.actions.length).toBe(0);
      expect(nightState.victims.length).toBe(0);
    });
  });

  describe('狼人殺人', () => {
    it('應該成功殺害目標', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('target1', {
        userNo: 1,
        uname: 'target1',
        handleName: 'Target1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      wolfKill(nightState, players, ['target1']);
      
      expect(nightState.victims).toContain('target1');
    });

    it('已死亡的玩家不應該被殺', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('deadPlayer', {
        userNo: 1,
        uname: 'deadPlayer',
        handleName: 'Dead',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'dead',
        score: 0
      });
      
      wolfKill(nightState, players, ['deadPlayer']);
      
      expect(nightState.victims).not.toContain('deadPlayer');
    });
  });

  describe('預言家占卜', () => {
    it('應該正確占卜狼人', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('seer', {
        userNo: 1,
        uname: 'seer',
        handleName: 'Seer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'mage',
        live: 'live',
        score: 0
      });
      
      players.set('wolf', {
        userNo: 2,
        uname: 'wolf',
        handleName: 'Wolf',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'wolf',
        live: 'live',
        score: 0
      });
      
      const result = seerDivine(nightState, players, 'seer', 'wolf');
      
      expect(result).toBe('wolf');
    });

    it('應該正確占卜村民', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('seer', {
        userNo: 1,
        uname: 'seer',
        handleName: 'Seer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'mage',
        live: 'live',
        score: 0
      });
      
      players.set('villager', {
        userNo: 2,
        uname: 'villager',
        handleName: 'Villager',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      const result = seerDivine(nightState, players, 'seer', 'villager');
      
      expect(result).toBe('human');
    });

    it('非預言家不應該能占卜', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('villager', {
        userNo: 1,
        uname: 'villager',
        handleName: 'Villager',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      const result = seerDivine(nightState, players, 'villager', 'target');
      
      expect(result).toBeNull();
    });
  });

  describe('妖狐占卜', () => {
    it('占卜妖狐應該毒死預言家', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('seer', {
        userNo: 1,
        uname: 'seer',
        handleName: 'Seer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'mage',
        live: 'live',
        score: 0
      });
      
      players.set('fox', {
        userNo: 2,
        uname: 'fox',
        handleName: 'Fox',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'fox',
        live: 'live',
        score: 0
      });
      
      const poisoned = foxDivine(nightState, players, 'seer', 'fox');
      
      expect(poisoned).toBe(true);
      expect(nightState.victims).toContain('seer');
    });

    it('占卜村民不應該中毒', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('seer', {
        userNo: 1,
        uname: 'seer',
        handleName: 'Seer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'mage',
        live: 'live',
        score: 0
      });
      
      players.set('villager', {
        userNo: 2,
        uname: 'villager',
        handleName: 'Villager',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      const poisoned = foxDivine(nightState, players, 'seer', 'villager');
      
      expect(poisoned).toBe(false);
      expect(nightState.victims).not.toContain('seer');
    });
  });

  describe('背德者轉化', () => {
    it('應該成功轉化村民', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('betrayer', {
        userNo: 1,
        uname: 'betrayer',
        handleName: 'Betrayer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'betr',
        live: 'live',
        score: 0
      });
      
      players.set('villager', {
        userNo: 2,
        uname: 'villager',
        handleName: 'Villager',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      const success = betrayerConvert(nightState, players, 'betrayer', 'villager');
      
      expect(success).toBe(true);
      expect(nightState.converted).toContain('villager');
      expect(players.get('villager')?.role).toBe('betr_partner');
    });

    it('不應該轉化非村民', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('betrayer', {
        userNo: 1,
        uname: 'betrayer',
        handleName: 'Betrayer',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'betr',
        live: 'live',
        score: 0
      });
      
      players.set('wolf', {
        userNo: 2,
        uname: 'wolf',
        handleName: 'Wolf',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'wolf',
        live: 'live',
        score: 0
      });
      
      const success = betrayerConvert(nightState, players, 'betrayer', 'wolf');
      
      expect(success).toBe(false);
    });
  });

  describe('獵人發動能力', () => {
    it('死亡獵人應該能射殺目標', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('guard', {
        userNo: 1,
        uname: 'guard',
        handleName: 'Guard',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'guard',
        live: 'dead',
        score: 0
      });
      
      players.set('target', {
        userNo: 2,
        uname: 'target',
        handleName: 'Target',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      const success = guardShoot(nightState, players, 'guard', 'target');
      
      expect(success).toBe(true);
      expect(players.get('target')?.live).toBe('dead');
    });

    it('存活獵人不應該能射擊', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('guard', {
        userNo: 1,
        uname: 'guard',
        handleName: 'Guard',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'guard',
        live: 'live',
        score: 0
      });
      
      const success = guardShoot(nightState, players, 'guard', 'target');
      
      expect(success).toBe(false);
    });
  });

  describe('處理夜晚結果', () => {
    it('應該標記受害者為死亡', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('victim1', {
        userNo: 1,
        uname: 'victim1',
        handleName: 'V1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });
      
      nightState.victims.push('victim1');
      
      const dead = processNightResult(nightState, players);
      
      expect(dead.length).toBe(1);
      expect(dead[0].live).toBe('dead');
    });
  });

  describe('夜晚行動完成檢查', () => {
    it('所有行動完成應該返回 true', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('wolf', {
        userNo: 1,
        uname: 'wolf',
        handleName: 'Wolf',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'wolf',
        live: 'live',
        score: 0
      });
      
      // 狼人已殺人
      nightState.actions.push({
        type: 'wolf_kill' as any,
        actor: 'wolf',
        target: 'victim'
      });
      
      expect(isNightActionsComplete(nightState, players)).toBe(true);
    });

    it('狼人未行動應該返回 false', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      
      players.set('wolf', {
        userNo: 1,
        uname: 'wolf',
        handleName: 'Wolf',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'wolf',
        live: 'live',
        score: 0
      });
      
      expect(isNightActionsComplete(nightState, players)).toBe(false);
    });
  });

  describe('夜晚摘要', () => {
    it('平安夜應該顯示正確訊息', () => {
      const nightState = createNightState(1, 1);
      const summary = getNightSummary(nightState);
      
      expect(summary).toBe('昨晚是平安夜');
    });

    it('有死亡應該顯示人數', () => {
      const nightState = createNightState(1, 1);
      nightState.victims.push('victim1', 'victim2');
      
      const summary = getNightSummary(nightState);
      
      expect(summary).toContain('2 人死亡');
    });
  });
});
