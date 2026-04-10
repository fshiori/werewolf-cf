import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        minified: true,
      },
    },
  },
});
