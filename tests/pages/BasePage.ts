/**
 * BasePage — base class for all Page Objects.
 *
 * Holds the `page` instance and provides shared navigation helpers.
 * Every Page Object extends this class and receives `page` via constructor.
 */

import { type Page, type Locator } from '@playwright/test';

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

  /* Navigate to a path relative to baseURL */
  async goto(path = '/') {
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

  /* Wait for navigation to complete (URL contains the expected path) */
  async waitForURL(path: string) {
    await this.page.waitForURL(`**${path}**`);
  }
}
