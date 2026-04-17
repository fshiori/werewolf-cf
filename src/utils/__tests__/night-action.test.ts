/**
 * 夜晚行動測試
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createNightState,
  wolfKill,
  seerDivine,
  fosiDivine,
  catResurrect,
  foxDivine,
  betrayerConvert,
  guardShoot,
  guardTarget,
  processNightResult,
  isNightActionsComplete,
  getNightSummary,
  randomWolfKill,
  canWolfKillTarget
} from '../night-action';
import type { Player } from '../types';

describe('Night Action System', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it('占卜大狼時可被偽裝為人類（隨機）', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.7 -> human
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

      players.set('wfbig', {
        userNo: 2,
        uname: 'wfbig',
        handleName: 'BigWolf',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'wfbig',
        live: 'live',
        score: 0
      });

      const result = seerDivine(nightState, players, 'seer', 'wfbig');
      expect(result).toBe('human');
    });

    it('占卜大狼時也可能被判定為狼人', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.95); // >= 0.7 -> wolf
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

      players.set('wfbig', {
        userNo: 2,
        uname: 'wfbig',
        handleName: 'BigWolf',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'wfbig',
        live: 'live',
        score: 0
      });

      const result = seerDivine(nightState, players, 'seer', 'wfbig');
      expect(result).toBe('wolf');
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

  describe('子狐占卜', () => {
    const makePlayer = (uname: string, role: Player['role']): Player => ({
      userNo: 0,
      uname,
      handleName: uname,
      trip: '',
      iconNo: 1,
      sex: '',
      role,
      live: 'live',
      score: 0
    });

    it('子狐可占出一般狼人', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // nofosi=false
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('fosi', makePlayer('fosi', 'fosi'));
      players.set('wolf', makePlayer('wolf', 'wolf'));

      const result = fosiDivine(nightState, players, 'fosi', 'wolf');

      expect(result).toBe('wolf');
      expect(nightState.divineResults.get('fosi')).toBe('wolf');
    });

    it('子狐占到大狼時可被偽裝為 human', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1)  // wfbig mask -> human
        .mockReturnValueOnce(0.99); // nofosi=false

      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('fosi', makePlayer('fosi', 'fosi'));
      players.set('wfbig', makePlayer('wfbig', 'wfbig'));

      const result = fosiDivine(nightState, players, 'fosi', 'wfbig');
      expect(result).toBe('human');
    });

    it('子狐結果可被偽裝為 nofosi', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.61 => nofosi
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('fosi', makePlayer('fosi', 'fosi'));
      players.set('human', makePlayer('human', 'human'));

      const result = fosiDivine(nightState, players, 'fosi', 'human');
      expect(result).toBe('nofosi');
    });

    it('非子狐角色不能使用子狐占卜', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('mage', makePlayer('mage', 'mage'));
      players.set('target', makePlayer('target', 'human'));

      const result = fosiDivine(nightState, players, 'mage', 'target');
      expect(result).toBeNull();
    });
  });

  describe('貓又秘術（CAT_DO）', () => {
    const makePlayer = (uname: string, role: Player['role'], live: 'live' | 'dead' = 'live'): Player => ({
      userNo: 0,
      uname,
      handleName: uname,
      trip: '',
      iconNo: 1,
      sex: '',
      role,
      live,
      score: 0
    });

    it('貓又可以提交 cat_resurrect 行動', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('cat', makePlayer('cat', 'cat'));
      players.set('dead1', makePlayer('dead1', 'human', 'dead'));

      const ok = catResurrect(nightState, players, 'cat', 'dead1');
      expect(ok).toBe(true);
      expect(nightState.actions.some(a => a.type === 'cat_resurrect' && a.actor === 'cat')).toBe(true);
    });

    it('貓又被狼咬時可觸發不死，且當晚秘術失效', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.01) // cat被咬不死
        .mockReturnValueOnce(0.01); // 即使秘術判定會成功，也應被 catBlocked 擋掉

      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('cat', makePlayer('cat', 'cat'));
      players.set('dead1', makePlayer('dead1', 'human', 'dead'));

      nightState.victims.push('cat');
      catResurrect(nightState, players, 'cat', 'dead1');

      const dead = processNightResult(nightState, players);
      expect(players.get('cat')?.live).toBe('live');
      expect(players.get('dead1')?.live).toBe('dead');
      expect(dead.some(p => p.uname === 'cat')).toBe(false);
    });

    it('貓又未被封鎖且機率命中時可復活目標', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01);

      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('cat', makePlayer('cat', 'cat'));
      players.set('dead1', makePlayer('dead1', 'human', 'dead'));

      catResurrect(nightState, players, 'cat', 'dead1');
      const dead = processNightResult(nightState, players);

      expect(players.get('dead1')?.live).toBe('live');
      expect(dead.some(p => p.uname === 'dead1')).toBe(false);
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

    it('夜晚毒系死亡應反噴一名狼人', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // pick first wolf
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();

      players.set('poisoner', {
        userNo: 1,
        uname: 'poisoner',
        handleName: 'Poisoner',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'poison',
        live: 'live',
        score: 0
      });
      players.set('wolf1', {
        userNo: 2,
        uname: 'wolf1',
        handleName: 'Wolf1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'wolf',
        live: 'live',
        score: 0
      });
      players.set('human1', {
        userNo: 3,
        uname: 'human1',
        handleName: 'Human1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'human',
        live: 'live',
        score: 0
      });

      nightState.victims.push('poisoner');
      const dead = processNightResult(nightState, players);

      expect(dead.map(p => p.uname)).toContain('poisoner');
      expect(dead.map(p => p.uname)).toContain('wolf1');
      expect(players.get('wolf1')?.live).toBe('dead');
      expect(players.get('human1')?.live).toBe('live');
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

    it('有存活子狐但未行動應返回 false', () => {
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
      players.set('fosi', {
        userNo: 2,
        uname: 'fosi',
        handleName: 'Fosi',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'fosi',
        live: 'live',
        score: 0
      });

      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      expect(isNightActionsComplete(nightState, players)).toBe(false);
    });

    it('子狐行動後夜晚可完成', () => {
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
      players.set('fosi', {
        userNo: 2,
        uname: 'fosi',
        handleName: 'Fosi',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'fosi',
        live: 'live',
        score: 0
      });

      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      nightState.actions.push({ type: 'fosi_divine' as any, actor: 'fosi', target: 'target1' });
      expect(isNightActionsComplete(nightState, players)).toBe(true);
    });

    it('有存活貓又但未行動應返回 false', () => {
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
      players.set('cat', {
        userNo: 2,
        uname: 'cat',
        handleName: 'Cat',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'cat',
        live: 'live',
        score: 0
      });

      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      expect(isNightActionsComplete(nightState, players)).toBe(false);
    });

    it('貓又提交 cat_resurrect 後夜晚可完成', () => {
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
      players.set('cat', {
        userNo: 2,
        uname: 'cat',
        handleName: 'Cat',
        trip: '',
        iconNo: 2,
        sex: '',
        role: 'cat',
        live: 'live',
        score: 0
      });
      players.set('dead1', {
        userNo: 3,
        uname: 'dead1',
        handleName: 'Dead1',
        trip: '',
        iconNo: 3,
        sex: '',
        role: 'human',
        live: 'dead',
        score: 0
      });

      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      nightState.actions.push({ type: 'cat_resurrect' as any, actor: 'cat', target: 'dead1' });
      expect(isNightActionsComplete(nightState, players)).toBe(true);
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

  describe('守護者保護', () => {
    const makePlayer = (uname: string, role: string, live: 'live' | 'dead' = 'live'): Player => ({
      userNo: 0, uname, handleName: uname, trip: '', iconNo: 1, sex: '', role: role as Player['role'], live, score: 0
    });

    it('guardTarget 應該設定 guardedTarget', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('target1', makePlayer('target1', 'human'));

      const result = guardTarget(nightState, players, 'guard', 'target1');

      expect(result).toBe(true);
      expect(nightState.guardedTarget).toBe('target1');
    });

    it('guardTarget 不能守護自己', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));

      const result = guardTarget(nightState, players, 'guard', 'guard');

      expect(result).toBe(false);
      expect(nightState.guardedTarget).toBeUndefined();
    });

    it('guardTarget 目標必須存活', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('deadTarget', makePlayer('deadTarget', 'human', 'dead'));

      const result = guardTarget(nightState, players, 'guard', 'deadTarget');

      expect(result).toBe(false);
      expect(nightState.guardedTarget).toBeUndefined();
    });

    it('guardTarget 不能連續兩晚守護同一人', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('target1', makePlayer('target1', 'human'));

      // 第一晚守護成功
      guardTarget(nightState, players, 'guard', 'target1');

      // 第二晚同一個 NightState 不應允許重複設定同一人
      const result = guardTarget(nightState, players, 'guard', 'target1');

      expect(result).toBe(false);
    });

    it('非守護者角色不能使用 guardTarget', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('villager', makePlayer('villager', 'human'));
      players.set('target1', makePlayer('target1', 'human'));

      const result = guardTarget(nightState, players, 'villager', 'target1');

      expect(result).toBe(false);
    });

    it('wolfKill 被守護的目標不應加入受害者', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('target1', makePlayer('target1', 'human'));

      // 先守護
      guardTarget(nightState, players, 'guard', 'target1');

      // 狼人攻擊被守護的目標
      wolfKill(nightState, players, ['target1']);

      expect(nightState.victims).not.toContain('target1');
    });

    it('wolfKill 未被守護的目標應正常加入受害者', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('guard', makePlayer('guard', 'guard'));
      players.set('target1', makePlayer('target1', 'human'));
      players.set('target2', makePlayer('target2', 'human'));

      // 守護 target1
      guardTarget(nightState, players, 'guard', 'target1');

      // 狼人攻擊 target2
      wolfKill(nightState, players, ['target2']);

      expect(nightState.victims).toContain('target2');
      expect(nightState.victims).not.toContain('target1');
    });
  });

  describe('守護者行動完成檢查', () => {
    const makePlayer = (uname: string, role: string, live: 'live' | 'dead' = 'live'): Player => ({
      userNo: 0, uname, handleName: uname, trip: '', iconNo: 1, sex: '', role: role as Player['role'], live, score: 0
    });

    it('有存活守護者但未行動應返回 false', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('guard', makePlayer('guard', 'guard'));

      // 狼人已行動
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });

      // 守護者未行動
      expect(isNightActionsComplete(nightState, players)).toBe(false);
    });

    it('有存活守護者已行動應返回 true', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('guard', makePlayer('guard', 'guard'));

      // 狼人已行動
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      // 守護者已行動
      nightState.actions.push({ type: 'guard_protect' as any, actor: 'guard', target: 'target1' });

      expect(isNightActionsComplete(nightState, players)).toBe(true);
    });

    it('沒有存活守護者不要求守護行動', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('guard', makePlayer('guard', 'guard', 'dead'));

      // 狼人已行動
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });

      expect(isNightActionsComplete(nightState, players)).toBe(true);
    });

    it('守護者跳過行動也算完成', () => {
      const nightState = createNightState(1, 1);
      const players = new Map<string, Player>();
      players.set('wolf', makePlayer('wolf', 'wolf'));
      players.set('guard', makePlayer('guard', 'guard'));

      // 狼人已行動
      nightState.actions.push({ type: 'wolf_kill' as any, actor: 'wolf', target: 'victim' });
      // 守護者跳過
      nightState.actions.push({ type: 'skip' as any, actor: 'guard' });

      expect(isNightActionsComplete(nightState, players)).toBe(true);
    });
  });

  describe('守護者夜晚摘要', () => {
    it('守護成功保護一人應在摘要中提及', () => {
      const nightState = createNightState(1, 1);
      nightState.guardedTarget = 'target1';
      // 模擬守護成功（有守護目標但無受害者 = 平安夜）
      const summary = getNightSummary(nightState);

      expect(summary).toContain('守護成功');
    });

    it('守護但仍有人死亡應顯示死亡和守護', () => {
      const nightState = createNightState(1, 1);
      nightState.guardedTarget = 'target1';
      nightState.victims.push('target2');
      const summary = getNightSummary(nightState);

      expect(summary).toContain('1 人死亡');
      expect(summary).toContain('守護成功');
    });

    it('無守護目標且平安夜不顯示守護資訊', () => {
      const nightState = createNightState(1, 1);
      const summary = getNightSummary(nightState);

      expect(summary).toBe('昨晚是平安夜');
    });
  });

  describe('dummy_boy 第一夜狼人目標限制', () => {
    const makePlayer = (
      uname: string,
      role: Player['role'],
      live: Player['live'] = 'live'
    ): Player => ({
      userNo: 1,
      uname,
      handleName: uname,
      trip: '',
      iconNo: 1,
      sex: '',
      role,
      live,
      score: 0,
    });

    it('dummy_boy 啟用且第 1 天夜晚：狼人只能投 dummy_boy', () => {
      const players = new Map<string, Player>([
        ['wolf1', makePlayer('wolf1', 'wolf')],
        ['dummy_boy', makePlayer('dummy_boy', 'human')],
        ['alice', makePlayer('alice', 'human')],
      ]);

      expect(canWolfKillTarget(players, 'wolf1', 'dummy_boy', 1, true)).toBe(true);
      expect(canWolfKillTarget(players, 'wolf1', 'alice', 1, true)).toBe(false);
    });

    it('dummy_boy 未啟用時：第 1 天夜晚可投一般非狼目標', () => {
      const players = new Map<string, Player>([
        ['wolf1', makePlayer('wolf1', 'wolf')],
        ['alice', makePlayer('alice', 'human')],
      ]);

      expect(canWolfKillTarget(players, 'wolf1', 'alice', 1, false)).toBe(true);
    });

    it('第 2 天後：dummy_boy 啟用也可投一般非狼目標', () => {
      const players = new Map<string, Player>([
        ['wolf1', makePlayer('wolf1', 'wolf')],
        ['dummy_boy', makePlayer('dummy_boy', 'human')],
        ['alice', makePlayer('alice', 'human')],
      ]);

      expect(canWolfKillTarget(players, 'wolf1', 'alice', 2, true)).toBe(true);
    });

    it('不能投自己或狼同伴', () => {
      const players = new Map<string, Player>([
        ['wolf1', makePlayer('wolf1', 'wolf')],
        ['wolf2', makePlayer('wolf2', 'wolf_partner')],
        ['alice', makePlayer('alice', 'human')],
      ]);

      expect(canWolfKillTarget(players, 'wolf1', 'wolf1', 2, false)).toBe(false);
      expect(canWolfKillTarget(players, 'wolf1', 'wolf2', 2, false)).toBe(false);
      expect(canWolfKillTarget(players, 'wolf1', 'alice', 2, false)).toBe(true);
    });

    it('不能投 GM（legacy parity）', () => {
      const players = new Map<string, Player>([
        ['wolf1', makePlayer('wolf1', 'wolf')],
        ['gm1', makePlayer('gm1', 'GM')],
      ]);

      expect(canWolfKillTarget(players, 'wolf1', 'gm1', 2, false)).toBe(false);
    });
  });
});
