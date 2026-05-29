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
 * Slug tracking:
 *   The created article's slug is pushed to createdSlugs so the afterEach hook
 *   can delete it via Prisma even if the test fails mid-way. This prevents
 *   orphaned articles from accumulating in the test database between runs.
 *
 * @param page - Playwright Page instance (must be authenticated as a user who can create articles)
 * @param createdSlugs - Array to track created slugs for cleanup in afterEach
 * @returns slug of the created article and an ArticlePage instance pointing to it
 */
export async function createArticleViaUI(
  page: Page,
  createdSlugs: string[]
): Promise<{ slug: string; articlePage: ArticlePage }> {
  const article = articlesData.validArticle;

  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.navNewArticle.click();
  await homePage.waitForURL('/editor');

  const createPage = new CreateArticlePage(page);

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/trpc/articles.createArticle') && resp.status() === 200
  );

  await createPage.createArticle(
    article.title,
    article.description,
    article.body,
    article.tagList[0]
  );

  await responsePromise;
  await homePage.waitForURL('/article/');

  const articlePage = new ArticlePage(page);
  const slug = articlePage.getSlugFromURL();
  createdSlugs.push(slug);

  return { slug, articlePage };
}