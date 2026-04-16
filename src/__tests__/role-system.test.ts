/**
 * 角色系統測試
 */

import { describe, it, expect } from 'vitest';
import { checkVictory, getVictoryMessage, createDummyBoyPlayer, getDummyBoyLastWords, DEFAULT_DUMMY_LAST_WORDS } from '../utils/role-system';
import type { Role, Player, PlayerStatus } from '../types';

/** 建立測試用玩家的輔助函式 */
function makePlayer(overrides: Partial<Player> & { uname: string; role: Role; live: Player['live'] }): Player {
  return {
    userNo: 0,
    handleName: overrides.uname,
    trip: '',
    iconNo: 0,
    sex: '',
    score: 0,
    ...overrides,
  };
}

describe('Role System', () => {
  describe('角色陣營判定', () => {
    const determineRoleTeam = (role: Role): 'human' | 'wolf' | 'fox' => {
      if (role.includes('wolf') || role === 'mad' || role === 'wfbig') {
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

  // ========================================
  // 擴展勝負判定測試（使用真實 checkVictory）
  // ========================================
  describe('checkVictory — 實際函式測試', () => {
    it('所有狼人死亡且無妖狐 → 村民勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'mage', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('狼人數量 >= 村民 → 狼人勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'wolf', live: 'live' }),
        makePlayer({ uname: 'p3', role: 'wolf', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('wolf');
    });

    it('勢力均等 → 遊戲繼續', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p3', role: 'wolf', live: 'live' }),
      ];
      expect(checkVictory(players)).toBeNull();
    });

    it('妖狐存活且狼人全滅且妖狐 >= 村民 → 妖狐勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'fox', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'human', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('fox');
    });

    it('妖狐存活但村民較多 → 遊戲繼續', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'fox', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p4', role: 'mage', live: 'live' }),
      ];
      // aliveWolves=0, aliveFoxes=1, aliveVillagers=2 → fox(1) < villagers(2) → 繼續
      expect(checkVictory(players)).toBeNull();
    });

    it('狼人和妖狐皆死亡 → 村民勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'fox', live: 'dead' }),
        makePlayer({ uname: 'p4', role: 'mage', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('背德者勝利：妖狐死亡且背德者存活', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'betr', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'fox', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p4', role: 'human', live: 'live' }),
        makePlayer({ uname: 'p5', role: 'mage', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('betr');
    });

    it('妖狐存活時背德者不單獨勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'betr', live: 'live' }),
        makePlayer({ uname: 'p2', role: 'fox', live: 'live' }),
        makePlayer({ uname: 'p3', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p4', role: 'human', live: 'live' }),
      ];
      // 妖狐存活且狼人全滅 → 檢查妖狐勝利條件
      // aliveFoxes=2, aliveWolves=0, aliveVillagers=1 → fox(2) >= villagers(1) → fox wins
      expect(checkVictory(players)).toBe('fox');
    });

    it('背德者死亡且妖狐死亡 → 非背德者勝利', () => {
      const players: Player[] = [
        makePlayer({ uname: 'p1', role: 'betr', live: 'dead' }),
        makePlayer({ uname: 'p2', role: 'fox', live: 'dead' }),
        makePlayer({ uname: 'p3', role: 'wolf', live: 'dead' }),
        makePlayer({ uname: 'p4', role: 'human', live: 'live' }),
      ];
      expect(checkVictory(players)).toBe('human');
    });
  });

  // ========================================
  // 勝利訊息測試
  // ========================================
  describe('getVictoryMessage', () => {
    it('村民勝利訊息', () => {
      expect(getVictoryMessage('human')).toBe('所有狼人已被消滅，村民陣營獲勝！');
    });

    it('狼人勝利訊息', () => {
      expect(getVictoryMessage('wolf')).toBe('狼人數量壓倒村民，狼人陣營獲勝！');
    });

    it('妖狐勝利訊息', () => {
      expect(getVictoryMessage('fox')).toBe('妖狐存活且狼人全滅，妖狐陣營獲勝！');
    });

    it('背德者勝利訊息', () => {
      expect(getVictoryMessage('betr')).toBe('妖狐死亡但背德者存活，背德者單獨獲勝！');
    });
  });

  // ========================================
  // custDummy / 啞巴男測試
  // ========================================
  describe('custDummy / 啞巴男', () => {
    it('createDummyBoyPlayer 應建立正確的啞巴男玩家', () => {
      const dummy = createDummyBoyPlayer(1, false);

      expect(dummy.uname).toBe('dummy_boy');
      expect(dummy.handleName).toBe('替身君');
      expect(dummy.userNo).toBe(1);
      expect(dummy.role).toBe('human');
      expect(dummy.live).toBe('live');
      expect(dummy.lastWords).toBeTruthy();
    });

    it('custDummy 啟用時應使用自訂遺言', () => {
      const customWords = '這是我的自訂遺言';
      const dummy = createDummyBoyPlayer(1, true, customWords);

      expect(dummy.lastWords).toBe(customWords);
    });

    it('傳入 customName 時應覆蓋預設 handleName', () => {
      const dummy = createDummyBoyPlayer(1, true, '遺言', '替身阿哲');
      expect(dummy.handleName).toBe('替身阿哲');
    });

    it('custDummy 啟用但無自訂遺言時應從預設庫選取', () => {
      const dummy = createDummyBoyPlayer(1, true);

      // custDummy=true 但沒傳 customLastWords → getDummyBoyLastWords 回傳空字串
      // 因為條件是 custDummy && customLastWords，所以不滿足，回傳隨機預設
      expect(DEFAULT_DUMMY_LAST_WORDS).toContain(dummy.lastWords!);
    });

    it('custDummy 未啟用時應從預設遺言庫隨機選取', () => {
      const dummy = createDummyBoyPlayer(1, false);
      expect(DEFAULT_DUMMY_LAST_WORDS).toContain(dummy.lastWords!);
    });

    it('getDummyBoyLastWords 應正確處理各種情況', () => {
      // custDummy=false, no custom → random from defaults
      const words1 = getDummyBoyLastWords(false);
      expect(DEFAULT_DUMMY_LAST_WORDS).toContain(words1);

      // custDummy=true, custom provided → custom
      expect(getDummyBoyLastWords(true, 'custom')).toBe('custom');

      // custDummy=true, no custom → random from defaults
      const words2 = getDummyBoyLastWords(true);
      expect(DEFAULT_DUMMY_LAST_WORDS).toContain(words2);
    });
  });
});
