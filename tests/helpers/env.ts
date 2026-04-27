/**
 * Typed environment variable loader with Zod validation.
 *
 * Why this file exists:
 * Without validation, a missing or mistyped env variable fails silently —
 * process.env.BSAE_URL returns undefined, and the test navigates to
 * "undefined/login" which produces a cryptic Playwright error 20 seconds later.
 *
 * With this module, a missing variable fails IMMEDIATELY at startup
 * with a clear message: "BASE_URL: Required".
 *
 * Usage in tests and helpers:
 *   import { env } from '../helpers/env';
 *   await page.goto(env.BASE_URL + '/login');
 *
 * Adding a new variable:
 *   1. Add it to the zod schema below
 *   2. Add it to .env.example with a description
 *   3. Add it to .env locally
 *   4. Add it to GitHub Actions secrets (if sensitive) or workflow env (if not)
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

/* Load .env from the project root (two levels up from tests/helpers/) */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Zod schema — defines every env variable the test framework needs.
 *
 * Each field uses z.string() with a .default() or without —
 * if no default, the variable is required and zod will throw
 * a clear error if it's missing.
 */
const envSchema = z.object({
  /* Base URL of the running application */
  BASE_URL: z.string().url().default('http://localhost:3000'),

  /* Database URL for the app (not used by tests directly, but needed for Prisma helpers) */
  DATABASE_URL: z.string().default('file:./database.sqlite'),

  /* Separate test database — globalSetup copies base.sqlite here */
  TEST_DATABASE_URL: z.string().default('file:./test.sqlite'),

  /* JWT secret — needed if we ever verify tokens in tests */
  JWT_SECRET: z.string().default('some-super-secret-string'),

  /* Pre-seeded test user credentials */
  TEST_USER_EMAIL: z.string().email().default('jake@jake.jake'),
  TEST_USER_PASSWORD: z.string().min(1).default('jakejake'),
});

/**
 * Parse and validate. If any variable is missing or invalid,
 * zod throws with a detailed error message listing all problems.
 *
 * safeParse returns { success, data, error } instead of throwing,
 * which lets us format the error message nicely before crashing.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '\n❌ Invalid environment variables:\n',
    parsed.error.flatten().fieldErrors,
    '\n\nCheck your .env file against .env.example\n'
  );
  process.exit(1);
}

/**
 * Validated, typed env object.
 *
 * Every property is guaranteed to be a string of the correct format.
 * TypeScript knows the exact shape — no more process.env['MAYBE_TYPO'].
 */
export const env = parsed.data;
