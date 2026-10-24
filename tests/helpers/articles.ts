/**
 * Article UI helpers.
 *
 * Low-level helper functions for article interactions via the browser UI.
 * Used only in tests that specifically verify the UI creation flow.
 * All other tests that need an article as a precondition should use the
 * seededArticle fixture instead — it creates articles via API which is
 * faster and avoids slug collisions in parallel runs.
 */

import { type Page } from '@playwright/test';
import { HomePage, CreateArticlePage, ArticlePage } from '../pages';
import articlesData from '../fixtures/data/articles.json';
import { expectResponse } from './expectResponse';
import { ROUTES } from './routes';

/**
 * Creates an article via the editor UI and returns its slug and ArticlePage instance.
 *
 * Why this exists as a helper and not a fixture:
 *   This function is used ONLY in 'should create an article and verify its content'
 *   which specifically tests the UI creation flow end-to-end. Making it a fixture
 *   would imply it's reusable setup — but its purpose is to be the thing under test,
 *   not a precondition. A helper function makes this intent explicit.
 *
 * Why not use seededArticle fixture here:
 *   seededArticle creates articles via API — bypassing the UI entirely. The test
 *   that verifies article creation must go through the UI to actually test it.
 *
 * Cleanup:
 *   The returned slug is handed back to the caller, which is responsible for
 *   deleting the article afterwards. In this project that responsibility lives in
 *   the `uiArticle` fixture (see test-fixtures.ts), which calls deleteArticle(slug)
 *   in its `finally` — so no orphaned articles accumulate even if the test fails.
 *   This helper no longer tracks slugs itself: pushing to a caller-owned array and
 *   relying on an afterEach hook was replaced by the fixture's try/finally lifecycle.
 *
 * @param page - Playwright Page instance (must be authenticated as a user who can create articles)
 * @returns slug of the created article and an ArticlePage instance pointing to it
 */
export async function createArticleViaUI(
  page: Page
): Promise<{ slug: string; articlePage: ArticlePage }> {
  const article = articlesData.validArticle;

  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.navNewArticle.click();
  await homePage.waitForURL('/editor');

  const createPage = new CreateArticlePage(page);

  await expectResponse(page, ROUTES.articles.createArticle, 200, () =>
    createPage.createArticle(
      article.title,
      article.description,
      article.body,
      article.tagList[0]
    )
  );

  await homePage.waitForURL('/article/');

  const articlePage = new ArticlePage(page);
  const slug = articlePage.getSlugFromURL();

  return { slug, articlePage };
}
