/**
 * CreateArticlePage — /editor (create) and /editor/[slug] (edit)
 *
 * Shared form component: CreateOrUpdateArticleForm.
 * No data-testid attributes — using getByPlaceholder().
 */

import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class CreateArticlePage extends BasePage {
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly bodyInput: Locator;
  readonly tagInput: Locator;
  readonly publishButton: Locator;

  constructor(page: Page) {
    super(page);
    this.titleInput = page.getByPlaceholder('Article Title');
    this.descriptionInput = page.getByPlaceholder("What's this article about?");
    this.bodyInput = page.getByPlaceholder('Write your article (in markdown)');
    this.tagInput = page.getByPlaceholder('Enter tags');
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });
  }

  async goto() {
    await super.goto('/editor');
  }

  async createArticle(title: string, description: string, body: string, tag?: string) {
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
    await this.bodyInput.fill(body);
    if (tag) {
      await this.tagInput.fill(tag);
      await this.tagInput.press('Enter');
    }
    await this.publishButton.click();
  }

  async editArticle(title: string, description: string, body: string) {
    await this.titleInput.clear();
    await this.titleInput.fill(title);
    await this.descriptionInput.clear();
    await this.descriptionInput.fill(description);
    await this.bodyInput.clear();
    await this.bodyInput.fill(body);
    await this.publishButton.click();
  }
}