/**
 * Cloudflare Workers Cron Trigger
 * 定期掃描並清理殘留房間（兜底機制）
 * 
 * 透過 Durable Object alarm 喚醒 DO 來執行清理，
 * 確保即使 DO 已被 evict 也能透過此機制清理 DB 殘留資料。
 */

import type { Env } from './types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Starting stale room cleanup scan...');

    const now = Date.now();
    const staleThreshold = 2 * 60 * 60 * 1000; // 2 小時

    try {
      // 查找所有殘留房間：ended 超過 30 分鐘，或 playing/waiting 超過 2 小時無活動
      const endedThreshold = 30 * 60 * 1000; // 30 分鐘
      const staleResult = await env.DB.prepare(`
        SELECT room_no, status, last_updated 
        FROM room 
        WHERE 
          (status = 'ended' AND last_updated < ?)
          OR ((status = 'playing' OR status = 'waiting') AND last_updated < ?)
      `).bind(now - endedThreshold, now - staleThreshold).all();

      // 補強：沒有任何存活真人（排除 dummy_boy）的房間，10 分鐘後就清掉
      // 避免 UI 長期堆積「看起來沒人在玩的殘留房」。
      const emptyRoomThreshold = 10 * 60 * 1000; // 10 分鐘
      const emptyResult = await env.DB.prepare(`
        SELECT r.room_no, r.status, r.last_updated
        FROM room r
        LEFT JOIN user_entry u
          ON u.room_no = r.room_no
         AND u.user_no > 0
         AND u.live = 'live'
         AND u.uname <> 'dummy_boy'
        GROUP BY r.room_no
        HAVING COUNT(u.uname) = 0
           AND r.last_updated < ?
      `).bind(now - emptyRoomThreshold).all();

      const merged = new Map<number, any>();
      for (const room of (staleResult.results as any[])) {
        merged.set(room.room_no, room);
      }
      for (const room of (emptyResult.results as any[])) {
        merged.set(room.room_no, room);
      }
      const rooms = Array.from(merged.values());

      if (rooms.length === 0) {
        console.log('[Cron] No stale/empty rooms found');
        return;
      }

      console.log(`[Cron] Found ${rooms.length} stale/empty rooms to clean up`);

      let cleaned = 0;
      let failed = 0;

      for (const room of rooms) {
        try {
          // 透過 DO 通知清理（這會喚醒 DO 並觸發 /cleanup）
          const id = env.WEREWOLF_ROOM.idFromName(room.room_no.toString());
          const stub = env.WEREWOLF_ROOM.get(id);
          const response = await stub.fetch(new Request('https://internal/cleanup', { method: 'POST' }));

          if (response.ok) {
            cleaned++;
          } else {
            // 如果 DO 喚醒失敗（例如 storage 已被清空），直接清理 D1
            console.log(`[Cron] DO cleanup returned ${response.status} for room ${room.room_no}, cleaning D1 directly`);
            await env.DB.batch([
              env.DB.prepare('DELETE FROM talk WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM vote_history WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM game_events WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM user_entry WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM wills WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM whispers WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM spectators WHERE room_no = ?').bind(room.room_no),
              env.DB.prepare('DELETE FROM room WHERE room_no = ?').bind(room.room_no),
            ]);
            cleaned++;
          }
        } catch (e) {
          console.error(`[Cron] Failed to clean room ${room.room_no}:`, e);
          failed++;
        }
      }

      console.log(`[Cron] Cleanup completed: ${cleaned} cleaned, ${failed} failed`);
    } catch (e) {
      console.error('[Cron] Cleanup scan error:', e);
    }
  },
};
