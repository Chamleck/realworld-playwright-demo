/**
 * BasePage — base class for all Page Objects.
 *
 * Holds the `page` instance and provides shared navigation helpers.
 * Every Page Object extends this class and receives `page` via constructor.
 */

import { type Page, type Locator } from '@playwright/test';
import { PAGES } from '../helpers/routes';

export class BasePage {
  readonly page: Page;

  /* Common navigation elements used across specs */
  readonly navSignIn: Locator;
  readonly navNewArticle: Locator;

  constructor(page: Page) {
    this.page = page;

    /* Guest nav link — visible when logged out (login/logout assertions) */
    this.navSignIn = page.getByRole('link', { name: 'Sign in' });

    /* Authenticated nav link — used by the UI article-creation flow */
    this.navNewArticle = page.getByRole('link', { name: 'New Article' });
  }

  /* Navigate to a path relative to baseURL — pass PAGES.* values, not literals */
  async goto(path: string = PAGES.home) {
    await this.page.goto(path);
  }

  /* Get the nav link to the current user's profile (dynamic text) */
  getNavProfile(username: string): Locator {
    return this.page.locator('.navbar').getByRole('link', { name: username });
  }

  /* Get error messages displayed on forms (ul.error-messages > li) */
  get errorMessages(): Locator {
    return this.page.locator('.error-messages li');
  }

  /**
   * Wait until the current pathname matches `path` (a PAGES.* value).
   *
   * string → exact pathname; RegExp → tested against the pathname.
   *
   * Why a predicate and not the old `**${path}**` glob: that glob made
   * waitForURL('/') match EVERY URL (`**` + `/` + `**`), so redirects to home were
   * never actually awaited and the following assertion raced the navigation. Matching
   * the pathname exactly also stops '/editor' from matching '/editor/some-slug'.
   * The predicate is evaluated on same-document (history API) navigations too, which
   * is how the Next.js router moves between pages.
   */
  async waitForURL(path: string | RegExp) {
    await this.page.waitForURL((url) =>
      typeof path === 'string' ? url.pathname === path : path.test(url.pathname)
    );
  }
}
