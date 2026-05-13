/**
 * Playwright Configuration
 *
 * Central config for the entire E2E test framework.
 * Defines browsers, parallelization, reporting, auto-start of the app, and artifact capture.
 *
 * Run tests:       npx playwright test
 * List tests:      npx playwright test --list
 * Specific browser: npx playwright test --project=chromium
 * UI mode:         npx playwright test --ui
 */

import { defineConfig, devices } from '@playwright/test';

require('dotenv/config');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  /*
   * globalSetup runs once before all tests: resets test DB, logs in via API,
   * saves authenticated storageState for tests to reuse.
   * globalTeardown runs once after all tests: closes DB connection.
   */
  globalSetup: require.resolve('./globalSetup'),
  globalTeardown: require.resolve('./globalTeardown'),

  /* 60s per test — if a single E2E test takes longer, it's doing too much */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  /*
   * Run all tests in parallel across files AND within files.
   * Requires tests to be fully independent — no shared mutable state.
   * Each test creates/cleans its own data via fixtures.
   */
  fullyParallel: true,

  /*
   * Workers: 50% of CPU cores locally (keeps machine responsive),
   * 1 in CI (GitHub runners have limited resources — we scale via sharding instead).
   */
  workers: process.env.CI ? 1 : '50%',

  /*
   * Retries: 0 locally (fail fast, debug immediately),
   * 2 in CI (absorb infrastructure flake, fail only on real issues).
   */
  retries: process.env.CI ? 2 : 0,

  /* Fail CI if someone accidentally commits test.only() */
  forbidOnly: !!process.env.CI,

  /*
   * Reporters:
   *   - allure-playwright: primary reporter, generates allure-results/ for
   *     rich HTML report with steps, traces, screenshots, and trend history.
   *   - list: real-time console output during test run.
   *   - html (local only): built-in Playwright report as a quick fallback.
   */
  reporter: process.env.CI
    ? [
        ['allure-playwright', { resultsDir: 'allure-results' }],
        ['list'],
      ]
    : [
        ['allure-playwright', { resultsDir: 'allure-results' }],
        ['html', { open: 'never' }],
        ['list'],
      ],

  use: {
    baseURL: BASE_URL,

    /*
     * Trace: recorded only on first retry of a failed test.
     * Zero overhead for passing tests, full debugging info when needed.
     * Open with: npx playwright show-trace <path-to-trace.zip>
     */
    trace: 'on-first-retry',

    /* Screenshot and video only captured for failed tests — saves disk in CI */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Full HD — matches the most common desktop resolution */
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      /* Real WebKit engine — unlike Cypress which can only simulate Safari via user-agent */
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  /*
   * Auto-start the app before tests. No need to run `npm run dev` manually.
   * In CI: always starts a fresh server (reuseExistingServer: false).
   * Locally: reuses already running server if you have one.
   * Timeout 120s — Next.js cold-compiles pages on first request in dev mode.
   */
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.sqlite',
    },
  },

  outputDir: './test-results',
});