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
- **JWT** auth — token stored in `sessionStorage` under key `token`
- **TypeScript** strict mode, **Tailwind CSS**

### Test framework

- **Playwright 1.59** + **TypeScript**
- **Allure** reporter (`allure-playwright` + `allure-commandline`)
- **Playwright Trace Viewer** (built-in, trace on first retry)
- **GitHub Actions** — PR pipeline (Chromium) + nightly regression (all browsers)
- **dotenv** + **zod** for typed, validated env loading
- **shx** for cross-platform npm scripts

---

## Branch strategy

```
main                         ← application under test only (no tests)
 └── setup/playwright           ← Playwright infrastructure, config, CI, reporting  [YOU ARE HERE]
      └── tests/e2e-suite         ← actual spec files + Page Objects
           └── dev                   ← stable integration, polish, final docs
```

---

## Project structure

```
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
│   ├── e2e/                       # Spec files — one per feature area
│   ├── fixtures/
│   │   ├── data/
│   │   │   ├── articles.json      # Test data: articles, comments
│   │   │   ├── users.json         # Test data: valid/invalid users, profile updates
│   │   │   └── types.ts           # TypeScript interfaces for JSON fixtures
│   │   └── test-fixtures.ts       # Custom fixtures: authedPage, testUser
│   ├── helpers/
│   │   ├── api.ts                 # tRPC helpers: loginViaAPI, registerViaAPI
│   │   ├── db.ts                  # Prisma helpers: seedUser, deleteUser, deleteArticle
│   │   └── env.ts                 # Typed env loader with zod validation
│   └── pages/                     # Page Object Models (to be added in tests/e2e-suite)
├── globalSetup.ts                 # Runs before all tests: reset DB, save storageState
├── globalTeardown.ts              # Runs after all tests: disconnect Prisma
├── playwright.config.ts           # 4 browser projects, webServer, reporters
├── .env.example                   # Env template (committed)
├── .env                           # Local env values (gitignored)
├── CLAUDE.md                      # This file
└── README.md
```

---

## Repository conventions

### Package manager

**npm** (not pnpm, not yarn). `package-lock.json` is committed.

### Code style

- **ESLint + Prettier** configured for the app. Tests follow the same config.
- **Strict TypeScript** — no `any` without an explanatory comment.
- **Selectors**: prefer `getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId` over CSS/XPath.
- **Comments**: verbose block comments explaining **why**, not just **what** — this is a learning/demo project.

### Naming

- Spec files: `<feature>.spec.ts` (e.g. `auth.spec.ts`, `articles.spec.ts`)
- Page classes: `PascalCase` + `Page` suffix (`LoginPage`, `ArticlePage`)
- Custom fixtures: `camelCase` in `test-fixtures.ts`
- JSON fixtures: `camelCase` filenames
- Tags in tests: `@tagname` in test title (e.g. `@smoke`, `@auth`, `@articles`, `@profile`)

### Test architecture

- **Helpers** (`tests/helpers/`) — low-level functions (DB operations, API calls, env). No Playwright dependency.
- **Fixtures** (`tests/fixtures/test-fixtures.ts`) — high-level Playwright fixtures that use helpers. Manage lifecycle (setup before test, teardown after).
- **Page Objects** (`tests/pages/`) — one class per page, receives `page: Page` via constructor.
- **Specs** (`tests/e2e/`) — test files that import fixtures and Page Objects.
- **Data** (`tests/fixtures/data/`) — JSON test data, typed via `types.ts`.

### Auth strategy

- `globalSetup` logs in pre-seeded user (jake@jake.jake) via tRPC API → saves storageState.
- `authedPage` fixture loads storageState → page starts logged in.
- `testUser` fixture creates unique user in DB → provides to test → deletes after.
- Tests that don't need auth use plain `page` (no storageState).

### Database strategy

- `base.sqlite` — seed data, committed, never modified.
- `database.sqlite` — dev DB for `npm run dev`, created by `npm install`.
- `test.sqlite` — test DB, reset from `base.sqlite` in `globalSetup` before every run.
- All test helpers use `TEST_DATABASE_URL`, never `DATABASE_URL`.

---

## Environment variables

Defined in `.env.example`, validated by `tests/helpers/env.ts` via zod:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | App database | `file:./database.sqlite` |
| `JWT_SECRET` | JWT signing key | `some-super-secret-string` |
| `BASE_URL` | App URL for tests | `http://localhost:3000` |
| `TEST_DATABASE_URL` | Test database | `file:./test.sqlite` |
| `TEST_USER_EMAIL` | Pre-seeded user email | `jake@jake.jake` |
| `TEST_USER_PASSWORD` | Pre-seeded user password | `jakejake` |

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

---

## CI/CD

### PR Pipeline (`e2e.yml`)

- Triggers: push/PR to `setup/playwright`, `tests/e2e-suite`, `dev`, `main`
- Browser: Chromium only (fast feedback)
- Manual trigger with optional `--grep` tag filter
- Artifacts: Playwright report, Allure report, traces on failure

### Nightly Regression (`nightly.yml`)

- Schedule: 2:00 AM UTC daily
- Matrix: chromium, firefox, mobile-chrome, mobile-safari
- Manual trigger with tag filter and browser selection
- Per-browser artifacts

### GitHub Secrets

| Secret | Used for |
|---|---|
| `JWT_SECRET` | JWT token signing in test environment |
| `TEST_USER_EMAIL` | Pre-seeded user login |
| `TEST_USER_PASSWORD` | Pre-seeded user login |

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

## Planned improvements (M4 — dev branch)

These are documented decisions to be implemented during the final polish phase:

### P1 — Multi-environment support via secret prefixes

GitHub Environments are paid for private repos. Instead, use prefixed secrets in the shared space (`STAGING_JWT_SECRET`, `PROD_JWT_SECRET`) with `workflow_dispatch` environment selector. Workflows will substitute the correct prefix based on the chosen environment. Commented-out templates will be added to `.env.example` and workflow files.

### P2 — Allure trace attachment for failed tests

Add `testInfo.attach('trace', { path: traceFile })` in the `authedPage` fixture teardown. When a test fails, the trace file will be embedded in the Allure report — clickable download button next to the failed test, no need to dig through separate artifacts.

### P3 — Flake stabilization

After all specs are written (M3), analyze test stability across 10+ CI runs. Identify and fix flaky tests: add explicit waits, improve selectors, adjust timeouts, isolate test data better.

### P4 — Dependency audit

One deliberate commit addressing npm audit findings. Document which vulnerabilities are in dev-only transitive dependencies (safe to ignore) vs which need action.

### P5 — README with CI badges

Final README with status badges (CI passing, Playwright version), architecture diagram, quick start guide, full command reference, and "How to evaluate this project" section for recruiters.

---

## Notes for Claude Code

- **Follow the Page Object pattern** in `tests/pages/`. Don't put selectors in spec files.
- **Prefer semantic locators**: `page.getByRole('button', { name: /sign up/i })` over CSS selectors.
- **New env variables** → add to `.env.example` + `env.ts` zod schema + GitHub Secrets.
- **New npm scripts** → update workflow if needed in the same commit.
- **Don't touch `src/`** unless adding `data-testid` attributes.
- **Import test and expect** from `tests/fixtures/test-fixtures.ts`, not from `@playwright/test` directly.
- **Verbose comments** are welcome — this is a learning/demo project.
- **Tags**: use `@tagname` in test titles for filtering. Common tags: `@smoke`, `@auth`, `@articles`, `@profile`.