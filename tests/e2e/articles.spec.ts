/**
 * Articles E2E Tests — CRUD, Favorites, Comments
 *
 * Uses authedTest fixture (GLOBAL_TEST_USER session from globalSetup).
 * page fixture automatically starts logged in via context override.
 * Page Objects are provided as fixtures (homePage, articlePage, createArticlePage).
 *
 * Two strategies for article data:
 *   - createUiArticle fixture: used ONLY in the test that verifies UI creation. It is a
 *     factory — the test calls it, so the creation flow runs in the test body — and
 *     the fixture deletes whatever was created in its own finally.
 *   - seededArticle fixture: used in all other tests where an article is a precondition.
 *     Creates the article via API with a unique title → no slug collisions in parallel.
 *
 * Tags: @articles, @smoke
 */

import { authedTest as test, expect } from '../fixtures/test-fixtures';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import articlesData from '../fixtures/data/articles.json';
import { ROUTES, PAGES } from '../helpers/routes';
import { expectResponse } from '../helpers/expectResponse';

/* ================================================================== */
/*  Article CRUD                                                       */
/* ================================================================== */

test.describe('Article CRUD @articles', () => {

  test('should create an article and verify its content @smoke', async ({ createUiArticle }) => {

    const article = articlesData.validArticle;

    /* The creation flow under test runs here, in the test body; the fixture
     * deletes the article afterwards — no manual slug tracking needed. */
    const { title, articlePage } = await createUiArticle();

    await expect(articlePage.articleTitle).toHaveText(title);
    await expect(articlePage.articleBody).toContainText(article.body);
    await expect(articlePage.articleMeta).toContainText(GLOBAL_TEST_USER.username);
  });

/* ================================================================== */
/*  Global feed                                                        */
/* ================================================================== */

  test.describe('Global feed @articles', () => {

  test('should show created article in global feed @smoke', async ({ homePage, seededArticle }) => {

    await homePage.goto();

    const articlePreview = await homePage.findArticleAcrossPages(seededArticle.title);
    await expect(articlePreview).toBeVisible();
    await expect(articlePreview).toContainText(GLOBAL_TEST_USER.username);
    await expect(articlePreview).toContainText(seededArticle.description);
    await expect(articlePreview).toContainText(articlesData.validArticle.tagList[0]!);
    });
  });

  test('should create and then edit an article', async ({ homePage, articlePage, createArticlePage, seededArticle }) => {

    const updated = articlesData.updatedArticle;

    await articlePage.gotoArticle(seededArticle.slug);

    await articlePage.clickEdit();
    await homePage.waitForURL(PAGES.anyArticleEditor);

    /* The app leaves the editor only in updateArticle's onSuccess, and the article
     * page re-fetches from the server — so the new title on screen proves the
     * update was persisted, without coupling to the tRPC call. */
    await createArticlePage.editArticle(updated.title, updated.description, updated.body);
    await homePage.waitForURL(PAGES.anyArticle);

    await expect(articlePage.articleTitle).toHaveText(updated.title);
    await expect(articlePage.articleBody).toContainText(updated.body);
  });

  test('should delete an article', async ({ page, articlePage, seededArticle }) => {

    await articlePage.gotoArticle(seededArticle.slug);

    /* The app redirects home only in deleteArticle's onSuccess — reaching home
     * means the server confirmed the deletion. Awaiting it before the next goto
     * also prevents NS_BINDING_ABORTED on Firefox/WebKit. waitForURL returns at
     * once if the redirect has already happened, so calling it after the click
     * cannot miss the navigation. */
    await articlePage.clickDelete();
    await articlePage.waitForURL(PAGES.home);

    /* Re-opening the deleted article redirects home: it no longer exists */
    await articlePage.gotoArticle(seededArticle.slug);
    await expect(page).toHaveURL(PAGES.home);
  });

  test('should delete article with comment @articles', async ({ page, articlePage, seededArticle }) => {
    test.fail(true, 'Known bug: FK constraint prevents article deletion when comments exist');

    const comment = articlesData.comment;

    await articlePage.gotoArticle(seededArticle.slug);

    /* Add comment — the list re-fetches only after the server saved it */
    await articlePage.addComment(comment.body);
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Known bug: the server answers 500 (Prisma FK constraint on the comment), so
     * the test fails right here, fast and with the real cause:
     *   "HTTP status of articles.deleteArticle: expected 200, received 500".
     * The status is asserted on the response because the UI outcome of the bug is
     * the ABSENCE of a redirect, which can only be observed by waiting for a timeout. */
    await expectResponse(page, ROUTES.articles.deleteArticle, 200, () => articlePage.clickDelete());

    /* Reached only once the bug is fixed — then test.fail reports
     * "expected to fail but passed", the signal to remove the annotation. */
    await articlePage.waitForURL(PAGES.home);
    await articlePage.gotoArticle(seededArticle.slug);
    await expect(page).toHaveURL(PAGES.home);

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
  /*
   * No network waits in this block: the comment list and the favorite counter update
   * only in the mutations' onSuccess (cache invalidation / server response — no
   * optimistic UI in the app), so the web-first assertion on what the user sees is
   * already proof that the server accepted the change.
   */
  test('should add a comment to an article', async ({ articlePage, seededArticle }) => {

    const comment = articlesData.comment;

    await articlePage.gotoArticle(seededArticle.slug);
    await articlePage.addComment(comment.body);

    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();
  });

  test('should delete a comment from an article', async ({ articlePage, seededArticle }) => {

    const comment = articlesData.comment;

    await articlePage.gotoArticle(seededArticle.slug);

    /* Add comment first */
    await articlePage.addComment(comment.body);
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Delete comment */
    await articlePage.deleteComment(comment.body);

    await expect(articlePage.comments.filter({ hasText: comment.body })).not.toBeVisible();
  });
});

/* ================================================================== */
/*  Favorites (likes)                                                  */
/* ================================================================== */

test.describe('Article favorites @articles', () => {
  test('should add and remove a favorite', async ({ homePage, seededArticle }) => {

    /* Find the seeded article in the feed. findArticleAcrossPages, not a page-1
     * lookup: under parallel load other workers' articles can push ours off page 1. */
    await homePage.goto();
    const articlePreview = await homePage.findArticleAcrossPages(seededArticle.title);
    const favoriteBtn = homePage.getFavoriteButton(articlePreview);

    /* Add favorite — the counter comes from the server response */
    await favoriteBtn.click();
    await expect(favoriteBtn).toContainText('1');

    /* Remove favorite */
    await favoriteBtn.click();
    await expect(favoriteBtn).toContainText('0');
  });
});
