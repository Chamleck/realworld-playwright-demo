/**
 * Playwright Global Teardown
 *
 * Runs ONCE after all tests and all workers have finished.
 * Deletes the test user created by globalSetup and closes DB connection.
 */

import { deleteUser, disconnectDB } from './tests/helpers/db';
import { env } from './tests/helpers/env';

async function globalTeardown() {
  /* Delete the test user created by globalSetup */
  await deleteUser(env.TEST_USER_EMAIL);
  console.log(`\n🧹 Global Teardown: test user ${env.TEST_USER_EMAIL} deleted`);

  /* Close Prisma connection pool to prevent Node.js from hanging */
  await disconnectDB();
  console.log('🧹 Global Teardown: database connection closed\n');
}

export default globalTeardown;