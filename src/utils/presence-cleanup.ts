/**
 * Presence-based cleanup helpers.
 */

export const PRESENCE_HEARTBEAT_MS = 30 * 1000;
export const NO_PRESENCE_CLEANUP_TTL_MS = 15 * 60 * 1000;

export function resolveLastPresenceAt(input: {
  lastPresenceAt?: number;
  lastUpdated?: number;
  uptime?: number;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  return input.lastPresenceAt || input.lastUpdated || input.uptime || now;
}

export function shouldCleanupForNoPresence(input: {
  status: string;
  sessionsSize: number;
  lastPresenceAt: number;
  now?: number;
  ttlMs?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? NO_PRESENCE_CLEANUP_TTL_MS;

  if (input.sessionsSize > 0) {
    return false;
  }

  if (input.status !== 'waiting' && input.status !== 'playing') {
    return false;
  }

  return now - input.lastPresenceAt > ttlMs;
}

export function shouldHideZombiePlayingRoom(input: {
  status: string;
  playerCount?: number;
  lastUpdated?: number | null;
  now?: number;
  ttlMs?: number;
}): boolean {
  if (input.status !== 'playing') {
    return false;
  }

  const playerCount = input.playerCount ?? 0;
  if (playerCount > 0) {
    return false;
  }

  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? NO_PRESENCE_CLEANUP_TTL_MS;
  const lastUpdated = input.lastUpdated ?? 0;

  if (!lastUpdated) {
    return true;
  }

  return now - lastUpdated > ttlMs;
}
