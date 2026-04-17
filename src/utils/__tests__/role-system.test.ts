import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Player, Role } from '../../types';
import { assignRoles, getLoverChainVictims, getBetrayerCollapseVictims } from '../role-system';

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

describe('lovers chain death parity helpers', () => {
  it('當新死亡名單含戀人時，回傳其他存活戀人作為殉情名單', () => {
    const players = new Map<string, Player>([
      ['a', { ...createPlayer('a'), role: 'lovers' }],
      ['b', { ...createPlayer('b'), role: 'lovers' }],
      ['c', { ...createPlayer('c'), role: 'human' }],
    ]);

    const victims = getLoverChainVictims(players, ['a']);
    expect(victims.map(v => v.uname)).toEqual(['b']);
  });

  it('若新死亡名單不含戀人，則不會觸發殉情', () => {
    const players = new Map<string, Player>([
      ['a', { ...createPlayer('a'), role: 'lovers' }],
      ['b', { ...createPlayer('b'), role: 'lovers' }],
      ['c', { ...createPlayer('c'), role: 'human' }],
    ]);

    const victims = getLoverChainVictims(players, ['c']);
    expect(victims).toHaveLength(0);
  });

  it('已在新死亡名單中的戀人不重複回傳', () => {
    const players = new Map<string, Player>([
      ['a', { ...createPlayer('a'), role: 'lovers' }],
      ['b', { ...createPlayer('b'), role: 'lovers' }],
    ]);

    const victims = getLoverChainVictims(players, ['a', 'b']);
    expect(victims).toHaveLength(0);
  });
});

describe('betrayer collapse parity helpers', () => {
  it('妖狐全滅時，存活背德者應被回傳', () => {
    const players = new Map<string, Player>([
      ['betr', { ...createPlayer('betr'), role: 'betr' }],
      ['fox', { ...createPlayer('fox'), role: 'fox', live: 'dead' }],
      ['fosi', { ...createPlayer('fosi'), role: 'fosi', live: 'dead' }],
      ['human', { ...createPlayer('human'), role: 'human' }],
    ]);

    const victims = getBetrayerCollapseVictims(players);
    expect(victims.map(v => v.uname)).toEqual(['betr']);
  });

  it('仍有任一妖狐存活時，背德者不會連動死亡', () => {
    const players = new Map<string, Player>([
      ['betr', { ...createPlayer('betr'), role: 'betr' }],
      ['fox', { ...createPlayer('fox'), role: 'fox' }],
    ]);

    const victims = getBetrayerCollapseVictims(players);
    expect(victims).toHaveLength(0);
  });
});
