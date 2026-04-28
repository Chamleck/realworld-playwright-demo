/**
 * Custom Playwright fixtures.
 *
 * Extends the base `test` object with project-specific fixtures:
 *   - authedPage: a Page with pre-loaded storageState (logged-in user)
 *   - testUser: a unique user seeded in DB, cleaned up after the test
 *
 * Usage in specs:
 *   import { test, expect } from '../fixtures/test-fixtures';
 *   // instead of:
 *   import { test, expect } from '@playwright/test';
 *
 * This is the standard Playwright pattern for sharing setup/teardown
 * logic across tests without repeating it in every spec file.
 */

import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { seedUser, deleteUser, type SeedUserResult } from '../helpers/db';
import { loginViaAPI } from '../helpers/api';

/* Path to the storageState file created by globalSetup */
const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  '../auth/.storage-state.json'
);

/* ------------------------------------------------------------------ */
/*  Define custom fixture types                                        */
/* ------------------------------------------------------------------ */

/**
 * TestUser — what the testUser fixture provides to the test.
 * Includes DB fields plus the plaintext password (for login via UI if needed).
 */
interface TestUser extends SeedUserResult {
  password: string;
}

/**
 * Declare the shape of our custom fixtures.
 * Each key becomes available as a parameter in test().
 */
type CustomFixtures = {
  /** Page with storageState loaded — user is already logged in */
  authedPage: Page;
  /** Unique user created in DB before the test, deleted after */
  testUser: TestUser;
};

/* ------------------------------------------------------------------ */
/*  Extend the base test with custom fixtures                          */
/* ------------------------------------------------------------------ */

export const test = base.extend<CustomFixtures>({

  /**
   * authedPage fixture.
   *
   * Creates a new browser context with storageState from globalSetup,
   * then creates a page in that context. The page starts "logged in"
   * because sessionStorage already has the JWT token.
   *
   * Lifecycle:
   *   1. Create context with storageState → page is authenticated
   *   2. yield page to the test
   *   3. Close context after the test (automatic cleanup)
   */
  authedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    const page = await context.newPage();

    /* Hand the authenticated page to the test */
    await use(page);

    /* Cleanup: close context (and page) after the test */
    await context.close();
  },

  /**
   * testUser fixture.
   *
   * Creates a unique user in the test DB before the test,
   * provides user data to the test, deletes the user after.
   *
   * Uniqueness is guaranteed by combining:
   *   - Date.now() — millisecond timestamp
   *   - testInfo.parallelIndex — worker number (0, 1, 2...)
   *
   * This prevents collisions when tests run in parallel:
   *   Worker 0: test_1714000001_w0@test.com
   *   Worker 1: test_1714000002_w1@test.com
   *
   * Lifecycle:
   *   1. Generate unique email/username
   *   2. Seed user in DB via Prisma
   *   3. yield user data to the test
   *   4. Delete user (and all their articles/comments) after the test
   */
  testUser: async ({}, use, testInfo) => {
    const uniqueId = `${Date.now()}_w${testInfo.parallelIndex}`;
    const password = 'Test1234!';

    const seeded = await seedUser({
      email: `test_${uniqueId}@test.com`,
      username: `testuser_${uniqueId}`,
      password,
    });

    /* Provide user data to the test (including plaintext password) */
    await use({ ...seeded, password });

    /* Cleanup: delete the user and all their data after the test */
    await deleteUser(seeded.email);
  },
});

/* Re-export expect so specs only need one import */
export { expect };