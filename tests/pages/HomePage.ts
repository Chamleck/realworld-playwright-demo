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
   * The class `.article-preview` is reused by ArticleListTabs for three states:
   *   - loading spinner  → <div class="article-preview"><Spinner /></div>
   *   - empty state      → <div class="article-preview">No articles here...</div>
   *   - real article card → only these contain an <h1> with the title
   *
   * Waiting for any `.article-preview` would fire on the spinner before real
   * articles render. We wait for one that contains an <h1> instead.
   */
  const realArticleCard = this.articlePreviews
    .filter({ has: this.page.locator('h1') })
    .first();

  /*
   * Why we search pages 1–4 in repeated passes instead of walking forward:
   *
   * In a parallel run each worker's seededArticle fixture creates one article.
   * With up to 14 workers + 2 UI-created articles = ~16 articles ahead of ours
   * at peak → our article lands at most on page 4 (positions 0–4 = page 1,
   * 5–9 = page 2, 10–14 = page 3, 15–19 = page 4).
   *
   * The naive forward walk (1 → 2 → 3 → ... → N) has a fatal race condition:
   * while we navigate forward, other workers finish their tests and delete their
   * seededArticles. Each deletion shifts our article one position backward
   * (toward page 1). We perpetually chase it in the wrong direction and can
   * traverse 50+ pages without ever finding it.
   *
   * Repeating the 1–4 range up to PASSES times breaks the race: even if the
   * article shifted backward to page 1 while we were on page 3, the next pass
   * starts from page 1 again and catches it.
   *
   * Worst-case time: PASSES × SEARCH_PAGES × ~300 ms/page ≈ 6 s.
   */
  const SEARCH_PAGES = [1, 2, 3, 4];
  const PASSES = 5;

  for (let pass = 0; pass < PASSES; pass++) {
    for (const pageNum of SEARCH_PAGES) {
      const responsePromise = this.page.waitForResponse(
        resp =>
          resp.url().includes('/api/trpc/articles.getArticles') &&
          resp.status() === 200,
      );

      /*
       * Navigate via URL rather than clicking pagination links — avoids stale
       * locator issues when the DOM updates between pages. Page 1 uses '/'
       * (no param) so the Pagination component renders its default active state.
       */
      await this.page.goto(pageNum === 1 ? '/' : `/?offset=${pageNum}`);
      await responsePromise;
      await realArticleCard.waitFor({ state: 'attached', timeout: 10_000 });

      if (await preview.count() > 0) return preview;
    }
  }

  /*
   * Article not found after all passes — return the locator anyway so the
   * caller's expect().toBeVisible() fails with a meaningful Playwright error
   * that shows the expected title.
   */
  return preview;
  }
}