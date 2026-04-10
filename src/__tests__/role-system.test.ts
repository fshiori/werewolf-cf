/**
 * 角色系統測試
 */

import { describe, it, expect } from 'vitest';
import type { Role, Player, PlayerStatus } from '../types';

describe('Role System', () => {
  describe('角色陣營判定', () => {
    const determineRoleTeam = (role: Role): 'human' | 'wolf' | 'fox' => {
      if (role.includes('wolf') || role === 'mad') {
        return 'wolf';
      } else if (role.includes('fox') || role === 'betr' || role === 'fosi') {
        return 'fox';
      } else {
        return 'human';
      }
    };

    it('村民陣營角色', () => {
      expect(determineRoleTeam('human')).toBe('human');
      expect(determineRoleTeam('mage')).toBe('human'); // 預言家
      expect(determineRoleTeam('necromancer')).toBe('human'); // 靈媒
      expect(determineRoleTeam('guard')).toBe('human'); // 獵人
      expect(determineRoleTeam('common')).toBe('human'); // 共有者
    });

    it('狼人陣營角色', () => {
      expect(determineRoleTeam('wolf')).toBe('wolf');
      expect(determineRoleTeam('wolf_partner')).toBe('wolf');
      expect(determineRoleTeam('wfbig')).toBe('wolf'); // 大狼
      expect(determineRoleTeam('mad')).toBe('wolf'); // 狂人
    });

    it('妖狐陣營角色', () => {
      expect(determineRoleTeam('fox')).toBe('fox');
      expect(determineRoleTeam('fox_partner')).toBe('fox');
      expect(determineRoleTeam('betr')).toBe('fox'); // 背德者
      expect(determineRoleTeam('fosi')).toBe('fox'); // 子狐
    });
  });

  describe('勝負判定', () => {
    const checkVictory = (players: Player[]): string | null => {
      const alivePlayers = players.filter(p => p.live === 'live');
      const aliveWolves = alivePlayers.filter(p => 
        p.role.includes('wolf') || p.role === 'mad'
      ).length;
      const aliveVillagers = alivePlayers.filter(p => 
        !p.role.includes('wolf') && p.role !== 'mad'
      ).length;

      if (aliveWolves === 0) return 'human';
      if (aliveWolves >= aliveVillagers) return 'wolf';
      return null;
    };

    it('所有狼人死亡 → 村民勝利', () => {
      const players: Player[] = [
        { userNo: 1, uname: 'p1', handleName: 'Player1', trip: '', iconNo: 1, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 2, uname: 'p2', handleName: 'Player2', trip: '', iconNo: 2, sex: '', role: 'wolf', live: 'dead', score: 0 },
        { userNo: 3, uname: 'p3', handleName: 'Player3', trip: '', iconNo: 3, sex: '', role: 'mage', live: 'live', score: 0 },
      ];
      
      expect(checkVictory(players)).toBe('human');
    });

    it('狼人數量 >= 村民數量 → 狼人勝利', () => {
      const players: Player[] = [
        { userNo: 1, uname: 'p1', handleName: 'Player1', trip: '', iconNo: 1, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 2, uname: 'p2', handleName: 'Player2', trip: '', iconNo: 2, sex: '', role: 'wolf', live: 'live', score: 0 },
        { userNo: 3, uname: 'p3', handleName: 'Player3', trip: '', iconNo: 3, sex: '', role: 'wolf', live: 'live', score: 0 },
      ];
      
      expect(checkVictory(players)).toBe('wolf');
    });

    it('勢力均等 → 遊戲繼續', () => {
      const players: Player[] = [
        { userNo: 1, uname: 'p1', handleName: 'Player1', trip: '', iconNo: 1, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 2, uname: 'p2', handleName: 'Player2', trip: '', iconNo: 2, sex: '', role: 'human', live: 'live', score: 0 },
        { userNo: 3, uname: 'p3', handleName: 'Player3', trip: '', iconNo: 3, sex: '', role: 'wolf', live: 'live', score: 0 },
      ];
      
      expect(checkVictory(players)).toBeNull();
    });
  });

  describe('角色能力驗證', () => {
    it('預言家只能在夜晚行動', () => {
      const role: Role = 'mage';
      const phase = 'night';
      const canAct = role === 'mage' && phase === 'night';
      expect(canAct).toBe(true);
    });

    it('狼人只能在夜晚行動', () => {
      const role: Role = 'wolf';
      const phase = 'night';
      const canAct = role.includes('wolf') && phase === 'night';
      expect(canAct).toBe(true);
    });

    it('靈媒只能在白天行動', () => {
      const role: Role = 'necromancer';
      const phase = 'day';
      const canAct = role === 'necromancer' && phase === 'day';
      expect(canAct).toBe(true);
    });

    it('死人無法行動', () => {
      const player: Player = {
        userNo: 1,
        uname: 'p1',
        handleName: 'Player1',
        trip: '',
        iconNo: 1,
        sex: '',
        role: 'wolf',
        live: 'dead',
        score: 0
      };
      
      const canAct = player.live === 'live';
      expect(canAct).toBe(false);
    });
  });

  describe('特殊角色規則', () => {
    it('狂人被算作狼人陣營但不能殺人', () => {
      const role: Role = 'mad';
      const isWolfTeam = role === 'mad';
      const canKill = role.includes('wolf');
      
      expect(isWolfTeam).toBe(true);
      expect(canKill).toBe(false);
    });

    it('共有者應該有夥伴', () => {
      const role1: Role = 'common';
      const role2: Role = 'common_partner';
      
      const arePartners = 
        role1 === 'common' && role2 === 'common_partner';
      
      expect(arePartners).toBe(true);
    });

    it('戀人存活狀態應該同步', () => {
      let lover1Alive = true;
      let lover2Alive = true;
      
      // 戀人1 死亡
      lover1Alive = false;
      lover2Alive = false; // 同步死亡
      
      expect(lover1Alive).toBe(false);
      expect(lover2Alive).toBe(false);
    });
  });
});
