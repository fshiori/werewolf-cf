import { describe, it, expect } from 'vitest';
import { buildStartGameVoteState } from '../start-game';

describe('start-game vote state', () => {
  it('全員已投票時 ready=true', () => {
    const state = buildStartGameVoteState(['alice', 'bob'], ['alice', 'bob']);

    expect(state.votedUsers).toEqual(['alice', 'bob']);
    expect(state.votedCount).toBe(2);
    expect(state.totalRequired).toBe(2);
    expect(state.ready).toBe(true);
  });

  it('未全員投票時 ready=false', () => {
    const state = buildStartGameVoteState(['alice'], ['alice', 'bob']);

    expect(state.votedCount).toBe(1);
    expect(state.totalRequired).toBe(2);
    expect(state.ready).toBe(false);
  });

  it('會清掉不在 waiting 名單內的舊投票者', () => {
    const state = buildStartGameVoteState(['alice', 'left_user'], ['alice', 'bob']);

    expect(state.votedUsers).toEqual(['alice']);
    expect(state.votedCount).toBe(1);
    expect(state.totalRequired).toBe(2);
    expect(state.ready).toBe(false);
  });

  it('沒有 waiting 玩家時 ready=false', () => {
    const state = buildStartGameVoteState(['alice'], []);

    expect(state.votedCount).toBe(0);
    expect(state.totalRequired).toBe(0);
    expect(state.ready).toBe(false);
  });
});
