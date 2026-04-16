import { describe, it, expect } from 'vitest';
import type { Player } from '../types';
import { canWolfKillTarget } from '../night-action';

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

describe('night-action dummy_boy parity', () => {
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
});
