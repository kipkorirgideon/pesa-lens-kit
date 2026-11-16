import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Headless E2E against the production build served by `vite preview`.
 * `npm run e2e` builds first, so the preview server always serves current code.
 * Set PW_CHANNEL=chrome to use an installed Google Chrome instead of Playwright's own
 * Chromium (needed on macOS versions Playwright no longer ships a browser for).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
