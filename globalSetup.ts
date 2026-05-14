/**
 * Playwright Global Setup
 *
 * Runs ONCE before all tests and all workers.
 * Prepares the test database, creates a test user, and saves
 * an authenticated browser state for tests to reuse.
 *
 * This file is referenced in playwright.config.ts via:
 *   globalSetup: require.resolve('./globalSetup')
 *
 * Exported constants (STORAGE_STATE_PATH, GLOBAL_TEST_USER) are used
 * by test specs and fixtures to access the authenticated session
 * and the test user's credentials.
 */

import path from 'path';
import fs from 'fs';
import { loginViaAPI } from './tests/helpers/api';
import { seedUser } from './tests/helpers/db';
import { env } from './tests/helpers/env';

/**
 * Path to the storageState JSON file.
 *
 * storageState is a Playwright concept — it's a JSON snapshot of the browser's
 * cookies, localStorage, and sessionStorage. When a test loads this file via
 * `browser.newContext({ storageState: STORAGE_STATE_PATH })`, the browser
 * starts with all stored data already present — effectively "already logged in".
 *
 * This file is created by globalSetup and read by the authedPage fixture.
 * It lives in tests/auth/ and is gitignored (contains a real JWT token).
 */
export const STORAGE_STATE_PATH = path.resolve(__dirname, 'tests/auth/.storage-state.json');

/**
 * Global test user credentials — exported for use in tests.
 *
 * This user is created by globalSetup in the test database via seedUser()
 * and deleted by globalTeardown via deleteUser(). It exists for the entire
 * duration of the test run.
 *
 * Why export? Tests need to know these credentials to:
 *   - Verify the username appears in the navigation bar after login
 *   - Log in via UI in login tests (using email + password)
 *   - Assert profile data matches expected values
 *
 * Values come from .env (validated by zod in env.ts):
 *   TEST_USER_EMAIL, TEST_USER_USERNAME, TEST_USER_PASSWORD
 *
 * Usage in specs:
 *   import { GLOBAL_TEST_USER } from '../../globalSetup';
 *   await loginPage.login(GLOBAL_TEST_USER.email, GLOBAL_TEST_USER.password);
 *   await expect(navProfile(GLOBAL_TEST_USER.username)).toBeVisible();
 */
export const GLOBAL_TEST_USER = {
  email: env.TEST_USER_EMAIL,
  username: env.TEST_USER_USERNAME,
  password: env.TEST_USER_PASSWORD,
};

async function globalSetup() {
  console.log('\n🔧 Global Setup: starting...\n');

  /* ---------------------------------------------------------------- */
  /* Step 1: Reset the test database                                   */
  /* ---------------------------------------------------------------- */

  /*
   * Copy base.sqlite (seed data, committed to repo) → test.sqlite (working copy).
   * Every test run starts from a clean, known state.
   * fs.copyFileSync overwrites if test.sqlite already exists.
   *
   * This ensures that:
   *   - Tests don't affect each other through leftover data
   *   - A failed test run doesn't corrupt the next run
   *   - The dev database (database.sqlite) is never touched
   */
  const baseSqlite = path.resolve(__dirname, 'prisma/base.sqlite');
  const testSqlite = path.resolve(__dirname, 'prisma/test.sqlite');

  fs.copyFileSync(baseSqlite, testSqlite);
  console.log('  ✅ Test database reset (base.sqlite → test.sqlite)');

  /* ---------------------------------------------------------------- */
  /* Step 2: Create a dedicated test user in the test database         */
  /* ---------------------------------------------------------------- */

  /*
   * The seed database (base.sqlite) does not contain a user with known
   * credentials — all existing users have hashed passwords that we can't
   * reverse. Instead of guessing, we create our own user via Prisma.
   *
   * seedUser() hashes the password with bcrypt (same algorithm the app uses)
   * and inserts the user directly into the test database.
   *
   * This user serves two purposes:
   *   1. globalSetup logs in as this user to obtain a JWT token
   *   2. Tests reference GLOBAL_TEST_USER for login tests and assertions
   *
   * The user is cleaned up by globalTeardown after all tests finish.
   */
  await seedUser({
    email: GLOBAL_TEST_USER.email,
    username: GLOBAL_TEST_USER.username,
    password: GLOBAL_TEST_USER.password,
  });
  console.log(`  ✅ Test user created: ${GLOBAL_TEST_USER.email}`);

  /* ---------------------------------------------------------------- */
  /* Step 3: Log in via API and get JWT token                          */
  /* ---------------------------------------------------------------- */

  /*
   * loginViaAPI() sends a POST to /api/trpc/auth.login with the user's
   * credentials and returns a JWT token. This is the same endpoint
   * the UI login form calls — but we skip the UI entirely.
   *
   * The token is used in the next step to build the storageState file.
   */
  const auth = await loginViaAPI({
    email: GLOBAL_TEST_USER.email,
    password: GLOBAL_TEST_USER.password,
  });
  console.log(`  ✅ Logged in via API as ${auth.email}`);

  /* ---------------------------------------------------------------- */
  /* Step 4: Save storageState with the JWT token                      */
  /* ---------------------------------------------------------------- */

  /*
   * The Conduit app stores the JWT in localStorage under key "token"
   * (src/lib/api.ts — setToken/getToken functions).
   *
   * Note: Originally the app used sessionStorage, but we switched to
   * localStorage because Playwright's storageState reliably captures
   * localStorage contents, while sessionStorage capture is not guaranteed.
   * The app's src/lib/api.ts was updated accordingly.
   *
   * storageState is a JSON file of this shape:
   *   {
   *     cookies: [],
   *     origins: [{ origin: "http://...", localStorage: [{ name, value }] }]
   *   }
   *
   * When a test loads this file via:
   *   browser.newContext({ storageState: STORAGE_STATE_PATH })
   * Playwright injects the stored cookies and localStorage into the new
   * context — the browser starts "already logged in".
   *
   * EVOLUTION — why we no longer launch a browser here:
   *
   * Original approach (v1): launched a real Chromium instance, navigated
   * to the app, injected the token via page.evaluate(), then called
   * context.storageState({ path }) to dump the JSON.
   *
   * Problem: this hard-coded a dependency on Chromium in globalSetup.
   * When the nightly CI runs Firefox or WebKit jobs, those jobs only
   * install their own browser — Chromium is not present. globalSetup
   * crashed at chromium.launch() before a single test ran.
   *
   * Current approach (v2): since we already have the JWT token from the
   * API call above, we can write the storageState JSON directly using
   * fs.writeFileSync — no browser required. The file is identical in
   * structure to what Playwright would have produced. This makes
   * globalSetup browser-agnostic: it runs identically regardless of
   * which browser project is executing the tests.
   */
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: env.BASE_URL,
        localStorage: [{ name: 'token', value: auth.token }],
      },
    ],
  };

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log(`  ✅ Storage state saved to ${STORAGE_STATE_PATH}`);

  console.log('\n🔧 Global Setup: done!\n');
}

export default globalSetup;