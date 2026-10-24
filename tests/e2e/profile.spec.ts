/**
 * Profile E2E Tests — Settings, Profile Update, Validation
 *
 * Uses dynamicAuthedTest — page fixture automatically starts logged in as
 * a unique testUser via native context override in test-fixtures.ts.
 * testUser is created in DB before each test and deleted after — ensures
 * profile tests don't affect GLOBAL_TEST_USER shared across other tests.
 * Page Objects are provided as fixtures (loginPage, homePage, settingsPage).
 *
 * Synchronization: expectResponse is used ONLY right before page.reload(). A
 * successful settings update shows nothing on screen, and reloading while the
 * mutation is in flight would cancel it — so the test must wait for the server's
 * answer before reloading to check persistence. Everywhere else a user-visible
 * outcome (error list, redirect, navbar username) is asserted instead.
 *
 * Uses profileUpdate fixture — unique profile data generated per test
 * to avoid email/username collisions when tests run in parallel.
 *
 * Tags: @profile
 */

import { dynamicAuthedTest as test, expect } from '../fixtures/test-fixtures';
import usersData from '../fixtures/data/users.json';
import { expectResponse } from '../helpers/expectResponse';
import { ROUTES, PAGES } from '../helpers/routes';

/* ================================================================== */
/*  Profile Settings @profile                                         */
/* ================================================================== */

test.describe('Profile settings @profile', () => {

  test('should display validation errors when updating profile with invalid data', async ({ page, settingsPage, testUser }) => {

    const invalidUser = usersData.emailAndPasswordInvalid;

    await settingsPage.goto();

    /* The error list renders only from the server's 400 answer — once it is
     * visible the request has completed, so the reload below is safe. */
    await settingsPage.updateSettings({
      email: invalidUser.email,
      password: invalidUser.password,
    });

    /* Both validation errors should be visible */
    await expect(settingsPage.errorMessages.filter({ hasText: 'Invalid email' })).toBeVisible();
    await expect(settingsPage.errorMessages.filter({ hasText: 'at least 8 character' })).toBeVisible();

    /* Should stay on settings page — no redirect on validation error */
    await expect(page).toHaveURL(PAGES.settings);

    /* Reload and verify original data was NOT changed in DB */
    await page.reload();
    await expect(settingsPage.emailInput).toHaveValue(testUser.email);
    await expect(settingsPage.usernameInput).toHaveValue(testUser.username);
  });

  test('should successfully update profile with valid data', async ({ page, homePage, settingsPage, profileUpdate }) => {

    await settingsPage.goto();

    await expectResponse(page, ROUTES.auth.updateUser, 200, () =>
      settingsPage.updateSettings({
        username: profileUpdate.username,
        bio: profileUpdate.bio,
        email: profileUpdate.email,
        password: profileUpdate.password,
      })
    );

    /* Reload to verify data was persisted */
    await page.reload();

    /* Settings form should reflect updated values */
    await expect(settingsPage.usernameInput).toHaveValue(profileUpdate.username);
    await expect(settingsPage.bioInput).toHaveValue(profileUpdate.bio);
    await expect(settingsPage.emailInput).toHaveValue(profileUpdate.email);

    /* Username in navbar should be updated */
    await expect(settingsPage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Logout and verify */
    await settingsPage.logout();
    await expect(homePage.navSignIn).toBeVisible();
  });

  test('should login with updated credentials and restore original profile data', async ({ page, loginPage, homePage, settingsPage, profileUpdate, testUser }) => {

    /* Step 1: Update profile to new data */
    await settingsPage.goto();

    await expectResponse(page, ROUTES.auth.updateUser, 200, () =>
      settingsPage.updateSettings({
        username: profileUpdate.username,
        bio: profileUpdate.bio,
        email: profileUpdate.email,
        password: profileUpdate.password,
      })
    );

    /* Reload and verify updated data was persisted */
    await page.reload();
    await expect(settingsPage.usernameInput).toHaveValue(profileUpdate.username);
    await expect(settingsPage.bioInput).toHaveValue(profileUpdate.bio);
    await expect(settingsPage.emailInput).toHaveValue(profileUpdate.email);

    /* Verify navbar updated immediately */
    await expect(settingsPage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Step 2: Logout */
    await settingsPage.goto();
    await settingsPage.logout();
    await expect(homePage.navSignIn).toBeVisible();

    /* Step 3: Login with updated credentials via UI */
    await loginPage.goto();

    await loginPage.login(profileUpdate.email, profileUpdate.password);

    await homePage.waitForURL(PAGES.home);
    await expect(settingsPage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Step 4: Navigate to settings and revert profile to original data */
    await settingsPage.goto();

    await expectResponse(page, ROUTES.auth.updateUser, 200, () =>
      settingsPage.updateSettings({
        username: testUser.username,
        bio: '',
        email: testUser.email,
        password: testUser.password,
      })
    );

    /* Reload and verify reverted data */
    await page.reload();

    await expect(settingsPage.usernameInput).toHaveValue(testUser.username);
    await expect(settingsPage.bioInput).toHaveValue('');
    await expect(settingsPage.emailInput).toHaveValue(testUser.email);
    await expect(settingsPage.getNavProfile(testUser.username)).toBeVisible();

    /* Final logout */
    await settingsPage.logout();
    await expect(homePage.navSignIn).toBeVisible();
  });
});
