/**
 * ArticlePage — /article/[slug]
 *
 * Displays article content, comments, favorite/follow buttons, and edit/delete controls.
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';

export class ArticlePage extends BasePage {
  readonly articleTitle: Locator;
  readonly articleBody: Locator;
  readonly articleTags: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly comments: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly favoriteButton: Locator;
  readonly followButton: Locator;
  readonly authorLink: Locator;
  readonly articleMeta: Locator;

  constructor(page: Page) {
    super(page);
    this.articleTitle = page.locator('.banner h1');
    this.articleBody = page.locator('.article-content');
    this.articleTags = page.locator('.tag-list .tag-pill');
    this.commentInput = page.getByPlaceholder('Write a comment...');
    this.postCommentButton = page.getByRole('button', { name: 'Post Comment' });
    this.comments = page.locator('.card');
    this.editButton = page.getByRole('link', { name: /Edit Article/i });
    this.deleteButton = page.getByRole('button', { name: /Delete Article/i });
    this.favoriteButton = page.locator('.article-meta .btn-outline-primary, .article-meta .btn-primary').first();
    this.followButton = page.locator('.article-meta .btn-outline-secondary, .article-meta .btn-secondary').first();
    this.authorLink = page.locator('.article-meta').first().getByRole('link').first();
    this.articleMeta = page.locator('.article-meta').first();
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

  /* Click the favorite button (toggle) */
  async toggleFavorite() {
    await test.step('Toggle favorite', async () => {
      await this.favoriteButton.click();
    });
  }

  /* Click the follow button (toggle) */
  async toggleFollow() {
    await test.step('Toggle follow', async () => {
      await this.followButton.click();
    });
  }

  /* Click Edit Article — navigates to /editor/[slug] */
  async clickEdit() {
    await test.step('Click Edit Article', async () => {
      await this.editButton.first().click();
    });
  }

  /* Click Delete Article — shows confirmation dialog */
  async clickDelete() {
    await test.step('Click Delete Article', async () => {
      this.page.once('dialog', dialog => dialog.accept());
      await this.deleteButton.first().click();
      await this.page.waitForLoadState('networkidle');
    });
  }
}