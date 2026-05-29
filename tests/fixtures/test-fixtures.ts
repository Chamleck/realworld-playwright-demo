/**
 * Custom Playwright fixtures.
 *
 * Architecture — three-layer inheritance:
 *
 * base (Playwright built-in)
 * └── dataTest — data fixtures shared across all authenticated tests
 * ├── authedTest — overrides contextOptions with GLOBAL_TEST_USER session
 * └── dynamicAuthedTest — overrides contextOptions with unique per-test user
 *
 * Why contextOptions override instead of context override:
 * Overriding the native `contextOptions` allows us to inject storageState and 
 * localStorage dynamically in runtime, while leaving the lifecycle of the browser 
 * context entirely to Playwright. 
 * This bypasses the known Playwright bug (#35397) where explicit context.close() 
 * inside custom context fixtures drops video attachments before allure-playwright 
 * can collect them.
 *
 * Usage in specs:
 * import { authedTest as test, expect } from '../fixtures/test-fixtures';
 * import { dynamicAuthedTest as test, expect } from '../fixtures/test-fixtures';
 * // auth.spec.ts uses plain: import { test, expect } from '@playwright/test';
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
/* Fixture types                                                     */
/* ------------------------------------------------------------------ */

interface TestUser extends SeedUserResult {
  password: string;
}

interface SeededArticle {
  slug: string;
  title: string;
  description: string;
  body: string;
}

interface ProfileUpdate {
  username: string;
  bio: string;
  email: string;
  password: string;
}

/* ------------------------------------------------------------------ */
/* Layer 1: dataTest — shared data fixtures                          */
/* ------------------------------------------------------------------ */

const dataTest = base.extend<{
  seededArticle: SeededArticle;
  testUser: TestUser;
  profileUpdate: ProfileUpdate;
}>({
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
/* Layer 2a: authedTest — GLOBAL_TEST_USER session                    */
/* ------------------------------------------------------------------ */

/**
 * authedTest — inherits dataTest, overrides contextOptions with GLOBAL_TEST_USER.
 * Playwright native recorder fully owns the context lifecycle.
 */
export const authedTest = dataTest.extend({
  // Переопределяем опции контекста, а не сам контекст
  contextOptions: async ({ contextOptions }, use) => {
    await use({
      ...contextOptions,
      storageState: STORAGE_STATE_PATH,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Layer 2b: dynamicAuthedTest — unique per-test user session        */
/* ------------------------------------------------------------------ */

/**
 * dynamicAuthedTest — inherits dataTest, overrides contextOptions with testUser.
 * testUser is resolved first, then its API token is injected into localStorage options.
 */
export const dynamicAuthedTest = dataTest.extend({
  // Переопределяем опции контекста. Обрати внимание: нам больше не нужен инжект `browser`!
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