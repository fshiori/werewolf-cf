import { describe, it, expect } from 'vitest';
import {
  NO_PRESENCE_CLEANUP_TTL_MS,
  resolveLastPresenceAt,
  shouldCleanupForNoPresence,
  shouldHideZombiePlayingRoom,
} from '../presence-cleanup';

describe('presence-cleanup helpers', () => {
  it('resolveLastPresenceAt 應依序回退 lastPresenceAt -> lastUpdated -> uptime', () => {
    const now = 1700000000000;
    expect(resolveLastPresenceAt({ lastPresenceAt: now - 1, now })).toBe(now - 1);
    expect(resolveLastPresenceAt({ lastUpdated: now - 2, now })).toBe(now - 2);
    expect(resolveLastPresenceAt({ uptime: now - 3, now })).toBe(now - 3);
    expect(resolveLastPresenceAt({ now })).toBe(now);
  });

  it('shouldCleanupForNoPresence: waiting/playing + 無 session + 超過 TTL => true', () => {
    const now = 1700000000000;
    expect(
      shouldCleanupForNoPresence({
        status: 'waiting',
        sessionsSize: 0,
        lastPresenceAt: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(true);

    expect(
      shouldCleanupForNoPresence({
        status: 'playing',
        sessionsSize: 0,
        lastPresenceAt: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(true);
  });

  it('shouldCleanupForNoPresence: 有 session 或非 waiting/playing => false', () => {
    const now = 1700000000000;

    expect(
      shouldCleanupForNoPresence({
        status: 'playing',
        sessionsSize: 1,
        lastPresenceAt: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(false);

    expect(
      shouldCleanupForNoPresence({
        status: 'ended',
        sessionsSize: 0,
        lastPresenceAt: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(false);
  });

  it('shouldHideZombiePlayingRoom: 僅在 playing + 0 人 + stale/空時間 時隱藏', () => {
    const now = 1700000000000;

    expect(
      shouldHideZombiePlayingRoom({
        status: 'playing',
        playerCount: 0,
        lastUpdated: null,
        now,
      })
    ).toBe(true);

    expect(
      shouldHideZombiePlayingRoom({
        status: 'playing',
        playerCount: 0,
        lastUpdated: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(true);

    expect(
      shouldHideZombiePlayingRoom({
        status: 'playing',
        playerCount: 1,
        lastUpdated: now - NO_PRESENCE_CLEANUP_TTL_MS - 999999,
        now,
      })
    ).toBe(false);

    expect(
      shouldHideZombiePlayingRoom({
        status: 'waiting',
        playerCount: 0,
        lastUpdated: now - NO_PRESENCE_CLEANUP_TTL_MS - 1,
        now,
      })
    ).toBe(false);
  });
});
