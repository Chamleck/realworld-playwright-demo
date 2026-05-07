/**
 * Custom Playwright fixtures.
 *
 * Extends the base `test` object with project-specific fixtures:
 *   - authedPage: a Page with pre-loaded storageState (logged-in user)
 *   - testUser: a unique user seeded in DB, cleaned up after the test
 *   - seededArticle: a unique article created via API, cleaned up after the test
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
import { seedUser, deleteUser, deleteArticle, type SeedUserResult } from '../helpers/db';
import { loginViaAPI, createArticleViaAPI, type ArticleResult } from '../helpers/api';
import articlesData from './data/articles.json';
import { env } from '../helpers/env';

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
 * SeededArticle — what the seededArticle fixture provides to the test.
 * Includes article fields returned from the API.
 */
interface SeededArticle extends ArticleResult {}

/**
 * Declare the shape of our custom fixtures.
 * Each key becomes available as a parameter in test().
 */
type CustomFixtures = {
  /** Page with storageState loaded — user is already logged in */
  authedPage: Page;
  /** Unique user created in DB before the test, deleted after */
  testUser: TestUser;
  /** Page authenticated as testUser — used in profile tests */
  authedTestUserPage: Page;
  /**
   * Unique article created via API before the test, deleted after.
   * Uses a unique title (title + timestamp + parallelIndex) to avoid
   * slug collisions when tests run in parallel.
   */
  seededArticle: SeededArticle;
  /**
   * Unique profile update data generated per test.
   * Uses timestamp + parallelIndex to avoid email/username collisions
   * when profile tests run in parallel.
   */
  profileUpdate: ProfileUpdate;
};

/**
 * ProfileUpdate — what the profileUpdate fixture provides to the test.
 * Contains unique profile data generated per test to avoid
 * email/username collisions when tests run in parallel.
 */
interface ProfileUpdate {
  username: string;
  bio: string;
  email: string;
  password: string;
}

/* ------------------------------------------------------------------ */
/*  Extend the base test with custom fixtures                          */
/* ------------------------------------------------------------------ */

export const test = base.extend<CustomFixtures>({

  /**
   * authedPage fixture.
   *
   * Creates a new browser context with storageState from globalSetup,
   * then creates a page in that context. The page starts "logged in"
   * because localStorage already has the JWT token.
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

    await use(page);

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

    await use({ ...seeded, password });

    await deleteUser(seeded.email);
  },

  /**
   * seededArticle fixture.
   *
   * Creates a unique article via the tRPC API before the test,
   * provides article data (slug, title, description, body) to the test,
   * deletes the article after — even if the test fails.
   *
   * Why API instead of UI?
   *   - Creating articles via UI in parallel causes slug collisions:
   *     multiple workers submit "Test Article" at nearly the same time,
   *     the server generates test-article-1 for all of them → unique constraint fails.
   *   - API creation is atomic and uses the GLOBAL_TEST_USER JWT token.
   *   - Tests that need an existing article as a precondition (edit, delete,
   *     comment, favorite) should use this fixture.
   *   - Tests that verify the article creation UI should create via UI directly.
   *
   * Uniqueness:
   *   Title = base title + timestamp + parallelIndex
   *   e.g. "Test Article 1714000001234_w0"
   *   This guarantees unique slugs even across parallel workers.
   *
   * Lifecycle:
   *   1. Login as GLOBAL_TEST_USER via API to get JWT token
   *   2. Create article via API with unique title
   *   3. yield article data to the test
   *   4. Delete article via Prisma after the test
   */
  seededArticle: async ({}, use, testInfo) => {
    const uniqueId = `${Date.now()}_w${testInfo.parallelIndex}`;
    const article = articlesData.validArticle;

    /* Login as GLOBAL_TEST_USER to get a fresh JWT token for the API call */
    const { GLOBAL_TEST_USER } = await import('../../globalSetup');
    const auth = await loginViaAPI({
      email: GLOBAL_TEST_USER.email,
      password: GLOBAL_TEST_USER.password,
    });

    /* Create article via API with a unique title */
    const created = await createArticleViaAPI(auth.token, {
      title: `${article.title} ${uniqueId}`,
      description: article.description,
      body: article.body,
      tagList: article.tagList,
    });

    await use(created);

    /* Cleanup: delete the article after the test */
    await deleteArticle(created.slug);
  },

  /**
   * authedTestUserPage fixture.
   *
   * Creates a browser context authenticated as testUser (not GLOBAL_TEST_USER).
   * Used in profile tests where we need to modify user data without
   * affecting the global test session.
   *
   * Depends on testUser fixture — testUser is created first, then we
   * log in as that user and inject the token into a fresh browser context.
   *
   * Lifecycle:
   *   1. Login as testUser via API to get JWT token
   *   2. Create browser context with token in localStorage
   *   3. yield page to the test
   *   4. Close context after the test
   */
  authedTestUserPage: async ({ browser, testUser }, use) => {
    const auth = await loginViaAPI({
      email: testUser.email,
      password: testUser.password,
    });

    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: env.BASE_URL,
            localStorage: [{ name: 'token', value: auth.token }],
          },
        ],
      },
    });

    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  /**
 * profileUpdate fixture.
 *
 * Generates unique profile update data per test to avoid
 * email/username collisions when tests run in parallel.
 *
 * Lifecycle: stateless — just generates data, no cleanup needed.
 */
profileUpdate: async ({}, use, testInfo) => {
  const uniqueId = `${Date.now()}_w${testInfo.parallelIndex}`;
  await use({
    username: `UpdatedUser_${uniqueId}`,
    bio: 'Test bio for profile update',
    email: `updated_${uniqueId}@mail.com`,
    password: '22222222',
   });
  },
});

/* Re-export expect so specs only need one import */
export { expect };