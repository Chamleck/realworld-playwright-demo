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
import { GLOBAL_TEST_USER } from '../../globalSetup';

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
 * Fields are listed explicitly so the fixture's contract is decoupled
 * from any helper return type — if createArticleViaAPI ever returns extra
 * fields, the fixture surface stays controlled.
 */
interface SeededArticle {
  slug: string;
  title: string;
  description: string;
  body: string;
}

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
   * Trace is started manually on the context so we can attach trace.zip
   * directly into the Allure report on failure — no digging through
   * separate CI artifacts.
   *
   * Lifecycle:
   *   1. Create context with storageState → page is authenticated
   *   2. Start tracing on the context
   *   3. yield page to the test
   *   4. On failure: stop tracing → attach trace.zip to Allure report
   *   5. Close context
   */
  authedPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });

    /*
     * Start tracing manually so we control when it stops.
     * screenshots: true — captures a screenshot on every action.
     * snapshots: true — captures DOM snapshot for each action (enables
     *   "Pick locator" and element inspection in trace viewer).
     */
    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      /*
       * Attach trace only when the test actually failed.
       * Skipping on pass keeps allure-results lean — trace.zip can be
       * several MB per test and is only useful for debugging failures.
       */
      if (testInfo.status !== testInfo.expectedStatus) {
        const tracePath = testInfo.outputPath('trace.zip');
        await context.tracing.stop({ path: tracePath });
        await testInfo.attach('trace', {
          path: tracePath,
          contentType: 'application/zip',
        });
        await testInfo.attach('open trace in playwright viewer', {
          body: Buffer.from('https://trace.playwright.dev'),
          contentType: 'text/uri-list',
        });
      } else {
        await context.tracing.stop();
      }

      await context.close();
    }
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

    try {
      await use({ ...seeded, password });
    } finally {
      await deleteUser(seeded.email);
    }
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

    try {
      await use(created);
    } finally {
      /* Cleanup: delete the article after the test */
      await deleteArticle(created.slug);
    }
  },

  /**
   * authedTestUserPage fixture.
   *
   * Creates a browser context authenticated as testUser (not GLOBAL_TEST_USER).
   * Used in profile tests where we need to modify user data without
   * affecting the global test session.
   *
   * Trace is started manually on the context — same pattern as authedPage —
   * so profile test failures also get trace.zip attached to the Allure report.
   *
   * Lifecycle:
   *   1. Login as testUser via API to get JWT token
   *   2. Create browser context with token in localStorage
   *   3. Start tracing on the context
   *   4. yield page to the test
   *   5. On failure: stop tracing → attach trace.zip to Allure report
   *   6. Close context
   */
  authedTestUserPage: async ({ browser, testUser }, use, testInfo) => {
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

    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const tracePath = testInfo.outputPath('trace.zip');
        await context.tracing.stop({ path: tracePath });
        await testInfo.attach('trace', {
          path: tracePath,
          contentType: 'application/zip',
        });
        await testInfo.attach('open trace in playwright viewer', {
          body: Buffer.from('https://trace.playwright.dev'),
          contentType: 'text/uri-list',
        });
      } else {
        await context.tracing.stop();
      }

      await context.close();
    }
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