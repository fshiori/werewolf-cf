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
      const result = await env.DB.prepare(`
        SELECT room_no, status, last_updated 
        FROM room 
        WHERE 
          (status = 'ended' AND last_updated < ?)
          OR ((status = 'playing' OR status = 'waiting') AND last_updated < ?)
      `).bind(now - endedThreshold, now - staleThreshold).all();

      const rooms = result.results as any[];
      if (rooms.length === 0) {
        console.log('[Cron] No stale rooms found');
        return;
      }

      console.log(`[Cron] Found ${rooms.length} stale rooms to clean up`);

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
