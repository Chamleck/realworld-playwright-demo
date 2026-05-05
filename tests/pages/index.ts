/**
 * Barrel export for all Page Objects.
 *
 * Allows importing all pages from a single path:
 *   import { LoginPage, HomePage, ArticlePage } from '../pages';
 *
 * Instead of:
 *   import { LoginPage } from '../pages/LoginPage';
 *   import { HomePage } from '../pages/HomePage';
 *   import { ArticlePage } from '../pages/ArticlePage';
 */

export { BasePage } from './BasePage';
export { LoginPage } from './LoginPage';
export { SignUpPage } from './SignUpPage';
export { HomePage } from './HomePage';
export { CreateArticlePage } from './CreateArticlePage';
export { ArticlePage } from './ArticlePage';
export { ProfilePage } from './ProfilePage';