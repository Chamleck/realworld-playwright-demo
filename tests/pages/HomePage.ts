/**
 * HomePage — /
 *
 * Contains the article feed, popular tags sidebar, and pagination.
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly bannerTitle: Locator;
  readonly globalFeedTab: Locator;
  readonly yourFeedTab: Locator;
  readonly articlePreviews: Locator;
  readonly popularTags: Locator;

  constructor(page: Page) {
    super(page);
    this.bannerTitle = page.getByTestId('banner-title');
    this.globalFeedTab = page.getByRole('link', { name: 'Global Feed' });
    this.yourFeedTab = page.getByRole('link', { name: 'Your Feed' });
    this.articlePreviews = page.locator('.article-preview');
    this.popularTags = page.locator('.sidebar .tag-pill');
  }

  async goto() {
    await super.goto('/');
  }

  /* Get a specific article preview by its title */
  getArticleByTitle(title: string): Locator {
    return this.articlePreviews.filter({
      has: this.page.getByRole('heading', { name: title }),
    });
  }

  /* Get the favorite (heart) button within a specific article preview */
  getFavoriteButton(articlePreview: Locator): Locator {
    return articlePreview.locator('.btn-outline-primary, .btn-primary').first();
  }

  /* Get the favorite count within a specific article preview */
  getFavoriteCount(articlePreview: Locator): Locator {
    return this.getFavoriteButton(articlePreview);
  }

  /* Click on an article title to navigate to the article page */
  async clickArticle(title: string) {
    await this.page.getByRole('link', { name: title }).first().click();
  }

  /* Click on a tag in the sidebar */
  async clickTag(tagName: string) {
    await this.popularTags.filter({ hasText: tagName }).click();
  }
}