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
import { PAGES } from './routes';

/**
 * Creates an article via the editor UI and returns its slug and ArticlePage instance.
 *
 * Why this is a helper wrapped by a factory fixture:
 *   It is used ONLY in 'should create an article and verify its content', which tests
 *   the UI creation flow end-to-end — it is the thing under test, not a precondition.
 *   The createUiArticle fixture hands the test a function that calls this helper, so
 *   the flow runs in the test body while the fixture owns cleanup.
 *
 * Why not use seededArticle fixture here:
 *   seededArticle creates articles via API — bypassing the UI entirely. The test
 *   that verifies article creation must go through the UI to actually test it.
 *
 * Success signal:
 *   The app navigates to /article/[slug] only in the createArticle mutation's
 *   onSuccess, so reaching that path proves the server accepted the article - no
 *   separate network wait needed (user-visible outcome over internal API coupling).
 *
 * Cleanup:
 *   The returned slug goes back to the caller; the createUiArticle fixture deletes it
 *   in its `finally`, so no orphaned articles accumulate even if the test fails.
 *
 * @param page  - Playwright Page instance (authenticated as a user who can create articles)
 * @param title - article title; callers pass a unique one (parallel-safe slug)
 * @returns slug of the created article and an ArticlePage instance pointing to it
 */
export async function createArticleViaUI(
  page: Page,
  title: string
): Promise<{ slug: string; articlePage: ArticlePage }> {
  const article = articlesData.validArticle;

  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.navNewArticle.click();
  await homePage.waitForURL(PAGES.newArticle);

  const createPage = new CreateArticlePage(page);
  await createPage.createArticle(title, article.description, article.body, article.tagList[0]);

  await homePage.waitForURL(PAGES.anyArticle);

  const articlePage = new ArticlePage(page);
  const slug = articlePage.getSlugFromURL();

  return { slug, articlePage };
}
