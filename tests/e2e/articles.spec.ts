/**
 * Articles E2E Tests — CRUD, Favorites, Comments
 *
 * Uses authedPage fixture (GLOBAL_TEST_USER session from globalSetup).
 *
 * Two strategies for article data:
 *   - createArticleViaUI helper: used ONLY in the test that verifies UI creation.
 *   - seededArticle fixture: used in all other tests where article is a precondition.
 *     Creates article via API with unique title → no slug collisions in parallel runs.
 *
 * Tags: @articles, @smoke
 */

import { test, expect } from '../fixtures/test-fixtures';
import { type Page } from '@playwright/test';
import {
  HomePage,
  CreateArticlePage,
  ArticlePage,
  ProfilePage,
} from '../pages';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import articlesData from '../fixtures/data/articles.json';
import { deleteArticle } from '../helpers/db';

/* ================================================================== */
/*  Local helper — create article via UI                               */
/*  Used ONLY in the test that verifies UI creation flow.             */
/* ================================================================== */

/**
 * Creates an article via the editor UI.
 * Only used in 'should create an article and verify its content' test
 * because that test specifically verifies the UI creation flow.
 *
 * All other tests use the seededArticle fixture instead,
 * which creates articles via API to avoid slug collisions in parallel runs.
 */
async function createArticleViaUI(
  authedPage: Page,
  createdSlugs: string[]
): Promise<{ slug: string; articlePage: ArticlePage }> {
  const article = articlesData.validArticle;

  const homePage = new HomePage(authedPage);
  await homePage.goto();
  await homePage.navNewArticle.click();
  await homePage.waitForURL('/editor');

  const createPage = new CreateArticlePage(authedPage);

  const responsePromise = authedPage.waitForResponse(
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

  const articlePage = new ArticlePage(authedPage);
  const slug = articlePage.getSlugFromURL();
  createdSlugs.push(slug);

  return { slug, articlePage };
}

/* ================================================================== */
/*  Article CRUD                                                       */
/* ================================================================== */

test.describe('Article CRUD @articles', () => {
  const createdSlugs: string[] = [];

  test.afterEach(async () => {
    for (const slug of createdSlugs) {
      await deleteArticle(slug);
    }
    createdSlugs.length = 0;
  });

  test('should create an article and verify its content @smoke', async ({ authedPage }) => {
    const article = articlesData.validArticle;

    /* This is the only test that creates via UI — we're testing the UI creation flow */
    const { articlePage } = await createArticleViaUI(authedPage, createdSlugs);

    await expect(articlePage.articleTitle).toHaveText(article.title);
    await expect(articlePage.articleBody).toContainText(article.body);
    await expect(authedPage.locator('.article-meta').first()).toContainText(
      GLOBAL_TEST_USER.username
    );
  });

  test.describe('Global feed @articles', () => {
  test('should show created article in global feed @smoke', async ({ authedPage, seededArticle }) => {
    const homePage = new HomePage(authedPage);
    await homePage.goto();

    const articlePreview = homePage.getArticleByTitle(seededArticle.title);
    await expect(articlePreview).toBeVisible();
    await expect(articlePreview).toContainText(GLOBAL_TEST_USER.username);
    await expect(articlePreview).toContainText(seededArticle.description);
    await expect(articlePreview).toContainText(articlesData.validArticle.tagList[0]!);
    });
  });

  test('should create and then edit an article', async ({ authedPage, seededArticle }) => {
    const updated = articlesData.updatedArticle;

    /* Navigate to the seeded article page */
    const homePage = new HomePage(authedPage);
    await authedPage.goto(`/article/${seededArticle.slug}`);

    const articlePage = new ArticlePage(authedPage);
    const createPage = new CreateArticlePage(authedPage);

    const editResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/articles.updateArticle') && resp.status() === 200
    );

    await articlePage.clickEdit();
    await homePage.waitForURL('/editor/');

    await createPage.editArticle(updated.title, updated.description, updated.body);
    await editResponse;

    await homePage.waitForURL('/article/');

    await expect(articlePage.articleTitle).toHaveText(updated.title);
    await expect(articlePage.articleBody).toContainText(updated.body);
  });

  test('should delete an article', async ({ authedPage, seededArticle }) => {
    const homePage = new HomePage(authedPage);

    /* Navigate directly to the seeded article */
    await authedPage.goto(`/article/${seededArticle.slug}`);

    const articlePage = new ArticlePage(authedPage);

    const deleteResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/articles.deleteArticle') && resp.status() === 200
    );

    await articlePage.clickDelete();
    await deleteResponse;

    await homePage.waitForURL('/');
    await authedPage.goto(`/article/${seededArticle.slug}`);
    await expect(authedPage).toHaveURL('/');
  });

  test('should delete article with comment @articles', async ({ authedPage, seededArticle }) => {
    
    const comment = articlesData.comment;
    const homePage = new HomePage(authedPage);

    await authedPage.goto(`/article/${seededArticle.slug}`);

    const articlePage = new ArticlePage(authedPage);

    /* Add comment */
    const commentResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );

    await articlePage.addComment(comment.body);
    await commentResponse;
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Attempt to delete article with comment — known bug: deletion fails */
    const deleteResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/articles.deleteArticle')
    );

    await articlePage.clickDelete();
    await deleteResponse;
    

    /* After deletion should redirect to home — this is where the bug manifests */
    await homePage.waitForURL('/');
    await authedPage.goto(`/article/${seededArticle.slug}`);
    await expect(authedPage).toHaveURL('/');

    /*
     * NOTE: I intentionally do NOT remove the slug from seededArticle here.
     *
     * This test documents a known bug: articles with comments cannot be deleted.
     * The deletion via UI fails silently — the article remains in the database.
     * The seededArticle fixture will clean it up via deleteArticle(slug).
     *
     * If the bug is ever fixed and deletion succeeds, deleteArticle(slug) will
     * be called on a non-existent article — db.ts handles that gracefully:
     *   if (!article) return;
     */
  });
});

/* ================================================================== */
/*  Comments                                                           */
/* ================================================================== */

test.describe('Article comments @articles', () => {
  test('should add a comment to an article', async ({ authedPage, seededArticle }) => {
    const comment = articlesData.comment;

    await authedPage.goto(`/article/${seededArticle.slug}`);

    const articlePage = new ArticlePage(authedPage);

    const commentResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );

    await articlePage.addComment(comment.body);
    await commentResponse;

    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();
  });

  test('should delete a comment from an article', async ({ authedPage, seededArticle }) => {
    const comment = articlesData.comment;

    await authedPage.goto(`/article/${seededArticle.slug}`);

    const articlePage = new ArticlePage(authedPage);

    /* Add comment first */
    const addCommentResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );
    await articlePage.addComment(comment.body);
    await addCommentResponse;
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Delete comment */
    const deleteCommentResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.removeCommentFromArticle') && resp.status() === 200
    );

    await articlePage.deleteComment(comment.body);
    await deleteCommentResponse;

    await expect(articlePage.comments.filter({ hasText: comment.body })).not.toBeVisible();
  });
});

/* ================================================================== */
/*  Favorites (likes)                                                  */
/* ================================================================== */

test.describe('Article favorites @articles', () => {
  test('should add and remove a favorite', async ({ authedPage, seededArticle }) => {
    const homePage = new HomePage(authedPage);

    /* Go to home and find the seeded article in feed */
    await homePage.goto();

    const articlePreview = homePage.getArticleByTitle(seededArticle.title);
    const favoriteBtn = homePage.getFavoriteButton(articlePreview);

    /* Add favorite */
    const addFavoriteResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/favorites.addArticleAsFavorite') && resp.status() === 200
    );

    await favoriteBtn.click();
    await addFavoriteResponse;
    await expect(favoriteBtn).toContainText('1');

    /* Remove favorite */
    const removeFavoriteResponse = authedPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/favorites.removeArticleFromFavorite') && resp.status() === 200
   );

    await favoriteBtn.click();
    await removeFavoriteResponse;
    await expect(favoriteBtn).toContainText('0');
  });
});

/* ================================================================== */
/*  Global feed                                                        */
/* ================================================================== */

test.describe('Global feed @articles', () => {
  test('should show created article in global feed @smoke', async ({ authedPage, seededArticle }) => {
    const homePage = new HomePage(authedPage);
    await homePage.goto();

    const articlePreview = homePage.getArticleByTitle(seededArticle.title);
    await expect(articlePreview).toBeVisible();
    await expect(articlePreview).toContainText(GLOBAL_TEST_USER.username);
    await expect(articlePreview).toContainText(seededArticle.description);
  });
});