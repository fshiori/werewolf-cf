import { describe, it, expect } from 'vitest';
import type { Player } from '../../types';
import { sanitizePlayersForViewer } from '../player-visibility';

function makePlayer(uname: string, role: string, live: 'live' | 'dead' = 'live'): Player {
  return {
    userNo: 1,
    uname,
    handleName: uname,
    trip: '',
    iconNo: 1,
    sex: '',
    role: role as any,
    live,
    score: 0,
  };
}

describe('player visibility (dellook parity)', () => {
  it('存活玩家只能看到自己角色', () => {
    const players = new Map<string, Player>([
      ['alice', makePlayer('alice', 'human', 'live')],
      ['bob', makePlayer('bob', 'wolf', 'live')],
    ]);

    const view = sanitizePlayersForViewer(players, 'alice', { roomStatus: 'playing', dellookEnabled: true });
    const alice = view.find((p) => p.uname === 'alice');
    const bob = view.find((p) => p.uname === 'bob');

    expect(alice?.role).toBe('human');
    expect(bob?.role).toBeUndefined();
  });

  it('死亡玩家在 dellook=true 時可看見存活玩家角色', () => {
    const players = new Map<string, Player>([
      ['alice', makePlayer('alice', 'human', 'dead')],
      ['bob', makePlayer('bob', 'wolf', 'live')],
      ['carol', makePlayer('carol', 'mage', 'dead')],
    ]);

    const view = sanitizePlayersForViewer(players, 'alice', { roomStatus: 'playing', dellookEnabled: true });
    const bob = view.find((p) => p.uname === 'bob');
    const carol = view.find((p) => p.uname === 'carol');

    expect(bob?.role).toBe('wolf');
    expect(carol?.role).toBeUndefined();
  });

  it('遊戲結束後所有玩家皆可看見全部角色', () => {
    const players = new Map<string, Player>([
      ['alice', makePlayer('alice', 'human', 'live')],
      ['bob', makePlayer('bob', 'wolf', 'dead')],
    ]);

    const view = sanitizePlayersForViewer(players, 'alice', { roomStatus: 'ended', dellookEnabled: false });
    expect(view.find((p) => p.uname === 'alice')?.role).toBe('human');
    expect(view.find((p) => p.uname === 'bob')?.role).toBe('wolf');
  });
});
