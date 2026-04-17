/**
 * 勝利條件全面測試
 * 測試所有 4+ 勝利路徑：
 * - human: 村民勝利（所有狼人死亡）
 * - wolf: 狼人勝利（狼人 >= 村民）
 * - fox: 妖狐勝利（妖狐存活、狼人全滅、妖狐 >= 村民）
 * - betr: 背德者勝利（妖狐死亡、背德者存活、狼人全滅）
 * - lovers: 戀人勝利（僅剩戀人存活）
 * - draw: 平局 / force_end
 */

import { describe, it, expect } from 'vitest';
import { checkVictory, getVictoryMessage, assignRoles, getRoleTeam } from '../utils/role-system';
import type { Player, Role } from '../types';

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

// ========================================
// 測試
// ========================================

describe('Victory Conditions', () => {
  // ========================================
  // 村民勝利路徑
  // ========================================
  describe('村民勝利 (human)', () => {
    it('所有狼人死亡 → 村民勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('h3', 'mage'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('w2', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('所有狼人全滅、無妖狐 → 村民勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'guard'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('fox1', 'fox', 'dead'),
        makePlayer('betr1', 'betr', 'dead'),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('狂人死亡且狼人死亡 → 村民勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('mad1', 'mad', 'dead'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('大狼(wfbig)死亡 → 算狼人全滅', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('wfbig1', 'wfbig', 'dead'),
      ];
      expect(checkVictory(players)).toBe('human');
    });

    it('僅剩村民陣營存活（含靈媒、獵人、共有者等）', () => {
      const players: Player[] = [
        makePlayer('p1', 'human'),
        makePlayer('p2', 'mage'),
        makePlayer('p3', 'guard'),
        makePlayer('p4', 'necromancer'),
        makePlayer('p5', 'common'),
        makePlayer('p6', 'authority'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).toBe('human');
    });
  });

  // ========================================
  // 狼人勝利路徑
  // ========================================
  describe('狼人勝利 (wolf)', () => {
    it('狼人數量 >= 村民數量 → 狼人勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('w1', 'wolf'),
        makePlayer('w2', 'wolf'),
      ];
      expect(checkVictory(players)).toBe('wolf'); // 2 狼 >= 1 村民
    });

    it('狼人數量等於村民數量 → 狼人勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('w1', 'wolf'),
        makePlayer('w2', 'wolf'),
      ];
      expect(checkVictory(players)).toBe('wolf'); // 2 狼 >= 2 村民
    });

    it('大狼存活也算狼人陣營', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('wfbig1', 'wfbig'),
        makePlayer('w1', 'wolf'),
      ];
      expect(checkVictory(players)).toBe('wolf');
    });

    it('狂人存活時也算狼人陣營', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('mad1', 'mad'),
        makePlayer('w1', 'wolf'),
      ];
      expect(checkVictory(players)).toBe('wolf'); // 2 狼隊 >= 1 村民
    });

    it('含妖狐但狼人 >= 村民 → 狼人先勝利', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('fox1', 'fox'),
        makePlayer('w1', 'wolf'),
        makePlayer('w2', 'wolf'),
      ];
      // aliveWolves=2, aliveVillagers=1 → wolf wins
      expect(checkVictory(players)).toBe('wolf');
    });
  });

  // ========================================
  // 妖狐勝利路徑
  // ========================================
  describe('妖狐勝利 (fox)', () => {
    it('妖狐存活且狼人全滅且妖狐 >= 村民 → 妖狐勝利', () => {
      const players: Player[] = [
        makePlayer('fox1', 'fox'),
        makePlayer('h1', 'human'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      // aliveFoxes=1, aliveVillagers=1, aliveWolves=0 → fox >= villagers → fox wins
      expect(checkVictory(players)).toBe('fox');
    });

    it('妖狐 + 子狐存活且狼人全滅 → 妖狐勝利', () => {
      const players: Player[] = [
        makePlayer('fox1', 'fox'),
        makePlayer('fosi1', 'fosi'),
        makePlayer('h1', 'human'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      // aliveFoxes=2, aliveVillagers=1 → fox wins
      expect(checkVictory(players)).toBe('fox');
    });

    it('妖狐存活但村民較多 → 遊戲繼續', () => {
      const players: Player[] = [
        makePlayer('fox1', 'fox'),
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      // aliveFoxes=1, aliveVillagers=2 → fox < villagers → null
      expect(checkVictory(players)).toBeNull();
    });

    it('妖狐存活但狼人未滅 → 非妖狐勝利條件', () => {
      const players: Player[] = [
        makePlayer('fox1', 'fox'),
        makePlayer('w1', 'wolf'),
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('h3', 'human'),
      ];
      // aliveWolves=1, aliveVillagers=3 → 繼續
      expect(checkVictory(players)).toBeNull();
    });
  });

  // ========================================
  // 背德者勝利路徑
  // ========================================
  describe('背德者勝利 (betr)', () => {
    it('妖狐死亡且背德者存活且狼人全滅 → 背德者勝利', () => {
      const players: Player[] = [
        makePlayer('betr1', 'betr'),
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('fox1', 'fox', 'dead'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).toBe('betr');
    });

    it('背德者 + betr_partner 存活 → 背德者勝利', () => {
      const players: Player[] = [
        makePlayer('betr1', 'betr'),
        makePlayer('bp1', 'betr_partner'),
        makePlayer('fox1', 'fox', 'dead'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('h1', 'human'),
      ];
      expect(checkVictory(players)).toBe('betr');
    });

    it('妖狐存活時背德者不單獨勝利', () => {
      const players: Player[] = [
        makePlayer('betr1', 'betr'),
        makePlayer('fox1', 'fox'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('h1', 'human'),
      ];
      // aliveFoxes=2 (fox+betr), aliveWolves=0, aliveVillagers=1 → fox >= villagers → fox wins
      expect(checkVictory(players)).toBe('fox');
    });

    it('背德者死亡 → 非背德者勝利', () => {
      const players: Player[] = [
        makePlayer('betr1', 'betr', 'dead'),
        makePlayer('fox1', 'fox', 'dead'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('h1', 'human'),
      ];
      expect(checkVictory(players)).toBe('human');
    });
  });

  // ========================================
  // 戀人勝利路徑
  // ========================================
  describe('戀人勝利 (lovers)', () => {
    it('僅剩兩位戀人存活 → 戀人勝利', () => {
      const players: Player[] = [
        makePlayer('l1', 'lovers'),
        makePlayer('l2', 'lovers_partner'),
        makePlayer('w1', 'wolf', 'dead'),
        makePlayer('h1', 'human', 'dead'),
      ];
      expect(checkVictory(players)).toBe('lovers');
    });

    it('戀人存活但仍有其他角色存活 → 非戀人勝利', () => {
      const players: Player[] = [
        makePlayer('l1', 'lovers'),
        makePlayer('l2', 'lovers_partner'),
        makePlayer('h1', 'human'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).not.toBe('lovers');
    });
  });

  // ========================================
  // 平局 / 遊戲繼續
  // ========================================
  describe('平局 / 遊戲繼續', () => {
    it('勢力均等（村民多於狼人） → 遊戲繼續', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('w1', 'wolf'),
      ];
      // 2 村民 > 1 狼人 → 繼續
      expect(checkVictory(players)).toBeNull();
    });

    it('空玩家列表 → 遊戲繼續', () => {
      expect(checkVictory([])).toBeNull();
    });

    it('全員死亡 → 遊戲繼續 (null)', () => {
      const players: Player[] = [
        makePlayer('h1', 'human', 'dead'),
        makePlayer('w1', 'wolf', 'dead'),
      ];
      expect(checkVictory(players)).toBeNull();
    });

    it('村民比狼人多但妖狐+背德者均存活 → 繼續', () => {
      const players: Player[] = [
        makePlayer('h1', 'human'),
        makePlayer('h2', 'human'),
        makePlayer('h3', 'human'),
        makePlayer('w1', 'wolf'),
        makePlayer('fox1', 'fox'),
        makePlayer('betr1', 'betr'),
      ];
      // aliveWolves=1, aliveVillagers=3, aliveFoxes=1, aliveBetr=1 → 繼續
      expect(checkVictory(players)).toBeNull();
    });
  });

  // ========================================
  // 勝利訊息
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

    it('戀人勝利訊息', () => {
      expect(getVictoryMessage('lovers')).toBe('戀人存活至最後，戀人陣營獲勝！');
    });

    it('未知勝利陣營訊息', () => {
      expect(getVictoryMessage('draw')).toBe('投票多次平手，遊戲以平局結束。');
      expect(getVictoryMessage('godmode')).toBe('未知勝利陣營：godmode');
    });
  });

  // ========================================
  // 角色陣營判定
  // ========================================
  describe('角色陣營判定 (getRoleTeam)', () => {
    it('村民陣營角色', () => {
      expect(getRoleTeam('human')).toBe('human');
      expect(getRoleTeam('mage')).toBe('human');
      expect(getRoleTeam('guard')).toBe('human');
      expect(getRoleTeam('necromancer')).toBe('human');
      expect(getRoleTeam('common')).toBe('human');
      expect(getRoleTeam('common_partner')).toBe('human');
      expect(getRoleTeam('authority')).toBe('human');
      expect(getRoleTeam('poison')).toBe('human');
    });

    it('狼人陣營角色', () => {
      expect(getRoleTeam('wolf')).toBe('wolf');
      expect(getRoleTeam('wolf_partner')).toBe('wolf');
      expect(getRoleTeam('mad')).toBe('wolf');
      expect(getRoleTeam('wfbig')).toBe('wolf');
    });

    it('妖狐陣營角色', () => {
      expect(getRoleTeam('fox')).toBe('fox');
      expect(getRoleTeam('fosi')).toBe('fox');
      expect(getRoleTeam('betr')).toBe('fox');
      // betr_partner 不含 'fox' 也不等於 'betr'/'fosi'，實作中歸為 human
      expect(getRoleTeam('betr_partner')).toBe('human');
    });
  });

  // ========================================
  // 角色分配整合
  // ========================================
  describe('角色分配 + 勝利條件整合', () => {
    it('分配角色後檢查無勝利', () => {
      const players: Player[] = [
        makePlayer('p1', 'human'),
        makePlayer('p2', 'human'),
        makePlayer('p3', 'human'),
        makePlayer('p4', 'human'),
        makePlayer('p5', 'human'),
        makePlayer('p6', 'human'),
        makePlayer('p7', 'human'),
        makePlayer('p8', 'human'),
      ];

      const roleConfig: Record<Role, number> = {
        wolf: 2,
        mage: 1,
        fox: 1,
        guard: 1,
        human: 3,
      } as Record<Role, number>;

      assignRoles(players, roleConfig);

      // 所有玩家存活，遊戲應該繼續
      expect(checkVictory(players)).toBeNull();

      // 驗證至少分配了正確的角色數量
      const wolves = players.filter(p => p.role.includes('wolf')).length;
      expect(wolves).toBe(2);
    });
  });
});
