/**
 * TypeScript types for JSON test data fixtures.
 *
 * Based on actual validation rules from the application source code:
 *   - src/server/api/routers/authentication.ts (user schema)
 *   - src/server/api/routers/articles.ts (article schema)
 *
 * Validation rules reference:
 *   email:    z.string().email()           — must be valid email format
 *   username: z.string().min(1)            — at least 1 character
 *   password: z.string().min(8)            — at least 8 characters
 *   title:    z.string().min(1)            — at least 1 character
 *   description: z.string().min(1)         — at least 1 character
 *   body:     z.string().min(1)            — at least 1 character
 *   tagList:  z.string().array()           — array of strings (can be empty)
 */

/* ------------------------------------------------------------------ */
/*  Users                                                              */
/* ------------------------------------------------------------------ */

export interface UserData {
  email: string;
  username: string;
  password: string;
}

export interface InvalidUserData extends UserData {
  /** What makes this user invalid — used for test naming */
  description: string;
}

export interface UsersFixture {
  /** Pre-seeded user from base.sqlite (matches .env TEST_USER_* credentials) */
  defaultUser: UserData;
  /** Valid user data for registration tests */
  validUsers: UserData[];
  /** Invalid user data for validation tests — each entry violates at least one rule */
  invalidUsers: InvalidUserData[];
}

/* ------------------------------------------------------------------ */
/*  Articles                                                           */
/* ------------------------------------------------------------------ */

export interface ArticleData {
  title: string;
  description: string;
  body: string;
  /** API expects tagList as string[], UI uses a single tag input */
  tagList?: string[];
}

export interface CommentData {
  body: string;
}

export interface ArticlesFixture {
  /** Standard article for create/read tests */
  validArticle: Required<ArticleData>;
  /** Modified fields for update tests (no tagList — tags can't be updated) */
  updatedArticle: Omit<ArticleData, 'tagList'>;
  /** Comment template */
  comment: CommentData;
}