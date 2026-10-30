import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}', 'games/*/test/**/*.test.{ts,tsx}', 'templates/*/test/**/*.test.{ts,tsx}', 'tools/test/**/*.test.ts'],
    environment: 'node',
  },
});
