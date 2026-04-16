import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Player, Role } from '../../types';
import { assignRoles } from '../role-system';

function createPlayer(uname: string, wishRole: Role | 'none' = 'none'): Player {
  return {
    userNo: 1,
    uname,
    handleName: uname,
    trip: '',
    iconNo: 1,
    sex: 'male',
    wishRole,
    role: 'human',
    live: 'live',
    score: 0,
  };
}

describe('assignRoles wishRole parity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wishRole 啟用時，若角色池有該角色應優先分配', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const players = [
      createPlayer('alice', 'wolf'),
      createPlayer('bob', 'none'),
    ];

    assignRoles(players, { wolf: 1, human: 1 } as Record<Role, number>, { wishRoleEnabled: true });

    expect(players.find(p => p.uname === 'alice')?.role).toBe('wolf');
    expect(players.map(p => p.role).sort()).toEqual(['human', 'wolf']);
  });

  it('wishRole 啟用時，若希望角色不存在則回退一般分配', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const players = [
      createPlayer('alice', 'mage'),
      createPlayer('bob', 'none'),
    ];

    assignRoles(players, { wolf: 1, human: 1 } as Record<Role, number>, { wishRoleEnabled: true });

    expect(players.find(p => p.uname === 'alice')?.role).not.toBe('mage');
    expect(players.map(p => p.role).sort()).toEqual(['human', 'wolf']);
  });

  it('多人同時希望同角色時，只會分配到角色池可用數量', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const players = [
      createPlayer('alice', 'wolf'),
      createPlayer('bob', 'wolf'),
      createPlayer('carol', 'none'),
    ];

    assignRoles(players, { wolf: 1, human: 2 } as Record<Role, number>, { wishRoleEnabled: true });

    const wolfCount = players.filter(p => p.role === 'wolf').length;
    expect(wolfCount).toBe(1);
    expect(players.map(p => p.role).sort()).toEqual(['human', 'human', 'wolf']);
  });
});
