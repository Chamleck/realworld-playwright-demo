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
  readonly paginationLinks: Locator;

  constructor(page: Page) {
    super(page);
    this.bannerTitle = page.getByTestId('banner-title');
    this.globalFeedTab = page.getByRole('link', { name: 'Global Feed' });
    this.yourFeedTab = page.getByRole('link', { name: 'Your Feed' });
    this.articlePreviews = page.locator('.article-preview');
    this.popularTags = page.locator('.sidebar .tag-pill');
    this.paginationLinks = page.locator('ul.pagination li.page-item:not(.active) a.page-link');
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

  async findArticleAcrossPages(title: string): Promise<Locator> {
  const preview = this.getArticleByTitle(title);

  /*
   * The class `.article-preview` is reused by the feed for three things:
   *   - the loading-state spinner
   *   - the empty-state message "No articles are here... yet."
   *   - the actual article cards (only these contain an <h1> with the title)
   * We must wait for a card with an <h1>, otherwise the spinner element matches
   * `.article-preview` immediately and we end up checking count() against the
   * loading placeholder before the real articles render.
   */
  const realArticleCard = this.articlePreviews.filter({ has: this.page.locator('h1') }).first();
  // Articles load async via tRPC — wait for at least one to appear in DOM
  // before checking for the specific one (count() doesn't retry)
  await realArticleCard.waitFor({ state: 'attached', timeout: 10_000 });

  if (await preview.count() > 0) return preview;

  // Collect all page numbers from pagination (excludes '...' — rendered as <span>, not <a>)
  const pageTexts = await this.paginationLinks.allTextContents();
  const pageNumbers = pageTexts
    .map(t => parseInt(t.trim()))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  for (const pageNum of pageNumbers) {
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/api/trpc/articles.getArticles') && resp.status() === 200
    );
    await this.page.goto(`/?offset=${pageNum}`);
    await responsePromise;

    // Same wait — for a real article card, not the spinner placeholder
    await realArticleCard.waitFor({ state: 'attached', timeout: 10_000 });

    if (await preview.count() > 0) return preview;
  }

  // Article not found on any page — return locator anyway so toBeVisible() fails with a
  // meaningful Playwright error message showing which title was expected
  return preview;
  }
}