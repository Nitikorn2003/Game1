import { defineConfig, devices } from '@playwright/test';
import pkg from './package.json' with { type: 'json' };

// Every game has its own port, so their play tests never talk to another game's server.
const url = `http://localhost:${pkg.config.e2ePort}/`;

/** Plays the built game in a phone-sized Chromium. Run `npm run build` first (npm run e2e does). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    ...devices['Pixel 7'],
    baseURL: url,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite preview --port ${pkg.config.e2ePort} --strictPort`,
    url,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
