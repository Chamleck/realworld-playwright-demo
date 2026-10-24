/**
 * tRPC route constants — single source of truth for API endpoint paths.
 *
 * Why this file exists:
 * Endpoint path strings (`/api/trpc/auth.login`, `/api/trpc/articles.createArticle`, ...)
 * were previously hand-authored as raw string literals scattered across every spec
 * file and helper. That has two concrete problems:
 *   1. A typo in any one of ~30 copies fails silently — waitForResponse simply never
 *      matches, and the test hangs until timeout with no hint that the URL was wrong.
 *   2. When a tRPC procedure is renamed on the backend, every literal must be found
 *      and updated by hand — miss one and that spec breaks for a reason unrelated to
 *      any real defect.
 *
 * Centralizing the paths here means one place to change when a procedure moves,
 * autocomplete instead of free-typed strings, and the compiler catches a wrong key.
 *
 * Note on brittleness (deliberate tradeoff):
 * Coupling tests to internal tRPC route names is inherently fragile — the user never
 * sees `/api/trpc/auth.login`. Where practical, prefer asserting on the user-visible
 * outcome (error text, redirect) via web-first assertions. These constants exist for
 * the cases where synchronizing on a specific network call is genuinely the clearest
 * option (e.g. waiting for a mutation to persist before reloading to verify DB state),
 * and to keep the unavoidable coupling in exactly one file rather than thirty.
 *
 * Usage:
 *   import { ROUTES } from '../helpers/routes';
 *   await expectResponse(page, ROUTES.auth.login, 200, () => loginPage.login(...));
 */

/* Base path prefix for all tRPC procedures — kept separate so a framework-level
 * change (e.g. tRPC mount point moving from /api/trpc to /trpc) is a one-line edit. */
const TRPC_BASE = '/api/trpc';

/**
 * ROUTES — grouped by tRPC router (auth, articles, comments, favorites),
 * mirroring the backend router structure in src/server/api/routers/.
 *
 * `as const` freezes the object so values are literal string types, not `string` —
 * this gives autocomplete on `ROUTES.auth.` and prevents accidental reassignment.
 */
export const ROUTES = {
  auth: {
    login: `${TRPC_BASE}/auth.login`,
    register: `${TRPC_BASE}/auth.register`,
    updateUser: `${TRPC_BASE}/auth.updateUser`,
  },
  articles: {
    createArticle: `${TRPC_BASE}/articles.createArticle`,
    updateArticle: `${TRPC_BASE}/articles.updateArticle`,
    deleteArticle: `${TRPC_BASE}/articles.deleteArticle`,
    getArticles: `${TRPC_BASE}/articles.getArticles`,
  },
  comments: {
    addCommentToArticle: `${TRPC_BASE}/comments.addCommentToArticle`,
    removeCommentFromArticle: `${TRPC_BASE}/comments.removeCommentFromArticle`,
  },
  favorites: {
    addArticleAsFavorite: `${TRPC_BASE}/favorites.addArticleAsFavorite`,
    removeArticleFromFavorite: `${TRPC_BASE}/favorites.removeArticleFromFavorite`,
  },
} as const;
