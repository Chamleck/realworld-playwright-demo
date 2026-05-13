/**
 * ProfilePage — /profile/[username] and /settings
 *
 * Combines profile view and settings form in one Page Object
 * since they share the same user context and are tested together.
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProfilePage extends BasePage {
  /* Profile view (/profile/[username]) */
  readonly profileUsername: Locator;
  readonly profileBio: Locator;
  readonly profileImage: Locator;
  readonly myArticlesTab: Locator;
  readonly favoritedArticlesTab: Locator;
  readonly editProfileButton: Locator;
  readonly followButton: Locator;

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

    /* Profile view locators */
    this.profileUsername = page.locator('h4');
    this.profileBio = page.locator('p').filter({ has: page.locator(':not(a)') });
    this.profileImage = page.locator('.user-img');
    this.myArticlesTab = page.getByRole('link', { name: 'My Articles' });
    this.favoritedArticlesTab = page.getByRole('link', { name: 'Favorited Articles' });
    this.editProfileButton = page.getByRole('link', { name: /Edit Profile Settings/i });
    this.followButton = page.locator('.btn-outline-secondary, .btn-secondary').first();

    /* Settings form locators */
    this.imageInput = page.getByPlaceholder('URL of profile picture');
    this.usernameInput = page.getByPlaceholder('Your Name');
    this.bioInput = page.getByPlaceholder('Short bio about you');
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('New Password');
    this.updateButton = page.getByRole('button', { name: 'Update Settings' });
    this.logoutButton = page.getByRole('button', { name: /logout/i });
  }

  async gotoProfile(username: string) {
    await test.step(`Navigate to profile: ${username}`, async () => {
      await super.goto(`/profile/${encodeURIComponent(username)}`);
    });
  }

  async gotoSettings() {
    await test.step('Navigate to settings', async () => {
      await super.goto('/settings');
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
      await this.logoutButton.click();
    });
  }
}