/**
 * Cloudflare Workers 主入口（更新版）
 */

import app from './routes/api';

// 匯出 Durable Object
export { Room } from './room/complete-room';

// 匯出 Workers
export default {
  fetch: app.fetch,
};
