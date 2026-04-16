import type { Player } from '../types';

export type VisibilityConfig = {
  roomStatus?: string;
  dellookEnabled?: boolean;
};

export function sanitizePlayersForViewer(
  players: Map<string, Player>,
  viewerUname: string,
  config: VisibilityConfig = {}
): Array<{
  userNo: number;
  uname: string;
  handleName: string;
  trip: string;
  iconNo: number;
  live: string;
  role?: string;
}> {
  const viewer = players.get(viewerUname);
  const roomEnded = config.roomStatus === 'ended';
  const deadCanSeeAliveRoles = !!config.dellookEnabled && viewer?.live === 'dead';

  return Array.from(players.values()).map((p) => {
    const base = {
      userNo: p.userNo,
      uname: p.uname,
      handleName: p.handleName,
      trip: p.trip,
      iconNo: p.iconNo,
      live: p.live,
    };

    const revealRole =
      roomEnded ||
      p.uname === viewerUname ||
      (deadCanSeeAliveRoles && p.live === 'live');

    if (revealRole) {
      return { ...base, role: p.role };
    }

    return base;
  });
}
