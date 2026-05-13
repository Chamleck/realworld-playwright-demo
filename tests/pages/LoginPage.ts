/**
 * LoginPage — /login
 *
 * Login form has data-testid attributes:
 *   input-email, input-password, btn-submit
 */

import { type Page, type Locator, test } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByTestId('input-email');
    this.passwordInput = page.getByTestId('input-password');
    this.submitButton = page.getByTestId('btn-submit');
    this.registerLink = page.getByRole('link', { name: 'Need an account?' });
  }

  async goto() {
    await test.step('Navigate to login page', async () => {
      await super.goto('/login');
    });
  }

  async login(email: string, password: string) {
    await test.step(`Login as ${email}`, async () => {
      await this.emailInput.fill(email);
      await this.passwordInput.fill(password);
      await this.submitButton.click();
    });
  }
}