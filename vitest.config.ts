import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // Increase timeout for DB operations
    testTimeout: 10000,
    // Integration tests share one PGlite instance per worker; run sequentially
    // so sessions/credentials created in one file are visible to the next.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
