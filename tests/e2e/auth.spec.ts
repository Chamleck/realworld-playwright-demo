/**
 * Auth E2E Tests — Registration, Login, Validation, Logout
 *
 * Data strategies:
 *   Registration: user does NOT exist → created via UI → cleanup via afterEach
 *   Login: uses GLOBAL_TEST_USER (created by globalSetup, already in DB)
 *   Validation: invalid data → no user created → no cleanup
 *   Navigation: no data interaction
 *
 * Tags: @auth, @smoke
 */

import { test, expect } from '../fixtures/test-fixtures';
import { LoginPage, SignUpPage, HomePage, ProfilePage } from '../pages';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import usersData from '../fixtures/data/users.json';
import { deleteUser } from '../helpers/db';

/* ================================================================== */
/*  Registration tests                                                 */
/* ================================================================== */

test.describe('Registration @auth', () => {
  /**
   * Track emails of users created during tests.
   * afterEach will delete them — even if the test fails.
   */
  const createdEmails: string[] = [];

  test.afterEach(async () => {
    for (const email of createdEmails) {
      await deleteUser(email);
    }
    createdEmails.length = 0;
  });

  test('should register a new user with valid data', async ({ page }) => {
    const user = usersData.validUsers[0]!;
    createdEmails.push(user.email);

    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.register') && resp.status() === 200
    );

    await signUpPage.register(user.username, user.email, user.password);
    await responsePromise;

    const homePage = new HomePage(page);
    await homePage.waitForURL('/');
    await expect(homePage.getNavProfile(user.username)).toBeVisible();
  });

  test('should register and then logout successfully', async ({ page }) => {
    const user = usersData.validUsers[1]!;
    createdEmails.push(user.email);

    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.register') && resp.status() === 200
    );

    await signUpPage.register(user.username, user.email, user.password);
    await responsePromise;

    const homePage = new HomePage(page);
    await homePage.waitForURL('/');
    await expect(homePage.getNavProfile(user.username)).toBeVisible();

    const profilePage = new ProfilePage(page);
    await profilePage.gotoSettings();
    await profilePage.logout();

    await expect(homePage.navSignIn).toBeVisible();
  });
});

/* ================================================================== */
/*  Registration validation tests (parametrized)                       */
/* ================================================================== */

test.describe('Registration validation @auth', () => {
  for (const invalidUser of usersData.invalidUsers) {
    test(`should reject: ${invalidUser.description}`, async ({ page }) => {
      const signUpPage = new SignUpPage(page);
      await signUpPage.goto();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/trpc/auth.register') && resp.status() === 400
      );

      await signUpPage.register(
        invalidUser.username,
        invalidUser.email,
        invalidUser.password
      );

      await responsePromise;

      await expect(signUpPage.errorMessages.first()).toBeVisible();
    });
  }
});

/* ================================================================== */
/*  Login tests                                                        */
/* ================================================================== */

test.describe('Login @auth', () => {
  /**
   * Login tests use GLOBAL_TEST_USER — the user created by globalSetup.
   * No need for testUser fixture or manual cleanup.
   * The user exists in DB for the entire test run.
   */

  test('should login with valid credentials @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 200
    );

    await loginPage.login(GLOBAL_TEST_USER.email, GLOBAL_TEST_USER.password);
    await responsePromise;

    const homePage = new HomePage(page);
    await homePage.waitForURL('/');
    await expect(homePage.getNavProfile(GLOBAL_TEST_USER.username)).toBeVisible();
  });

  test('should login and logout successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 200
    );

    await loginPage.login(GLOBAL_TEST_USER.email, GLOBAL_TEST_USER.password);
    await responsePromise;

    const homePage = new HomePage(page);
    await homePage.waitForURL('/');
    await expect(homePage.getNavProfile(GLOBAL_TEST_USER.username)).toBeVisible();

    const profilePage = new ProfilePage(page);
    await profilePage.gotoSettings();
    await profilePage.logout();

    await expect(homePage.navSignIn).toBeVisible();
  });

  test('should reject login with invalid credentials', async ({ page }) => {
    const invalidUser = usersData.invalidUsers[2]!;

    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 400
    );

    await loginPage.login(invalidUser.email, invalidUser.password);
    await responsePromise;

    await expect(loginPage.errorMessages.first()).toBeVisible();
  });
});

/* ================================================================== */
/*  Navigation between auth pages                                      */
/* ================================================================== */

test.describe('Auth navigation @auth', () => {
  test('should navigate from register to login', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    await expect(signUpPage.loginLink).toBeVisible();
    await signUpPage.loginLink.click();
    await signUpPage.waitForURL('/login');
  });

  test('should navigate from login to register', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.registerLink).toBeVisible();
    await loginPage.registerLink.click();
    await loginPage.waitForURL('/register');
  });
});