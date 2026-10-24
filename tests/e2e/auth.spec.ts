/**
 * Auth E2E Tests — Registration, Login, Validation, Logout
 *
 * Data strategies:
 *   Registration: user does NOT exist → created via UI → cleanup via registeredUser fixture
 *   Login: uses GLOBAL_TEST_USER (created by globalSetup, already in DB)
 *   Validation: invalid data → no user created → no cleanup
 *   Navigation: no data interaction
 *
 * Uses guestTest — the page starts logged out (no storageState), which is what
 * registration/login/navigation tests need. guestTest still provides the Page Object
 * and data fixtures (loginPage, signUpPage, registeredUser, ...) so tests declare the
 * pages they need in their arguments instead of constructing them by hand.
 *
 * Synchronization: no network waits. Every outcome asserted here is rendered only
 * after the server answered — the redirect home + username in the navbar after a
 * successful register/login, the error list after a rejected one — so web-first
 * assertions on the UI are both sufficient and decoupled from internal tRPC names.
 *
 * Tags: @auth, @smoke
 */

import { guestTest as test, expect } from '../fixtures/test-fixtures';
import { GLOBAL_TEST_USER } from '../../globalSetup';
import usersData from '../fixtures/data/users.json';
import { PAGES } from '../helpers/routes';

/* ================================================================== */
/*  Registration tests                                                 */
/* ================================================================== */

test.describe('Registration @auth', () => {
  /*
   * The registeredUser fixture supplies unique, parallel-safe credentials and
   * deletes the user afterwards in its own `finally` — no manual createdEmails
   * array or afterEach hook needed. The test only performs the UI registration
   * (the behaviour under test) using those credentials.
   */

  test('should register a new user with valid data', async ({ signUpPage, homePage, registeredUser }) => {

    await signUpPage.goto();

    await signUpPage.register(registeredUser.username, registeredUser.email, registeredUser.password);

    await homePage.waitForURL(PAGES.home);
    await expect(homePage.getNavProfile(registeredUser.username)).toBeVisible();
  });

  test('should register and then logout successfully', async ({ signUpPage, homePage, settingsPage, registeredUser }) => {

    await signUpPage.goto();

    await signUpPage.register(registeredUser.username, registeredUser.email, registeredUser.password);

    await homePage.waitForURL(PAGES.home);
    await expect(homePage.getNavProfile(registeredUser.username)).toBeVisible();

    await settingsPage.goto();
    await settingsPage.logout();

    await expect(homePage.navSignIn).toBeVisible();
  });
});

/* ================================================================== */
/*  Registration validation tests (parametrized)                       */
/* ================================================================== */

test.describe('Registration validation @auth', () => {

  for (const invalidUser of usersData.invalidUsers) {

    test(`should reject: ${invalidUser.description}`, async ({ signUpPage }) => {

      await signUpPage.goto();

      await signUpPage.register(invalidUser.username, invalidUser.email, invalidUser.password);

      await expect(signUpPage.errorMessages.first()).toBeVisible();
    });
  }
});

/* ================================================================== */
/*  Login tests                                                        */
/* ================================================================== */

test.describe('Login @auth', () => {
  /*
   * Login tests use GLOBAL_TEST_USER — the user created by globalSetup.
   * No need for testUser fixture or manual cleanup.
   * The user exists in DB for the entire test run.
   */

  test('should login with valid credentials @smoke', async ({ loginPage, homePage }) => {

    await loginPage.goto();

    await loginPage.login(GLOBAL_TEST_USER.email, GLOBAL_TEST_USER.password);

    await homePage.waitForURL(PAGES.home);
    await expect(homePage.getNavProfile(GLOBAL_TEST_USER.username)).toBeVisible();
  });

  test('should login and logout successfully', async ({ loginPage, homePage, settingsPage }) => {

    await loginPage.goto();

    await loginPage.login(GLOBAL_TEST_USER.email, GLOBAL_TEST_USER.password);

    await homePage.waitForURL(PAGES.home);
    await expect(homePage.getNavProfile(GLOBAL_TEST_USER.username)).toBeVisible();

    await settingsPage.goto();
    await settingsPage.logout();

    await expect(homePage.navSignIn).toBeVisible();
  });

  test('should reject login with invalid credentials', async ({ loginPage }) => {

    const invalidUser = usersData.emailAndPasswordInvalid;

    await loginPage.goto();

    await loginPage.login(invalidUser.email, invalidUser.password);

    await expect(loginPage.errorMessages.filter({ hasText: 'Invalid email' })).toBeVisible();
    await expect(loginPage.errorMessages.filter({ hasText: 'at least 8 character' })).toBeVisible();
  });
});

/* ================================================================== */
/*  Navigation between auth pages                                      */
/* ================================================================== */

test.describe('Auth navigation @auth', () => {
  test('should navigate from register to login', async ({ signUpPage }) => {

    await signUpPage.goto();

    await expect(signUpPage.loginLink).toBeVisible();
    await signUpPage.loginLink.click();
    await signUpPage.waitForURL(PAGES.login);
  });

  test('should navigate from login to register', async ({ loginPage }) => {

    await loginPage.goto();

    await expect(loginPage.registerLink).toBeVisible();
    await loginPage.registerLink.click();
    await loginPage.waitForURL(PAGES.register);
  });
});
