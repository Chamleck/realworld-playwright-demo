/**
 * Profile E2E Tests — Settings, Profile Update, Validation
 *
 * Uses dynamicAuthedTest — page fixture automatically starts logged in as
 * a unique testUser via native context override in test-fixtures.ts.
 * testUser is created in DB before each test and deleted after — ensures
 * profile tests don't affect GLOBAL_TEST_USER shared across other tests.
 *
 * Uses profileUpdate fixture — unique profile data generated per test
 * to avoid email/username collisions when tests run in parallel.
 *
 * Tags: @profile
 */

import { dynamicAuthedTest as test, expect } from '../fixtures/test-fixtures';
import { LoginPage, HomePage, ProfilePage } from '../pages';
import usersData from '../fixtures/data/users.json';

/* ================================================================== */
/*  Profile Settings @profile                                         */
/* ================================================================== */

test.describe('Profile settings @profile', () => {

  test('should display validation errors when updating profile with invalid data', async ({ page, testUser }) => {

    const invalidUser = usersData.invalidUsers[2]!; // invalid email + short password
    const profilePage = new ProfilePage(page);

    await profilePage.gotoSettings();

    const updateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.updateUser') && resp.status() === 400
    );

    await profilePage.updateSettings({
      email: invalidUser.email,
      password: invalidUser.password,
    });

    await updateResponse;

    /* Both validation errors should be visible */
    await expect(profilePage.errorMessages.filter({ hasText: 'Invalid email' })).toBeVisible();
    await expect(profilePage.errorMessages.filter({ hasText: 'at least 8 character' })).toBeVisible();

    /* Should stay on settings page — no redirect on validation error */
    await expect(page).toHaveURL('/settings');

    /* Reload and verify original data was NOT changed in DB */
    await page.reload();
    await expect(profilePage.emailInput).toHaveValue(testUser.email);
    await expect(profilePage.usernameInput).toHaveValue(testUser.username);
  });

  test('should successfully update profile with valid data', async ({ page, profileUpdate }) => {

    const profilePage = new ProfilePage(page);
    const homePage = new HomePage(page);

    await profilePage.gotoSettings();

    const updateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.updateUser') && resp.status() === 200
    );

    await profilePage.updateSettings({
      username: profileUpdate.username,
      bio: profileUpdate.bio,
      email: profileUpdate.email,
      password: profileUpdate.password,
    });

    await updateResponse;

    /* Reload to verify data was persisted */
    await page.reload();

    /* Settings form should reflect updated values */
    await expect(profilePage.usernameInput).toHaveValue(profileUpdate.username);
    await expect(profilePage.bioInput).toHaveValue(profileUpdate.bio);
    await expect(profilePage.emailInput).toHaveValue(profileUpdate.email);

    /* Username in navbar should be updated */
    await expect(profilePage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Logout and verify */
    await profilePage.logout();
    await expect(homePage.navSignIn).toBeVisible();
  });

  test('should login with updated credentials and restore original profile data', async ({ page, profileUpdate, testUser }) => {
    
    const profilePage = new ProfilePage(page);
    const homePage = new HomePage(page);
    const loginPage = new LoginPage(page);

    /* Step 1: Update profile to new data */
    await profilePage.gotoSettings();

    const updateResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.updateUser') && resp.status() === 200
    );

    await profilePage.updateSettings({
      username: profileUpdate.username,
      bio: profileUpdate.bio,
      email: profileUpdate.email,
      password: profileUpdate.password,
    });

    await updateResponse;

    /* Reload and verify updated data was persisted */
    await page.reload();
    await expect(profilePage.usernameInput).toHaveValue(profileUpdate.username);
    await expect(profilePage.bioInput).toHaveValue(profileUpdate.bio);
    await expect(profilePage.emailInput).toHaveValue(profileUpdate.email);

    /* Verify navbar updated immediately */
    await expect(profilePage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Step 2: Logout */
    await profilePage.gotoSettings();
    await profilePage.logout();
    await expect(homePage.navSignIn).toBeVisible();

    /* Step 3: Login with updated credentials via UI */
    await loginPage.goto();

    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 200
    );

    await loginPage.login(profileUpdate.email, profileUpdate.password);
    await loginResponse;

    await homePage.waitForURL('/');
    await expect(profilePage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Step 4: Navigate to settings and revert profile to original data */
    await profilePage.gotoSettings();

    const revertResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.updateUser') && resp.status() === 200
    );

    await profilePage.updateSettings({
      username: testUser.username,
      bio: '',
      email: testUser.email,
      password: testUser.password,
    });

    await revertResponse;

    /* Reload and verify reverted data */
    await page.reload();

    await expect(profilePage.usernameInput).toHaveValue(testUser.username);
    await expect(profilePage.bioInput).toHaveValue('');
    await expect(profilePage.emailInput).toHaveValue(testUser.email);
    await expect(profilePage.getNavProfile(testUser.username)).toBeVisible();

    /* Final logout */
    await profilePage.logout();
    await expect(homePage.navSignIn).toBeVisible();
  });
});