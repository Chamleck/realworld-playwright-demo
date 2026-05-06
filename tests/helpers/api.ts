/**
 * API helpers for E2E tests.
 *
 * Direct HTTP calls to tRPC endpoints for login/register — bypasses the UI.
 * Used by globalSetup (to create storageState) and by test fixtures
 * (to register users programmatically when DB seeding isn't enough).
 *
 * In the Cypress project this was cy.loginTRPCUser() and cy.registerTRPCUser()
 * in commands.ts. Here it's plain fetch() — no framework dependency.
 */

import { env } from './env';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuthResult {
  email: string;
  username: string;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

/* ------------------------------------------------------------------ */
/*  Login                                                              */
/* ------------------------------------------------------------------ */

/**
 * Log in via the tRPC auth.login endpoint.
 *
 * Sends the same request the UI would send when submitting the login form,
 * but skips the browser entirely — just an HTTP POST.
 *
 * Returns the JWT token which can be injected into sessionStorage
 * to make the browser "already logged in".
 *
 * The tRPC batch format wraps the payload in { 0: { json: { ... } } }
 * and the response comes back as an array: [{ result: { data: { json: ... } } }].
 * This is how tRPC batches multiple calls into one HTTP request.
 */
export async function loginViaAPI(input: LoginInput): Promise<AuthResult> {
  const response = await fetch(`${env.BASE_URL}/api/trpc/auth.login?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      0: { json: { user: { email: input.email, password: input.password } } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Login API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const user = body?.[0]?.result?.data?.json?.user;

  if (!user?.token) {
    throw new Error(
      `Login API did not return a token. Response: ${JSON.stringify(body, null, 2)}`
    );
  }

  return {
    email: user.email,
    username: user.username,
    token: user.token,
  };
}

/* ------------------------------------------------------------------ */
/*  Register                                                           */
/* ------------------------------------------------------------------ */

/**
 * Register a new user via the tRPC auth.register endpoint.
 *
 * Use case: tests that need a freshly registered user (not pre-seeded).
 * For example, testing that a newly registered user can create an article.
 *
 * Note: this creates the user through the API (same as the UI form),
 * NOT through direct DB insertion. Use seedUser() from db.ts when you
 * need to bypass the API layer entirely.
 */
export async function registerViaAPI(input: RegisterInput): Promise<AuthResult> {
  const response = await fetch(`${env.BASE_URL}/api/trpc/auth.register?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      0: {
        json: {
          user: {
            username: input.username,
            email: input.email,
            password: input.password,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Register API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const user = body?.[0]?.result?.data?.json?.user;

  if (!user?.token) {
    throw new Error(
      `Register API did not return a token. Response: ${JSON.stringify(body, null, 2)}`
    );
  }

  return {
    email: user.email,
    username: user.username,
    token: user.token,
  };
}

/* ------------------------------------------------------------------ */
/*  Article helpers                                                    */
/* ------------------------------------------------------------------ */

export interface ArticleInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

export interface ArticleResult {
  slug: string;
  title: string;
  description: string;
  body: string;
}

/**
 * Create an article via the tRPC articles.createArticle endpoint.
 *
 * Used by the seededArticle fixture to create precondition data
 * without going through the UI. Faster and avoids slug conflicts
 * that occur when multiple parallel tests create articles via UI
 * with the same title at the same time.
 *
 * @param token  - JWT token from loginViaAPI or globalSetup
 * @param input  - article data (title, description, body, tagList)
 */
export async function createArticleViaAPI(
  token: string,
  input: ArticleInput
): Promise<ArticleResult> {
  const response = await fetch(`${env.BASE_URL}/api/trpc/articles.createArticle?batch=1`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Token ${token}`,
    },
    body: JSON.stringify({
      0: {
        json: {
          article: {
            title: input.title,
            description: input.description,
            body: input.body,
            tagList: input.tagList,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`createArticle API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const article = body?.[0]?.result?.data?.json?.article;

  if (!article?.slug) {
    throw new Error(
      `createArticle API did not return an article. Response: ${JSON.stringify(body, null, 2)}`
    );
  }

  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
  };
}