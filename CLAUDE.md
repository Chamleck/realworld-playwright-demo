# CLAUDE.md

> Context file for [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) and any LLM-assisted work on this repository. Claude Code reads this file automatically when operating in this repo — keep it up to date so suggestions stay consistent with project conventions.

---

## Project purpose

**Portfolio demo project** showcasing an end-to-end test automation architecture built from scratch using **Playwright + TypeScript** against a realistic full-stack web application.

The system under test (SUT) is a [RealWorld](https://github.com/gothinkster/realworld) / Conduit clone — a Medium.com-style blog built on Next.js 14 + tRPC + Prisma + SQLite.

### Demonstration goals

1. Scalable, stable, architecturally sound E2E framework (Page Object Model, custom fixtures, typed env).
2. CI/CD with GitHub Actions — PR pipeline for fast feedback + nightly cross-browser regression.
3. Secrets and env management — `.env` locally, `secrets.*` on GitHub.
4. Advanced reporting — Allure for stakeholders + Playwright Trace Viewer for debugging.
5. Best practices: typed semantic selectors, storage-state auth, DB seeding/cleanup via Prisma helpers, flake-resistant waits.

---

## Tech stack

### Application (do NOT modify during framework work unless explicitly requested)

- **Next.js 14** (pages router)
- **tRPC** + `trpc-openapi` (adds a REST layer over tRPC for OpenAPI exposure)
- **Prisma ORM** + **SQLite** (file-based DB, zero external infrastructure)
- **JWT** auth — token stored in `localStorage` under key `token`
- **TypeScript** strict mode, **Tailwind CSS**

### Test framework

- **Playwright 1.59** + **TypeScript**
- **Allure** reporter (`allure-playwright` + `allure-commandline`) — installed and configured; generates rich HTML reports with step hierarchy, trace attachments, and trend history
- **Playwright Trace Viewer** (built-in) — trace.zip attached directly to Allure report on failure; link to `trace.playwright.dev` included for online viewing
- **GitHub Actions** — PR pipeline (Chromium) + nightly regression (all browsers)
- **dotenv** + **zod** for typed, validated env loading
- **shx** for cross-platform npm scripts

---

## Branch strategy
main                         ← application under test only (no tests)
└── setup/playwright           ← Playwright infrastructure, config, CI, reporting (merged)
└── tests/e2e-suite         ← actual spec files + Page Objects  [YOU ARE HERE]
└── dev                   ← stable integration, polish, final docs

---

## Project structure
realworld-playwright-demo/
├── .github/workflows/
│   ├── e2e.yml                    # PR pipeline — Chromium only, fast feedback
│   └── nightly.yml                # Full regression — all 4 browsers, nightly schedule
├── prisma/
│   ├── base.sqlite                # Seed database (committed, never modified)
│   ├── database.sqlite            # Dev DB (created by npm install, gitignored)
│   ├── test.sqlite                # Test DB (created by globalSetup, gitignored)
│   └── schema.prisma              # Prisma schema
├── src/                           # Application source (do not modify)
├── tests/
│   ├── auth/
│   │   └── .storage-state.json    # Saved auth state (gitignored, created by globalSetup)
│   ├── e2e/                       # Spec files: auth.spec.ts, articles.spec.ts, profile.spec.ts
│   ├── fixtures/
│   │   ├── data/
│   │   │   ├── articles.json      # Test data: articles, comments
│   │   │   ├── users.json         # Test data: valid/invalid users
│   │   │   └── types.ts           # TypeScript interfaces for JSON fixtures
│   │   └── test-fixtures.ts       # Custom fixtures: authedPage, testUser, seededArticle, authedTestUserPage, profileUpdate
│   ├── helpers/
│   │   ├── api.ts                 # tRPC helpers: loginViaAPI, registerViaAPI, createArticleViaAPI
│   │   ├── db.ts                  # Prisma helpers: seedUser, deleteUser, deleteArticle
│   │   └── env.ts                 # Typed env loader with zod validation
│   └── pages/                     # Page Object Models: BasePage + 7 page classes (+ index.ts barrel)
├── globalSetup.ts                 # Runs before all tests: reset DB, save storageState
├── globalTeardown.ts              # Runs after all tests: disconnect Prisma
├── playwright.config.ts           # 4 browser projects, webServer, reporters
├── tsconfig.test.json             # TypeScript config scoped to test files only (excludes src/ to avoid @trpc/server v10 issues)
├── .env.example                   # Env template (committed)
├── .env                           # Local env values (gitignored)
├── CLAUDE.md                      # This file
└── README.md

---

## Repository conventions

### Package manager

**npm** (not pnpm, not yarn). `package-lock.json` is committed.

### Code style

- **ESLint** configured for the app. Tests follow the same ESLint config — run via `npm run lint`.
- **Prettier** is configured in `.prettierrc` but intentionally excluded from running on `tests/` via `.prettierignore`. Reason: `src/` (generated by create-t3-app) uses `semi: false` (StandardJS style), while tests were written with `semi: true`. Rather than reformatting either, tests are excluded from Prettier to avoid style conflicts. This is a deliberate convention — do not run `prettier --write` on test files.
- **Strict TypeScript** — no `any` without an explanatory comment.
- **Selectors**: prefer `getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId` over CSS/XPath.
- **Comments**: verbose block comments explaining **why**, not just **what** — this is a learning/demo project.

### Naming

- Spec files: `<feature>.spec.ts` (e.g. `auth.spec.ts`, `articles.spec.ts`).
- Page classes: `PascalCase` + `Page` suffix (`LoginPage`, `ArticlePage`).
- Custom fixtures: `camelCase` in `test-fixtures.ts`.
- JSON fixtures: `camelCase` filenames.
- Tags in tests: `@tagname` in test title (e.g. `@smoke`, `@auth`, `@articles`, `@profile`).
- Parallel worker prefix: all unique test data includes `_w${testInfo.parallelIndex}` suffix (e.g. `test-article-1778572618767_w1`). In logs, `_w0`, `_w1`, `_w2`... identify which worker created each resource — useful for debugging parallel runs.

### Test architecture

- **Helpers** (`tests/helpers/`) — low-level functions (DB operations, API calls, env). No Playwright dependency.
- **Fixtures** (`tests/fixtures/test-fixtures.ts`) — high-level Playwright fixtures that use helpers. Manage lifecycle (setup before test, teardown after).
- **Page Objects** (`tests/pages/`) — one class per page, receives `page: Page` via constructor. All inherit from `BasePage`. All action methods wrapped in `test.step()` for granular Allure step hierarchy.
- **Specs** (`tests/e2e/`) — test files that import fixtures and Page Objects.
- **Data** (`tests/fixtures/data/`) — JSON test data, typed via `types.ts`.
- **Two article creation strategies**: `createArticleViaUI` helper is used ONLY in the test that verifies the UI creation flow; all other tests where an article is a precondition use the `seededArticle` fixture (API-based, faster, parallel-safe).

### Auth strategy

- `globalSetup` logs in pre-seeded user (`jake@jake.jake`) via tRPC API → writes storageState JSON directly to `tests/auth/.storage-state.json` (no browser needed — token from API is injected directly into the JSON structure).
- `authedPage` fixture loads storageState → page starts logged in as the pre-seeded user. Starts `context.tracing` manually — trace.zip attached to Allure report on failure.
- `testUser` fixture creates a unique user in DB via Prisma → provides to test → deletes after.
- `authedTestUserPage` depends on `testUser`: logs in as that user via API, injects JWT into `localStorage` via a fresh browser context. Used by tests that mutate user-specific state (profile updates) without polluting the pre-seeded user. Also starts `context.tracing` — trace.zip attached on failure.
- `seededArticle` creates an article via tRPC API as the pre-seeded user → provides slug/title/description/body to test → deletes after.
- `profileUpdate` provides unique profile data (username/email/bio/password) per test → parallel-safe via `Date.now() + testInfo.parallelIndex`. Stateless — no cleanup needed.
- All cleanup fixtures wrap `use()` in `try/finally` so teardown runs even when the test throws.
- Tests that don't need auth use plain `page` (no storageState).

### Database strategy

- `base.sqlite` — seed data, committed, never modified.
- `database.sqlite` — dev DB for `npm run dev`, created by `npm install`.
- `test.sqlite` — test DB, reset from `base.sqlite` in `globalSetup` before every run.
- `DATABASE_URL` — used by the **application** (Next.js/Prisma) when it starts via `webServer`. Always points to `database.sqlite`.
- `TEST_DATABASE_URL` — used by the **test framework** (globalSetup, db helpers). Always points to `test.sqlite`. Tests never touch `DATABASE_URL`.
- Both variables must be set in CI — the app and the framework each need to know their own database path.

---

## Environment variables

Defined in `.env.example`, validated by `tests/helpers/env.ts` via zod:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | App database (used by Next.js/Prisma) | `file:./database.sqlite` |
| `JWT_SECRET` | JWT signing key | `some-super-secret-string` |
| `BASE_URL` | App URL for tests | `http://localhost:3000` |
| `TEST_DATABASE_URL` | Test database (used by test framework only) | `file:./test.sqlite` |
| `TEST_USER_EMAIL` | Pre-seeded user email | `jake@jake.jake` |
| `TEST_USER_PASSWORD` | Pre-seeded user password | `jakejake` |
| `TEST_USER_USERNAME` | Pre-seeded user username | `globalTestUser` |

New variables must be added to: `.env.example` + `tests/helpers/env.ts` + GitHub Secrets (if sensitive) + workflow env (if needed in CI).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm test` | Run all Playwright tests (headless) |
| `npm run test:chromium` | Run tests in Chromium only |
| `npm run test:firefox` | Run tests in Firefox only |
| `npm run test:mobile` | Run tests in Mobile Chrome + Mobile Safari |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:ui` | Playwright UI mode (visual debugger) |
| `npm run test:debug` | Step-by-step debugging with DevTools |
| `npm run test:grep -- @smoke` | Run tests matching a tag |
| `npm run test:list` | List all tests without running |
| `npm run test:with-report` | Run tests + generate and open Allure report |
| `npm run test:report` | Open Playwright HTML report |
| `npm run test:trace` | Open Trace Viewer |
| `npm run allure:generate` | Generate Allure report from allure-results/ |
| `npm run allure:open` | Open generated Allure report |
| `npm run allure:report` | Generate + open Allure report |
| `npm run type:check` | TypeScript type check for test files only (via tsconfig.test.json) |
| `npm run lint:tests` | Run ESLint on test files only (tests/, globalSetup.ts, globalTeardown.ts, playwright.config.ts) |

---

## CI/CD

### PR Pipeline (`e2e.yml`)

- Triggers: push/PR to `setup/playwright`, `tests/e2e-suite`, `dev`, `main`
- Browser: Chromium only (fast feedback, target < 5 min)
- Gates: `type:check` → `lint` → Playwright tests (in order)
- Workers: 2 in CI (up from 1 — GitHub runners handle 2 workers stably for this suite size)
- Manual trigger: `grep` input for tag filtering + `environment` input for target env
- Artifacts: Playwright report, Allure report (always), traces/screenshots/videos (on failure)

### Nightly Regression (`nightly.yml`)

- Schedule: 2:00 AM UTC daily
- Matrix: chromium, firefox, mobile-chrome, mobile-safari (4 parallel jobs)
- Gates: `type:check` → `lint` → Playwright tests (same as PR pipeline)
- Manual trigger: `grep` input + `environment` input + `project` input (single browser)
- Per-browser artifacts: Playwright report, Allure report, traces on failure

### Multi-environment strategy

GitHub Environments are a paid feature for private repos — not used here. Instead, secrets are prefixed per environment and stored in the shared repository secrets space. The `environment` input on `workflow_dispatch` controls which prefix is read:

| Environment | Secret prefix | Example |
|---|---|---|
| `dev` | none | `JWT_SECRET` |
| `staging` | `STAGING_` | `STAGING_JWT_SECRET` |
| `production` | `PROD_` | `PROD_JWT_SECRET` |

`BASE_URL` is also environment-specific — each env has its own `*_BASE_URL` secret pointing to the correct deploy target.

**Note on simulation**: Staging and production secrets currently contain the same values as dev (pointing to `localhost:3000`). This is intentional — the architecture is fully wired and ready for real deploy targets. When a staging or production environment exists, only the secret values need updating — no workflow changes required.

Database variables (`DATABASE_URL`, `TEST_DATABASE_URL`) are always static — SQLite is file-based and always local to the runner. A real staging/prod environment would require a different database strategy (e.g. PostgreSQL with connection strings per environment).

### GitHub Secrets

| Secret | Environment | Purpose |
|---|---|---|
| `JWT_SECRET` | dev | JWT token signing |
| `TEST_USER_EMAIL` | dev | Pre-seeded user login |
| `TEST_USER_PASSWORD` | dev | Pre-seeded user login |
| `TEST_USER_USERNAME` | dev | Pre-seeded user username |
| `STAGING_JWT_SECRET` | staging | JWT token signing |
| `STAGING_TEST_USER_EMAIL` | staging | Pre-seeded user login |
| `STAGING_TEST_USER_PASSWORD` | staging | Pre-seeded user login |
| `STAGING_TEST_USER_USERNAME` | staging | Pre-seeded user username |
| `STAGING_BASE_URL` | staging | App URL for staging environment |
| `PROD_JWT_SECRET` | production | JWT token signing |
| `PROD_TEST_USER_EMAIL` | production | Pre-seeded user login |
| `PROD_TEST_USER_PASSWORD` | production | Pre-seeded user login |
| `PROD_TEST_USER_USERNAME` | production | Pre-seeded user username |
| `PROD_BASE_URL` | production | App URL for production environment |

---

## Validation rules (from app source code)

Reference for writing test data (`tests/fixtures/data/`):

| Field | Rule | Source |
|---|---|---|
| `email` | `z.string().email()` | `authentication.ts` |
| `username` | `z.string().min(1)` | `authentication.ts` |
| `password` | `z.string().min(8)` | `authentication.ts` |
| `title` | `z.string().min(1)` | `articles.ts` |
| `description` | `z.string().min(1)` | `articles.ts` |
| `body` | `z.string().min(1)` | `articles.ts` |
| `tagList` | `z.string().array()` | `articles.ts` |

---

## M4 plan — `tests/e2e-suite` → `dev`

Current state: 22 passing tests + 1 expected failure (`should delete article with comment` reveals a pre-existing FK constraint bug in the app — kept as a documented bug-revealing test).

### M4.1 — Code quality pass ✅

Done. Fixtures use `try/finally` for cleanup. PO declarations unified to top-of-test in `articles.spec.ts`. `SeededArticle` interface made explicit. Dead `profileUpdate` field removed from JSON fixtures. `GLOBAL_TEST_USER` import moved to top-level. `HomePage.findArticleAcrossPages()` added to handle the paginated global feed (see "Known quirks" below).

### M4.2 — Allure reporter integration ✅

Done. Installed `allure-playwright` + `allure-commandline`, wired reporter in `playwright.config.ts` (Allure + HTML locally, Allure + list in CI).

`test.step()` decorators added to all Page Object action methods (`LoginPage`, `SignUpPage`, `HomePage`, `ArticlePage`, `CreateArticlePage`, `ProfilePage`) for granular step hierarchy in Allure reports.

Trace attachment for failed tests: `context.tracing.start()` in both `authedPage` and `authedTestUserPage` fixture setup; `context.tracing.stop()` + `testInfo.attach('trace', ...)` in `finally` block on failure. Link to `trace.playwright.dev` also attached so trace.zip can be opened online without installing Playwright locally.

Screenshots on failure handled by Playwright's built-in screenshot config.

### M4.3 — CI hardening ✅

Done. Both `e2e.yml` and `nightly.yml` updated with:

- `type:check` gate (`tsc --noEmit -p tsconfig.test.json`) — checks only test files, excludes `src/` to avoid `@trpc/server` v10 type incompatibilities
- `lint:tests` gate (`npm run lint:tests`) — ESLint scoped to test files only; `src/` has pre-existing deprecation warnings from tRPC `isLoading` → `isPending` migration that are outside the test framework's responsibility
- `workers: 2` in CI — up from 1; GitHub runners handle 2 workers stably for this suite size. Sharding (splitting tests across multiple runners via matrix) was considered but deprioritized — for 22 tests the runner startup overhead (~2-3 min per shard) exceeds the parallelization benefit. Sharding becomes worthwhile at ~100+ tests — see M5.
- Multi-environment support via prefixed secrets — see "Multi-environment strategy" above
- `environment` input added to both workflows alongside existing `grep` input
- `tests/` added to `.prettierignore` — prevents Prettier conflicts between `src/` (`semi: false`) and tests (`semi: true`)
- Refactored `globalSetup.ts` — removed Chromium dependency from setup; storageState now written directly as JSON via `fs.writeFileSync`, making setup browser-agnostic (fixes Firefox/WebKit nightly jobs crashing at `chromium.launch()`)
- Firefox and WebKit nightly jobs run with `--workers=1` to avoid `NS_BINDING_ABORTED` flakiness in CI — Chromium jobs keep `--workers=2`

**Docker considered and deprioritized**: GitHub Actions `ubuntu-latest` runners provide a clean, reproducible environment for each run. Adding a Docker layer would increase complexity and image pull time without meaningful isolation benefit at this project's scale. Noted here so the decision is explicit, not accidental.

### M4.4 + M4.5 — Allure history + GitHub Pages publish

Combined into one PR. Auto-publish Allure HTML report to `gh-pages` branch after
every CI run — live at `Chamleck.github.io/realworld-playwright-demo`. Preserve
allure-history between runs for trend graphs (pass/fail over time, flakiness detection).
Add categories for known issues (e.g. "Foreign key bug" for the FK constraint test).

### M4.6 — Documentation polish

README with CI status badges, Playwright version badge, link to live Allure report,
architecture diagram, quick start guide, "how to evaluate" section for recruiters.

## M5 — Optional Enhancements (not planned for now)

- **Parallel sharding** — split tests across multiple GitHub Actions runners via matrix `--shard=N/M`. Worthwhile at ~100+ tests; for the current 22-test suite the runner startup overhead exceeds the benefit.
- Project Dependencies as alternative to globalSetup — mention in README as an architectural alternative
- Flake stabilization analysis — after 10+ CI runs
- API tests layer alongside E2E
- Mobile viewport tests

---

## Known quirks / lessons learned

### `.article-preview` is overloaded by `ArticleListTabs.tsx`

The CSS class `.article-preview` is reused inside the feed component for three different states:

- The **loading-state spinner**: `<div className="article-preview"><Spinner /></div>`
- The **empty-state message**: `<div className="article-preview">No articles are here... yet.</div>`
- The **actual article cards**, rendered via `ArticleListEntry` — these are the only ones that contain an `<h1>` with the article title.

When asserting on cards or waiting for the feed to be ready, scope to `.article-preview` that has an `<h1>` inside — otherwise the spinner placeholder matches first and any subsequent `count()` / lookup runs before real articles render.

The robust pattern used by `HomePage.findArticleAcrossPages()`:

```ts
const realArticleCard = this.articlePreviews
  .filter({ has: this.page.locator('h1') })
  .first();
await realArticleCard.waitFor({ state: 'attached' });
```

### Global feed pagination with parallel workers

`seededArticle` creates one article per test that requests it. With `fullyParallel: true`
and N CPU cores, up to N+1 freshly created articles coexist during a run (N fixtures +
1–2 UI-created articles). The global feed shows 5 per page sorted by `createdAt DESC` —
so the under-test article can land on page 2+.

`should show created article in global feed` uses `HomePage.findArticleAcrossPages(title)`.

**Why not a simple forward walk (page 1 → 2 → 3 → ... → N):**
While we navigate forward, other workers finish their tests and delete their seededArticles.
Each deletion shifts our article one position backward (toward page 1). We perpetually chase
it in the wrong direction and can traverse 50+ pages without ever finding it — confirmed
in a trace where the method reached pages 50–51 without a match.

**Solution — repeated passes over pages 1–4:**
With up to ~16 parallel articles ahead at peak, our article lands at most on page 4.
The method checks pages 1, 2, 3, 4 — then repeats the full pass up to 5 times.
Even if the article shifted back to page 1 while we were on page 3, the next pass
catches it. Worst-case time: 5 passes × 4 pages × ~300 ms = ~6 s.

Navigation is URL-based (`/?offset=N`) rather than clicking pagination links — avoids
stale-locator issues when the DOM updates between page transitions.

### Firefox/WebKit NS_BINDING_ABORTED in CI

Firefox and WebKit occasionally abort navigation (`NS_BINDING_ABORTED` / "interrupted by another navigation") when a new `goto()` is called while the browser is still processing a redirect from a previous action (logout, article deletion). This is a WebKit/Gecko timing issue — Chromium handles it gracefully, these engines don't.

**Fix**: add `waitForLoadState('networkidle')` inside the Page Object method that triggers the redirect (`logout()`, `clickDelete()`). This ensures the redirect completes before the next navigation starts. Applied in `ProfilePage.logout()` and `ArticlePage.clickDelete()`.

Nightly jobs for Firefox and mobile-safari also run with `--workers=1` to reduce parallel load on CI runners.

---

## Notes for Claude Code

- **Follow the Page Object pattern** in `tests/pages/`. Don't put selectors in spec files.
- **Prefer semantic locators**: `page.getByRole('button', { name: /sign up/i })` over CSS selectors.
- **New env variables** → add to `.env.example` + `env.ts` zod schema + GitHub Secrets + workflow env.
- **New npm scripts** → update workflow, CLAUDE.md commands table, and README commands table in the same commit.
- **Don't touch `src/`** unless adding `data-testid` attributes.
- **Import test and expect** from `tests/fixtures/test-fixtures.ts`, not from `@playwright/test` directly.
- **Verbose comments** are welcome — this is a learning/demo project.
- **Tags**: use `@tagname` in test titles for filtering. Common tags: `@smoke`, `@auth`, `@articles`, `@profile`.
- **Do not run Prettier on test files** — `tests/` is in `.prettierignore`. Tests use `semi: true`, `src/` uses `semi: false`. Running `prettier --write` on tests would break the convention.