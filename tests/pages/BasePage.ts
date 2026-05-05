/**
 * BasePage — base class for all Page Objects.
 *
 * Holds the `page` instance and provides shared navigation helpers.
 * Every Page Object extends this class and receives `page` via constructor.
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  /* Common navigation elements (visible on every page) */
  readonly navHome: Locator;
  readonly navSignIn: Locator;
  readonly navSignUp: Locator;
  readonly navNewArticle: Locator;
  readonly navSettings: Locator;

  constructor(page: Page) {
    this.page = page;

    /* Guest nav links */
    this.navHome = page.getByRole('link', { name: 'Home' });
    this.navSignIn = page.getByRole('link', { name: 'Sign in' });
    this.navSignUp = page.getByRole('link', { name: 'Sign up' });

    /* Authenticated nav links */
    this.navNewArticle = page.getByRole('link', { name: 'New Article' });
    this.navSettings = page.getByRole('link', { name: 'Settings' });
  }

  /* Navigate to a path relative to baseURL */
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  /* Get the nav link to the current user's profile (dynamic text) */
  getNavProfile(username: string): Locator {
    return this.page.getByRole('link', { name: username }).filter({ has: this.page.locator('.user-pic') });
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