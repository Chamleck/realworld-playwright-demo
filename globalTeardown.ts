/**
 * Playwright Global Teardown
 *
 * Runs ONCE after all tests and all workers have finished.
 * Cleans up shared resources.
 */

import { disconnectDB } from './tests/helpers/db';

async function globalTeardown() {
  /* Close Prisma connection pool to prevent Node.js from hanging */
  await disconnectDB();
  console.log('\n🧹 Global Teardown: database connection closed\n');
}

export default globalTeardown;