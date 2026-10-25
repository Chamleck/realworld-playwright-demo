/**
 * ArticlePage — /article/[slug]
 *
 * Displays article content, comments, and edit/delete controls.
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';
import { PAGES } from '../helpers/routes';

export class ArticlePage extends BasePage {
  readonly articleTitle: Locator;
  readonly articleBody: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly comments: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly articleMeta: Locator;

  constructor(page: Page) {
    super(page);
    this.articleTitle = page.locator('.banner h1');
    this.articleBody = page.locator('.article-content');
    this.commentInput = page.getByPlaceholder('Write a comment...');
    this.postCommentButton = page.getByRole('button', { name: 'Post Comment' });
    this.comments = page.locator('.card');
    this.editButton = page.getByRole('link', { name: /Edit Article/i });
    this.deleteButton = page.getByRole('button', { name: /Delete Article/i });
    this.articleMeta = page.locator('.article-meta').first();
  }

  /* Open an article by slug */
  async gotoArticle(slug: string) {
    await test.step(`Open article: ${slug}`, async () => {
      await super.goto(PAGES.article(slug));
    });
  }

  /* Get the slug from the current URL */
  getSlugFromURL(): string {
    const url = this.page.url();
    const match = url.match(/\/article\/(.+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  /* Add a comment to the article */
  async addComment(text: string) {
    await test.step('Add comment', async () => {
      await this.commentInput.fill(text);
      await this.postCommentButton.click();
    });
  }

  /* Delete a comment by its text content */
  async deleteComment(text: string) {
    await test.step(`Delete comment: ${text}`, async () => {
      const comment = this.comments.filter({ hasText: text });
      await comment.locator('i.ion-trash-a').click();
    });
  }

  /* Click Edit Article — navigates to /editor/[slug] */
  async clickEdit() {
    await test.step('Click Edit Article', async () => {
      await this.editButton.first().click();
    });
  }

  /* Click Delete Article and confirm.
   * The app asks window.confirm() before deleting. The handler is registered BEFORE
   * the click because Playwright auto-dismisses unhandled dialogs — confirm() would
   * return false and no delete request would be sent.
   * Deliberately does NOT wait for the outcome: the caller decides what to assert —
   * the redirect home (successful deletion) or the deleteArticle response status
   * (the known FK bug answers 500 and never redirects, so a built-in redirect wait
   * would turn that failure into a 30 s navigation timeout). */
  async clickDelete() {
    await test.step('Click Delete Article', async () => {
      this.page.once('dialog', (dialog) => dialog.accept());
      await this.deleteButton.first().click();
    });
  }
}
