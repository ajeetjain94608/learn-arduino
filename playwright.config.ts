import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // 10 s: several 3D browsers start at once during a test run on this PC; real start-up is measured on the phone.
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  use: { baseURL: 'http://localhost:5180' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5180', reuseExistingServer: true, timeout: 60_000 },
  // Uses the installed Google Chrome (channel) so tests don't depend on downloading a browser build.
  projects: [
    { name: 'phone-portrait', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 } } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 844, height: 390 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1036, height: 647 } } },
  ],
});
