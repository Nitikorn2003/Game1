import { defineConfig, devices } from '@playwright/test';

/** Plays the built game in a phone-sized Chromium. Run `npm run build` first (npm run e2e does). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4180/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4180 --strictPort',
    url: 'http://localhost:4180/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
