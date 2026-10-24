/**
 * Articles E2E Tests — CRUD, Favorites, Comments
 *
 * Uses authedTest fixture (GLOBAL_TEST_USER session from globalSetup).
 * page fixture automatically starts logged in via context override.
 * Page Objects are provided as fixtures (homePage, articlePage, createArticlePage).
 *
 * Two strategies for article data:
 *   - uiArticle fixture: used ONLY in the test that verifies UI creation. Creates the
 *     article via the editor UI and cleans it up in its own finally.
 *   - seededArticle fixture: used in all other tests where an article is a precondition.
 *     Creates the article via API with a unique title → no slug collisions in parallel.
 *
 * Tags: @articles, @smoke
 */

import { authedTest as test, expect } from '../fixtures/test-fixtures';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import articlesData from '../fixtures/data/articles.json';
import { expectResponse } from '../helpers/expectResponse';
import { ROUTES } from '../helpers/routes';

/* ================================================================== */
/*  Article CRUD                                                       */
/* ================================================================== */

test.describe('Article CRUD @articles', () => {

  test('should create an article and verify its content @smoke', async ({ uiArticle }) => {

    const article = articlesData.validArticle;

    /* uiArticle created the article through the UI (the flow under test) and
     * will delete it afterwards — no manual slug tracking needed here. */
    const { articlePage } = uiArticle;

    await expect(articlePage.articleTitle).toHaveText(article.title);
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

  test('should create and then edit an article', async ({ page, homePage, articlePage, createArticlePage, seededArticle }) => {

    const updated = articlesData.updatedArticle;

    /* Navigate to the seeded article page */
    await page.goto(`/article/${seededArticle.slug}`);

    await articlePage.clickEdit();
    await homePage.waitForURL('/editor/');

    await expectResponse(page, ROUTES.articles.updateArticle, 200, () =>
      createArticlePage.editArticle(updated.title, updated.description, updated.body)
    );

    await homePage.waitForURL('/article/');

    await expect(articlePage.articleTitle).toHaveText(updated.title);
    await expect(articlePage.articleBody).toContainText(updated.body);
  });

  test('should delete an article', async ({ page, homePage, articlePage, seededArticle }) => {

    /* Navigate directly to the seeded article */
    await page.goto(`/article/${seededArticle.slug}`);

    await expectResponse(page, ROUTES.articles.deleteArticle, 200, () =>
      articlePage.clickDelete()
    );

    await homePage.waitForURL('/');
    await page.goto(`/article/${seededArticle.slug}`);
    await expect(page).toHaveURL('/');
  });

  test('should delete article with comment @articles', async ({ page, homePage, articlePage, seededArticle }) => {
    test.fail(true, 'Known bug: FK constraint prevents article deletion when comments exist');

    const comment = articlesData.comment;

    await page.goto(`/article/${seededArticle.slug}`);

    /* Add comment */
    await expectResponse(page, ROUTES.comments.addCommentToArticle, 200, () =>
      articlePage.addComment(comment.body)
    );
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Attempt to delete article with comment — known bug: deletion fails.
     * We don't constrain the status here — the bug is exactly that this request
     * does not succeed, so we only wait for the deleteArticle call to happen. */
    const deleteResponse = page.waitForResponse(
      (resp) => resp.url().includes(ROUTES.articles.deleteArticle)
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
  test('should add a comment to an article', async ({ page, articlePage, seededArticle }) => {

    const comment = articlesData.comment;

    await page.goto(`/article/${seededArticle.slug}`);

    await expectResponse(page, ROUTES.comments.addCommentToArticle, 200, () =>
      articlePage.addComment(comment.body)
    );

    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();
  });

  test('should delete a comment from an article', async ({ page, articlePage, seededArticle }) => {

    const comment = articlesData.comment;

    await page.goto(`/article/${seededArticle.slug}`);

    /* Add comment first */
    await expectResponse(page, ROUTES.comments.addCommentToArticle, 200, () =>
      articlePage.addComment(comment.body)
    );
    await expect(articlePage.comments.filter({ hasText: comment.body })).toBeVisible();

    /* Delete comment */
    await expectResponse(page, ROUTES.comments.removeCommentFromArticle, 200, () =>
      articlePage.deleteComment(comment.body)
    );

    await expect(articlePage.comments.filter({ hasText: comment.body })).not.toBeVisible();
  });
});

/* ================================================================== */
/*  Favorites (likes)                                                  */
/* ================================================================== */

test.describe('Article favorites @articles', () => {
  test('should add and remove a favorite', async ({ page, homePage, seededArticle }) => {

    /* Go to home and find the seeded article in feed */
    await homePage.goto();

    const articlePreview = homePage.getArticleByTitle(seededArticle.title);
    const favoriteBtn = homePage.getFavoriteButton(articlePreview);

    /* Add favorite */
    await expectResponse(page, ROUTES.favorites.addArticleAsFavorite, 200, () =>
      favoriteBtn.click()
    );
    await expect(favoriteBtn).toContainText('1');

    /* Remove favorite */
    await expectResponse(page, ROUTES.favorites.removeArticleFromFavorite, 200, () =>
      favoriteBtn.click()
    );
    await expect(favoriteBtn).toContainText('0');
  });
});
