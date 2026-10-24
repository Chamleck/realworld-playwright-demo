/**
 * Custom Playwright fixtures.
 *
 * Architecture — three-layer inheritance:
 *
 * base (Playwright built-in)
 * └── dataTest — data + Page Object fixtures shared across all tests
 * ├── guestTest — no auth session (plain page); for auth/registration specs
 * ├── authedTest — overrides contextOptions with GLOBAL_TEST_USER session
 * └── dynamicAuthedTest — overrides contextOptions with unique per-test user
 *
 * Why contextOptions override instead of context override:
 * Overriding the native `contextOptions` allows us to inject storageState and 
 * localStorage dynamically at runtime, while leaving the lifecycle of the browser 
 * context entirely to Playwright. 
 * This bypasses the known Playwright bug (#35397) where explicit context.close() 
 * inside custom context fixtures drops video attachments before allure-playwright 
 * can collect them.
 *
 * Why Page Objects are fixtures (not `new XPage(page)` in every test):
 * Instantiating page objects by hand in each test is boilerplate that the fixture
 * system exists to remove. Providing them as fixtures lets a test declare exactly
 * the pages it needs in its arguments — `{ loginPage, homePage }` — and receive them
 * ready to use. Tests read like scenarios, and there's one place that knows how a
 * page object is built. Page object fixtures are defined on the dataTest base layer,
 * so all three test flavours (guest / authed / dynamic) inherit them.
 *
 * Usage in specs:
 * import { guestTest as test, expect } from '../fixtures/test-fixtures';
 * import { authedTest as test, expect } from '../fixtures/test-fixtures';
 * import { dynamicAuthedTest as test, expect } from '../fixtures/test-fixtures';
 */

import { test as base, expect } from '@playwright/test';
import path from 'path';
import { seedUser, deleteUser, deleteArticle, type SeedUserResult } from '../helpers/db';
import { loginViaAPI, createArticleViaAPI } from '../helpers/api';
import { createArticleViaUI } from '../helpers/articles';
import articlesData from './data/articles.json';
import { env } from '../helpers/env';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import {
  LoginPage,
  SignUpPage,
  HomePage,
  CreateArticlePage,
  ArticlePage,
  ProfilePage,
} from '../pages';

/* Path to the storageState file created by globalSetup */
const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  '../auth/.storage-state.json'
);

/* ------------------------------------------------------------------ */
/* Fixture types                                                      */
/* ------------------------------------------------------------------ */

/**
 * TestUser — what the testUser fixture provides to the test.
 * Includes DB fields plus the plaintext password (for login via UI if needed).
 */
interface TestUser extends SeedUserResult {
  password: string;
}

/**
 * RegisteredUser — unique, valid user data for UI registration tests.
 *
 * Unlike testUser (which is seeded directly into the DB), this user is NOT
 * created up front — the registration test itself creates it through the UI,
 * which is the thing under test. The fixture only generates unique credentials
 * and guarantees cleanup afterwards (see the registeredUser fixture below).
 */
interface RegisteredUser {
  username: string;
  email: string;
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
 * UiArticle — what the uiArticle fixture provides to the test.
 *
 * Unlike seededArticle (created via API), this article is created through the
 * editor UI — because the test that uses it verifies the UI creation flow itself.
 * The fixture owns cleanup: it deletes the article in `finally`, replacing the
 * previous manual createdSlugs array + afterEach in articles.spec.ts.
 */
interface UiArticle {
  slug: string;
  articlePage: ArticlePage;
}

/**
 * PageObjects — the set of Page Object fixtures available to every test.
 * Declared once here so all three test flavours share the same typed surface.
 */
interface PageObjects {
  loginPage: LoginPage;
  signUpPage: SignUpPage;
  homePage: HomePage;
  createArticlePage: CreateArticlePage;
  articlePage: ArticlePage;
  profilePage: ProfilePage;
}

/* ------------------------------------------------------------------ */
/* Layer 1: dataTest — shared data + Page Object fixtures            */
/* ------------------------------------------------------------------ */

/**
 * dataTest — base layer with data and Page Object fixtures shared across all tests.
 *
 * Data fixtures: seededArticle, testUser, registeredUser, profileUpdate.
 * Page Object fixtures: loginPage, signUpPage, homePage, createArticlePage,
 *   articlePage, profilePage.
 *
 * guestTest, authedTest and dynamicAuthedTest inherit these via extend chaining —
 * no duplication, single source of truth for each fixture.
 *
 * The data fixtures are data-only — they don't depend on browser context and work
 * correctly regardless of which context override is active. The Page Object fixtures
 * depend only on `page`, so they also work under any context override.
 */
const dataTest = base.extend<
  {
    seededArticle: SeededArticle;
    uiArticle: UiArticle;
    testUser: TestUser;
    registeredUser: RegisteredUser;
    profileUpdate: ProfileUpdate;
  } & PageObjects
>({
  /* ---------------------------------------------------------------- */
  /* Page Object fixtures                                             */
  /* ---------------------------------------------------------------- */

  /*
   * Each page object fixture simply constructs the page object with the current
   * `page` and provides it to the test. No teardown needed — page objects hold no
   * resources of their own, they're thin wrappers over locators.
   */
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  createArticlePage: async ({ page }, use) => {
    await use(new CreateArticlePage(page));
  },

  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },

  /* ---------------------------------------------------------------- */
  /* Data fixtures                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * seededArticle fixture.
   *
   * Creates a unique article via the tRPC API before the test,
   * provides article data (slug, title, description, body) to the test,
   * deletes the article after — even if the test fails.
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
   * uiArticle fixture.
   *
   * Creates an article through the editor UI (via createArticleViaUI) and provides
   * its slug + ArticlePage to the test. Used ONLY by the test that verifies the UI
   * creation flow — every other article precondition uses seededArticle (API-based).
   *
   * The page must be authenticated for this to work, so this fixture is only used
   * under authedTest. Cleanup (deleteArticle) runs in `finally` — this replaces the
   * manual createdSlugs array + afterEach that previously lived in articles.spec.ts.
   */
  uiArticle: async ({ page }, use) => {
    const created = await createArticleViaUI(page);

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
   * registeredUser fixture.
   *
   * Provides unique, valid credentials for a user that the REGISTRATION test
   * will create through the UI. The fixture deliberately does NOT create the user
   * up front — creating it is the behaviour under test. It only:
   *   1. generates parallel-safe unique credentials (so two workers never try to
   *      register the same email — a fixed users.json email would collide), and
   *   2. deletes the user in `finally`, whether the test passes or fails.
   *
   * This replaces the previous hand-rolled `createdEmails` array + afterEach cleanup:
   * the create-and-teardown lifecycle now lives in one fixture, consistent with how
   * testUser and seededArticle already work.
   */
  registeredUser: async ({}, use, testInfo) => {
    const uniqueId = `${Date.now()}_w${testInfo.parallelIndex}`;
    const email = `registered_${uniqueId}@test.com`;

    const user: RegisteredUser = {
      username: `RegUser_${uniqueId}`,
      email,
      password: 'Test1234!',
    };

    try {
      await use(user);
    } finally {
      /* The test registered this user via the UI — clean it up from the DB.
       * deleteUser is a no-op if the user was never actually created (e.g. the
       * test failed before submitting), so this is always safe to call. */
      await deleteUser(email);
    }
  },

  /**
   * profileUpdate fixture.
   *
   * Generates unique profile update data per test to avoid
   * email/username collisions when tests run in parallel.
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
/* Layer 2a: guestTest — no auth session (plain page)                */
/* ------------------------------------------------------------------ */

/**
 * guestTest — inherits dataTest without any context override.
 *
 * The page starts as a fresh, unauthenticated browser (no storageState) —
 * exactly what registration, login and auth-navigation tests need. It exists
 * so those tests can still use the Page Object and data fixtures (loginPage,
 * signUpPage, registeredUser, ...) instead of `new XPage(page)` and manual cleanup,
 * while keeping the guest (logged-out) session that plain `@playwright/test` gave them.
 */
export const guestTest = dataTest;

/* ------------------------------------------------------------------ */
/* Layer 2b: authedTest — GLOBAL_TEST_USER session                    */
/* ------------------------------------------------------------------ */

/**
 * authedTest — inherits dataTest, overrides contextOptions with GLOBAL_TEST_USER.
 * Playwright native recorder fully owns the context lifecycle.
 */
export const authedTest = dataTest.extend({
  // Override context options instead of the context itself
  contextOptions: async ({ contextOptions }, use) => {
    await use({
      ...contextOptions,
      storageState: STORAGE_STATE_PATH,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Layer 2c: dynamicAuthedTest — unique per-test user session        */
/* ------------------------------------------------------------------ */

/**
 * dynamicAuthedTest — inherits dataTest, overrides contextOptions with testUser.
 * testUser is resolved first, then its API token is injected into localStorage options.
 */
export const dynamicAuthedTest = dataTest.extend({
  // Override context options. Note: we no longer need to inject the 'browser' fixture!
  contextOptions: async ({ testUser, contextOptions }, use) => {
    const auth = await loginViaAPI({
      email: testUser.email,
      password: testUser.password,
    });

    await use({
      ...contextOptions,
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
  },
});

/* Re-export expect so specs only need one import */
export { expect };
