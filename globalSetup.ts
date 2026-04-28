/**
 * Playwright Global Setup
 *
 * Runs ONCE before all tests and all workers.
 * Prepares the test database and creates an authenticated storageState.
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginViaAPI } from './tests/helpers/api';
import { env } from './tests/helpers/env';

/* Path to the storageState file — shared across all tests */
const STORAGE_STATE_PATH = path.resolve(__dirname, 'tests/auth/.storage-state.json');

async function globalSetup() {
  console.log('\n🔧 Global Setup: starting...\n');

  /* ---------------------------------------------------------------- */
  /* Step 1: Reset the test database                                   */
  /* ---------------------------------------------------------------- */

  /*
   * Copy base.sqlite (seed data, committed to repo) → test.sqlite (working copy).
   * Every test run starts from a clean, known state.
   * fs.copyFileSync overwrites if test.sqlite already exists.
   */
  const baseSqlite = path.resolve(__dirname, 'prisma/base.sqlite');
  const testSqlite = path.resolve(__dirname, 'prisma/test.sqlite');

  fs.copyFileSync(baseSqlite, testSqlite);
  console.log('  ✅ Test database reset (base.sqlite → test.sqlite)');

  /* ---------------------------------------------------------------- */
  /* Step 2: Log in via API and get JWT token                          */
  /* ---------------------------------------------------------------- */

  /*
   * Use the pre-seeded user from base.sqlite.
   * Credentials come from .env (validated by zod in env.ts).
   * loginViaAPI sends a POST to /api/trpc/auth.login — no browser needed.
   */
  const auth = await loginViaAPI({
    email: env.TEST_USER_EMAIL,
    password: env.TEST_USER_PASSWORD,
  });
  console.log(`  ✅ Logged in via API as ${auth.email}`);

  /* ---------------------------------------------------------------- */
  /* Step 3: Save storageState with the JWT token                      */
  /* ---------------------------------------------------------------- */

  /*
   * The Conduit app stores the JWT in sessionStorage under key "sessionToken".
   * To make the browser "already logged in", we need to:
   *   1. Open a real browser (sessionStorage is a browser API)
   *   2. Navigate to the app's origin (sessionStorage is per-origin)
   *   3. Inject the token into sessionStorage
   *   4. Save the entire browser state (cookies + storage) to a JSON file
   *
   * This file is then loaded by Playwright for every authenticated test
   * via the storageState option in playwright.config.ts.
   */
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  /* Navigate to app — needed so sessionStorage is bound to localhost:3000 */
  await page.goto(env.BASE_URL);

  /* Inject JWT into sessionStorage (same key the app uses for auth) */
  await page.evaluate((token) => {
    sessionStorage.setItem('token', token);
  }, auth.token);

  /* Save browser state to JSON file — includes cookies and sessionStorage */
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`  ✅ Storage state saved to ${STORAGE_STATE_PATH}`);

  await browser.close();

  console.log('\n🔧 Global Setup: done!\n');
}

export default globalSetup;