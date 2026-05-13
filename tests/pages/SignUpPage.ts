/**
 * SignUpPage — /register
 *
 * Register form does NOT have data-testid attributes,
 * so we use getByPlaceholder() for inputs and getByRole() for the button.
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignUpPage extends BasePage {
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByPlaceholder('Username');
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign up' });
    this.loginLink = page.getByRole('link', { name: 'Have an account?' });
  }

  async goto() {
    await test.step('Navigate to register page', async () => {
      await super.goto('/register');
    });
  }

  async register(username: string, email: string, password: string) {
    await test.step(`Register user: ${username}`, async () => {
      await this.usernameInput.fill(username);
      await this.emailInput.fill(email);
      await this.passwordInput.fill(password);
      await this.submitButton.click();
    });
  }
}