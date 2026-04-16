/**
 * Cloudflare Workers 主入口
 */

import app from './routes/api';
import scheduledHandler from './scheduled';

// Durable Object export
export { WerewolfRoom } from './room/complete-room';

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler.scheduled,
};
