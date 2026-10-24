/**
 * Database helpers for E2E tests.
 *
 * Direct Prisma access to the TEST database for seeding and cleanup.
 * These functions run outside the browser — they're called from
 * globalSetup, globalTeardown, and custom Playwright fixtures.
 *
 * In the Cypress project this was done via cy.task() in cypress.config.ts.
 * Here it's plain async functions — simpler, type-safe, and testable.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from './env';

/**
 * Prisma client connected to the TEST database.
 *
 * Uses TEST_DATABASE_URL (file:./test.sqlite) instead of DATABASE_URL
 * so we never touch the dev database. The test database is reset
 * from base.sqlite in globalSetup before each test run.
 */
const prisma = new PrismaClient({
  datasources: {
    db: { url: env.TEST_DATABASE_URL },
  },
});

/* ------------------------------------------------------------------ */
/*  User helpers                                                       */
/* ------------------------------------------------------------------ */

export interface SeedUserInput {
  email: string;
  username: string;
  password: string;
  image?: string;
  bio?: string;
}

export interface SeedUserResult {
  id: string;
  email: string;
  username: string;
  image: string | null;
  bio: string | null;
}

/**
 * Create a user directly in the database.
 *
 * Hashes the password with bcrypt (same algorithm the app uses)
 * and inserts the user via Prisma. Returns the created user
 * without the password hash.
 *
 * Use case: create a test user before a spec that needs
 * a specific user state (e.g. user with custom bio, user
 * with a profile image, second user for follow/unfollow tests).
 */
export async function seedUser(input: SeedUserInput): Promise<SeedUserResult> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      image: input.image ?? null,
      bio: input.bio ?? null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      image: true,
      bio: true,
    },
  });

  return user;
}

/**
 * Delete a user and all their related data (articles, comments).
 *
 * Deletes in the correct order to respect foreign key constraints:
 * comments → articles → user.
 *
 * Use case: fixture teardown / globalTeardown, when only the email is known up front
 * (e.g. a user registered through the UI). If the test may CHANGE the email, delete by
 * id instead — see deleteUserById.
 */
export async function deleteUser(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) return;

  await deleteUserById(user.id);
}

/**
 * Delete a user by primary key, with the same cascade as deleteUser.
 *
 * Why a separate id-based variant:
 * email (and username) are editable through the Settings page, the id is not. The
 * profile-update test changes the seeded user's email; a teardown that looks the user
 * up by the ORIGINAL email then finds nothing, returns early and silently leaves the
 * updated user in the database. Fixtures that seed a user and hand it to a test that
 * may edit it must clean up by the immutable id.
 *
 * Idempotent without a lookup: every step is a deleteMany, which affects 0 rows for a
 * missing user instead of throwing (P2025) — teardown never fails on already-deleted data.
 */
export async function deleteUserById(id: string): Promise<void> {
  /* comments -> articles (also removes article-tag relations) -> user, FK order */
  await prisma.comment.deleteMany({ where: { authorId: id } });
  await prisma.article.deleteMany({ where: { authorId: id } });
  await prisma.user.deleteMany({ where: { id } });
}

/* ------------------------------------------------------------------ */
/*  Article helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Delete an article by its slug.
 *
 * Removes associated comments first (FK constraint),
 * then the article itself.
 *
 * Use case: cleanup after tests that create articles via UI/API.
 */
export async function deleteArticle(slug: string): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { slug },
  });

  if (!article) return;

  await prisma.comment.deleteMany({
    where: { articleId: slug },
  });

  await prisma.article.delete({
    where: { slug },
  });
}

/* ------------------------------------------------------------------ */
/*  Connection management                                              */
/* ------------------------------------------------------------------ */

/**
 * Disconnect Prisma client.
 *
 * Call this in globalTeardown to cleanly close the DB connection.
 * If not called, Node.js process may hang after tests complete.
 */
export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
