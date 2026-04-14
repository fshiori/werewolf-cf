/**
 * 只用於測試 Durable Object export
 */

import { WorkerEntrypoint, DurableObjectState } from 'cloudflare:workers';
import type { Env } from './types';

export class TestWerewolfRoom extends WorkerEntrypoint<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('Test DO');
  }
}

export { TestWerewolfRoom as WerewolfRoom };

export default {
  fetch() {
    return new Response('Worker with DO');
  },
};
