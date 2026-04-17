import { describe, it, expect } from 'vitest';
import { getLegacyRoleTable, LEGACY_ROLE_TABLE } from '../role-config';

describe('legacy role table parity (setting.php)', () => {
  it('應覆蓋 8~30 全區間', () => {
    const keys = Object.keys(LEGACY_ROLE_TABLE).map(Number).sort((a, b) => a - b);
    expect(keys[0]).toBe(8);
    expect(keys[keys.length - 1]).toBe(30);
    expect(keys).toHaveLength(23);
  });

  it('21 人應為 3 狼（不是 fallback 到 22 或 30）', () => {
    const roles = getLegacyRoleTable(21);
    expect(roles).toHaveLength(21);
    expect(roles.filter(r => r === 'wolf')).toHaveLength(3);
    expect(roles.filter(r => r === 'fox')).toHaveLength(1);
  });

  it('23 人應為 4 狼（避免舊版 fallback 造成過量狼）', () => {
    const roles = getLegacyRoleTable(23);
    expect(roles).toHaveLength(23);
    expect(roles.filter(r => r === 'wolf')).toHaveLength(4);
    expect(roles.filter(r => r === 'fox')).toHaveLength(1);
  });

  it('29 人應有雙占雙靈與 5 狼', () => {
    const roles = getLegacyRoleTable(29);
    expect(roles).toHaveLength(29);
    expect(roles.filter(r => r === 'wolf')).toHaveLength(5);
    expect(roles.filter(r => r === 'mage')).toHaveLength(2);
    expect(roles.filter(r => r === 'necromancer')).toHaveLength(2);
  });

  it('超出範圍時應 clamp 到 8/30', () => {
    expect(getLegacyRoleTable(0)).toEqual(LEGACY_ROLE_TABLE[8]);
    expect(getLegacyRoleTable(999)).toEqual(LEGACY_ROLE_TABLE[30]);
  });
});
