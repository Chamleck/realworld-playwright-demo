/**
 * Profile E2E Tests — Settings, Profile Update, Validation
 *
 * Uses testUser fixture — a unique user created per test and deleted after.
 * This ensures profile tests don't affect GLOBAL_TEST_USER which is shared
 * across all other tests.
 *
 * Uses authedTestUserPage fixture — a Page authenticated as testUser,
 * created by logging in via API and injecting the JWT into localStorage.
 *
 * Uses profileUpdate fixture — unique profile data generated per test
 * to avoid email/username collisions when tests run in parallel.
 *
 * Tags: @profile
 */

import { test, expect } from '../fixtures/test-fixtures';
import { LoginPage, HomePage, ProfilePage } from '../pages';
import usersData from '../fixtures/data/users.json';

/* ================================================================== */
/*  Profile Settings @profile                                         */
/* ================================================================== */

test.describe('Profile settings @profile', () => {

  test('should display validation errors when updating profile with invalid data', async ({ authedTestUserPage, testUser }) => {
    const invalidUser = usersData.invalidUsers[2]!; // invalid email + short password
    const profilePage = new ProfilePage(authedTestUserPage);

    await profilePage.gotoSettings();

    const updateResponse = authedTestUserPage.waitForResponse(
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
    await expect(authedTestUserPage).toHaveURL('/settings');

    /* Reload and verify original data was NOT changed in DB */
    await authedTestUserPage.reload();
    await expect(profilePage.emailInput).toHaveValue(testUser.email);
    await expect(profilePage.usernameInput).toHaveValue(testUser.username);
  });

  test('should successfully update profile with valid data', async ({ authedTestUserPage, profileUpdate }) => {
    const profilePage = new ProfilePage(authedTestUserPage);
    const homePage = new HomePage(authedTestUserPage);

    await profilePage.gotoSettings();

    const updateResponse = authedTestUserPage.waitForResponse(
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
    await authedTestUserPage.reload();

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

  test('should login with updated credentials and restore original profile data', async ({ authedTestUserPage, profileUpdate, testUser }) => {
    const profilePage = new ProfilePage(authedTestUserPage);
    const homePage = new HomePage(authedTestUserPage);
    const loginPage = new LoginPage(authedTestUserPage);

    /* Step 1: Update profile to new data */
    await profilePage.gotoSettings();

    const updateResponse = authedTestUserPage.waitForResponse(
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
    await authedTestUserPage.reload();
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

    const loginResponse = authedTestUserPage.waitForResponse(
      (resp) => resp.url().includes('/api/trpc/auth.login') && resp.status() === 200
    );

    await loginPage.login(profileUpdate.email, profileUpdate.password);
    await loginResponse;

    await homePage.waitForURL('/');
    await expect(profilePage.getNavProfile(profileUpdate.username)).toBeVisible();

    /* Step 4: Navigate to settings and revert profile to original data */
    await profilePage.gotoSettings();

    const revertResponse = authedTestUserPage.waitForResponse(
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
    await authedTestUserPage.reload();

    await expect(profilePage.usernameInput).toHaveValue(testUser.username);
    await expect(profilePage.bioInput).toHaveValue('');
    await expect(profilePage.emailInput).toHaveValue(testUser.email);
    await expect(profilePage.getNavProfile(testUser.username)).toBeVisible();

    /* Final logout */
    await profilePage.logout();
    await expect(homePage.navSignIn).toBeVisible();
  });
});