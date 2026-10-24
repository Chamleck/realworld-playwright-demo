/**
 * HomePage — /
 *
 * Contains the article feed and pagination used by the global-feed tests.
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';
import { ROUTES, PAGES } from '../helpers/routes';
import { expectResponse } from '../helpers/expectResponse';

export class HomePage extends BasePage {
  readonly articlePreviews: Locator;

  constructor(page: Page) {
    super(page);
    this.articlePreviews = page.locator('.article-preview');
  }

  async goto() {
    await test.step('Navigate to home page', async () => {
      await super.goto(PAGES.home);
    });
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
      /*
       * Navigate via URL rather than clicking pagination links — avoids stale
       * locator issues when the DOM updates between pages. Page 1 uses the bare home
       * path (no param) so the Pagination component renders its default active state.
       * The feed is fetched client-side after load, hence the wait on getArticles.
       */
      const target = pageNum === 1 ? PAGES.home : `${PAGES.home}?offset=${pageNum}`;
      await expectResponse(this.page, ROUTES.articles.getArticles, 200, () =>
        this.page.goto(target)
      );
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
