/**
 * Articles E2E Tests — CRUD, Favorites, Comments
 *
 * Uses authedTest fixture (GLOBAL_TEST_USER session from globalSetup).
 * page fixture automatically starts logged in via context override.
 *
 * Two strategies for article data:
 *   - createArticleViaUI helper: used ONLY in the test that verifies UI creation.
 *   - seededArticle fixture: used in all other tests where article is a precondition.
 *     Creates article via API with unique title → no slug collisions in parallel runs.
 *
 * Tags: @articles, @smoke
 */

import { authedTest as test, expect } from '../fixtures/test-fixtures';
import {
  HomePage,
  CreateArticlePage,
  ArticlePage,
} from '../pages';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import articlesData from '../fixtures/data/articles.json';
import { deleteArticle } from '../helpers/db';
import { createArticleViaUI } from '../helpers/articles';

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

  test('should create an article and verify its content @smoke', async ({ page }) => {

    const article = articlesData.validArticle;

    /* This is the only test that creates via UI — we're testing the UI creation flow */
    const { articlePage } = await createArticleViaUI(page, createdSlugs);

    await expect(articlePage.articleTitle).toHaveText(article.title);
    await expect(articlePage.articleBody).toContainText(article.body);
    await expect(articlePage.articleMeta).toContainText(GLOBAL_TEST_USER.username);
  });

/* ================================================================== */
/*  Global feed                                                        */
/* ================================================================== */

  test.describe('Global feed @articles', () => {

  test('should show created article in global feed @smoke', async ({ page, seededArticle }) => {

    const homePage = new HomePage(page);

    await homePage.goto();

    const articlePreview = await homePage.findArticleAcrossPages(seededArticle.title);
    await expect(articlePreview).toBeVisible();
    await expect(articlePreview).toContainText(GLOBAL_TEST_USER.username);
    await expect(articlePreview).toContainText(seededArticle.description);
    await expect(articlePreview).toContainText(articlesData.validArticle.tagList[0]!);
    });
  });

  test('should create and then edit an article', async ({ page, seededArticle }) => {

    const updated = articlesData.updatedArticle;

    const homePage = new HomePage(page);
    const articlePage = new ArticlePage(page);
    const createPage = new CreateArticlePage(page);

    /* Navigate to the seeded article page */
    await page.goto(`/article/${seededArticle.slug}`);

    const editResponse = page.waitForResponse(
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

  test('should delete an article', async ({ page, seededArticle }) => {

    const homePage = new HomePage(page);
    const articlePage = new ArticlePage(page);

    /* Navigate directly to the seeded article */
    await page.goto(`/article/${seededArticle.slug}`);

    const deleteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/articles.deleteArticle') && resp.status() === 200
    );

    await articlePage.clickDelete();
    await deleteResponse;

    await homePage.waitForURL('/');
    await page.goto(`/article/${seededArticle.slug}`);
    await expect(page).toHaveURL('/');
  });

  test('should delete article with comment @articles', async ({ page, seededArticle }) => {
    //test.fail(true, 'Known bug: FK constraint prevents article deletion when comments exist');
    
    const comment = articlesData.comment;
    const homePage = new HomePage(page);
    const articlePage = new ArticlePage(page);

    await page.goto(`/article/${seededArticle.slug}`);

    /* Add comment */
    const commentResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );

    await articlePage.addComment(comment.body);
    await commentResponse;
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Attempt to delete article with comment — known bug: deletion fails */
    const deleteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/articles.deleteArticle')
    );

    await articlePage.clickDelete();
    await deleteResponse;
    

    /* After deletion should redirect to home — this is where the bug manifests */
    await homePage.waitForURL('/');
    await page.goto(`/article/${seededArticle.slug}`);
    await expect(page).toHaveURL('/');

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
  test('should add a comment to an article', async ({ page, seededArticle }) => {

    const comment = articlesData.comment;
    const articlePage = new ArticlePage(page);

    await page.goto(`/article/${seededArticle.slug}`);

    const commentResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );

    await articlePage.addComment(comment.body);
    await commentResponse;

    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();
  });

  test('should delete a comment from an article', async ({ page, seededArticle }) => {

    const comment = articlesData.comment;
    const articlePage = new ArticlePage(page);

    await page.goto(`/article/${seededArticle.slug}`);

    /* Add comment first */
    const addCommentResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/comments.addCommentToArticle') && resp.status() === 200
    );
    await articlePage.addComment(comment.body);
    await addCommentResponse;
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Delete comment */
    const deleteCommentResponse = page.waitForResponse(
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
  test('should add and remove a favorite', async ({ page, seededArticle }) => {

    const homePage = new HomePage(page);

    /* Go to home and find the seeded article in feed */
    await homePage.goto();

    const articlePreview = homePage.getArticleByTitle(seededArticle.title);
    const favoriteBtn = homePage.getFavoriteButton(articlePreview);

    /* Add favorite */
    const addFavoriteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/favorites.addArticleAsFavorite') && resp.status() === 200
    );

    await favoriteBtn.click();
    await addFavoriteResponse;
    await expect(favoriteBtn).toContainText('1');

    /* Remove favorite */
    const removeFavoriteResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/favorites.removeArticleFromFavorite') && resp.status() === 200
   );

    await favoriteBtn.click();
    await removeFavoriteResponse;
    await expect(favoriteBtn).toContainText('0');
  });
});

