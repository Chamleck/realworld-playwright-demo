/**
 * Custom Playwright fixtures.
 *
 * Architecture — three-layer inheritance:
 *
 *   base (Playwright built-in)
 *     └── dataTest — data fixtures shared across all authenticated tests
 *           ├── authedTest — overrides context with GLOBAL_TEST_USER session
 *           └── dynamicAuthedTest — overrides context with unique per-test user
 *
 * Why context override instead of custom page fixtures:
 *   Overriding the native `context` fixture tells Playwright this is the
 *   primary test context. Playwright then applies playwright.config.ts
 *   settings (video, trace, screenshot) natively and finalizes artifacts
 *   before onTestEnd — so allure-playwright picks them up correctly.
 *   Custom browser.newContext() calls are invisible to Playwright's
 *   lifecycle, causing video/trace to miss the Allure report.
 *
 * Usage in specs:
 *   import { authedTest as test, expect } from '../fixtures/test-fixtures';
 *   import { dynamicAuthedTest as test, expect } from '../fixtures/test-fixtures';
 *   // auth.spec.ts uses plain: import { test, expect } from '@playwright/test';
 */

import { test as base, expect } from '@playwright/test';
import path from 'path';
import { seedUser, deleteUser, deleteArticle, type SeedUserResult } from '../helpers/db';
import { loginViaAPI, createArticleViaAPI } from '../helpers/api';
import articlesData from './data/articles.json';
import { env } from '../helpers/env';
import { GLOBAL_TEST_USER } from '../../globalSetup';

/* Path to the storageState file created by globalSetup */
const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  '../auth/.storage-state.json'
);

/* ------------------------------------------------------------------ */
/*  Fixture types                                                      */
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

/* ------------------------------------------------------------------ */
/*  Layer 1: dataTest — shared data fixtures                          */
/* ------------------------------------------------------------------ */

/**
 * dataTest — base layer with data fixtures shared across all tests.
 *
 * Defines seededArticle, testUser, profileUpdate in one place.
 * authedTest and dynamicAuthedTest inherit these via extend chaining —
 * no duplication, single source of truth for each fixture.
 *
 * These fixtures are data-only — they don't depend on browser context
 * and work correctly regardless of which context override is active.
 */
const dataTest = base.extend<{
  seededArticle: SeededArticle;
  testUser: TestUser;
  profileUpdate: ProfileUpdate;
}>({
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

    const auth = await loginViaAPI({
      email: GLOBAL_TEST_USER.email,
      password: GLOBAL_TEST_USER.password,
    });

    const created = await createArticleViaAPI(auth.token, {
      title: `${article.title} ${uniqueId}`,
      description: article.description,
      body: article.body,
      tagList: article.tagList,
    });

    try {
      await use(created);
    } finally {
      await deleteArticle(created.slug);
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

/* ------------------------------------------------------------------ */
/*  Layer 2a: authedTest — GLOBAL_TEST_USER session                   */
/* ------------------------------------------------------------------ */

/**
 * authedTest — inherits dataTest, overrides context with GLOBAL_TEST_USER.
 *
 * Tests receive a `page` already logged in as GLOBAL_TEST_USER.
 * seededArticle and profileUpdate are available via dataTest inheritance.
 *
 * Playwright owns this context — video, trace, screenshot from
 * playwright.config.ts apply natively without any manual setup.
 */
export const authedTest = dataTest.extend({
  /*
   * Override native context with GLOBAL_TEST_USER storageState.
   * page fixture is automatically created inside this context.
   * Playwright applies config settings (video, trace, screenshot) natively.
   */
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    await use(context);
    await context.close();
  },
});

/* ------------------------------------------------------------------ */
/*  Layer 2b: dynamicAuthedTest — unique per-test user session        */
/* ------------------------------------------------------------------ */

/**
 * dynamicAuthedTest — inherits dataTest, overrides context with testUser.
 *
 * Used in profile tests where we need to modify user data without
 * affecting GLOBAL_TEST_USER. testUser is seeded in DB before context
 * creation — Playwright resolves the dependency chain automatically:
 * testUser → context → page.
 *
 * Tests receive a `page` logged in as testUser.
 * testUser and profileUpdate are available via dataTest inheritance.
 *
 * Same native context override pattern as authedTest — Playwright owns
 * this context and handles artifacts correctly.
 */
export const dynamicAuthedTest = dataTest.extend({
  /*
   * Override native context with testUser credentials.
   * testUser is resolved first (inherited from dataTest), then context
   * uses its credentials. Playwright resolves: testUser → context → page.
   * Token is injected directly into localStorage to avoid UI login.
   */
  context: async ({ browser, testUser }, use) => {
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

    await use(context);
    await context.close();
  },
});

/* Re-export expect so specs only need one import */
export { expect };