import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    // Increase timeout for DB operations
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
