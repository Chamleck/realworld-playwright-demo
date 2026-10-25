/**
 * SettingsPage — /settings
 *
 * Wraps the settings form (profile update + logout). Named after the page it models:
 * the read-only profile view (/profile/[username]) is not exercised by any spec, so it
 * has no Page Object yet — add a ProfilePage alongside the first test that needs it.
 */

import { type Page, type Locator, test, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { PAGES } from '../helpers/routes';

export class SettingsPage extends BasePage {
  /* Settings form (/settings) */
  readonly imageInput: Locator;
  readonly usernameInput: Locator;
  readonly bioInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly updateButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);

    /* Settings form locators */
    this.imageInput = page.getByPlaceholder('URL of profile picture');
    this.usernameInput = page.getByPlaceholder('Your Name');
    this.bioInput = page.getByPlaceholder('Short bio about you');
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('New Password');
    this.updateButton = page.getByRole('button', { name: 'Update Settings' });
    this.logoutButton = page.getByRole('button', { name: /logout/i });
  }

  async goto() {
    await test.step('Navigate to settings', async () => {
      /*
       * Why toPass() around a plain goto:
       * The app redirects to '/' TWICE after a successful login/register — once in the
       * mutation's onSuccess and once more from a useEffect that fires when isLoggedIn
       * flips to true (src/pages/register/index.tsx, src/pages/login/index.tsx). The
       * second client-side push can land while page.goto('/settings') is in flight and
       * aborts it ("Navigation ... is interrupted by another navigation to '/'").
       * Seen on mobile-safari at ~1 in 10 runs of the register → logout test.
       *
       * There is no DOM signal for "the redundant push has happened" (both pushes target
       * the same URL), so the robust option is to retry the navigation itself. Once goto
       * has committed a fresh document the stale push is gone with the old page, so one
       * retry is enough in practice; the URL assertion proves we actually stayed there.
       * src/ is not modified (project rule), hence the test-side guard; the app bug is
       * documented under "Known application bugs" in CLAUDE.md.
       */
      await expect(async () => {
        await super.goto(PAGES.settings);
        await expect(this.page).toHaveURL(PAGES.settings, { timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
    });
  }

  async updateSettings(fields: {
    username?: string;
    bio?: string;
    email?: string;
    password?: string;
    image?: string;
  }) {
    await test.step('Update settings', async () => {
      if (fields.image !== undefined) {
        await this.imageInput.clear();
        await this.imageInput.fill(fields.image);
      }
      if (fields.username !== undefined) {
        await this.usernameInput.clear();
        await this.usernameInput.fill(fields.username);
      }
      if (fields.bio !== undefined) {
        await this.bioInput.clear();
        await this.bioInput.fill(fields.bio);
      }
      if (fields.email !== undefined) {
        await this.emailInput.clear();
        await this.emailInput.fill(fields.email);
      }
      if (fields.password !== undefined) {
        await this.passwordInput.fill(fields.password);
      }
      await this.updateButton.click();
    });
  }

  async logout() {
    await test.step('Logout', async () => {
      await Promise.all([
        this.waitForURL(PAGES.home),
        this.logoutButton.click(),
      ]);
    });
  }
}
