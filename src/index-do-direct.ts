/**
 * 只用於測試 Durable Object export - 直接定義
 */

import { WorkerEntrypoint, DurableObjectState } from 'cloudflare:workers';
import type { Env } from './types';

export class WerewolfRoom extends WorkerEntrypoint<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('Test DO');
  }
}

export default {
  fetch() {
    return new Response('Worker with DO');
  },
};
