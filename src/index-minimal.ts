/**
 * 最小化測試 - 直接定義 DO
 */

import { WorkerEntrypoint, DurableObjectState } from 'cloudflare:workers';
import type { Env } from './types';

export class WerewolfRoom extends WorkerEntrypoint<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('Werewolf DO Works!');
  }
}

export default {
  fetch() {
    return new Response('Worker is alive');
  },
};
