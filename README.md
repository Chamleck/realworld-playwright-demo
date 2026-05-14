# RealWorld Playwright Demo

> End-to-end test automation portfolio project: **Playwright + TypeScript** framework built from scratch against a RealWorld (Conduit) full-stack application.

## About this repository

This project demonstrates how to build a scalable, maintainable E2E test automation framework from scratch. The application under test is a [RealWorld](https://github.com/gothinkster/realworld) Medium.com clone ("Conduit") built on Next.js 14 + tRPC + Prisma + SQLite.

See [APPLICATION.md](./APPLICATION.md) for the app architecture.

## Branch strategy

| Branch | What's in it |
|---|---|
| `main` | Application under test only — no E2E framework. |
| `setup/playwright` | Playwright infrastructure: config, fixtures, helpers, env, Allure, GitHub Actions. |
| `tests/e2e-suite` | Actual specs (auth, articles, profile) using the framework. **You are here.** |
| `dev` | Stable integration branch. Final polish and documentation. |

Each branch opens a PR into its parent — the PRs show the evolution of the project.

## Quick start

### Prerequisites

- Node.js 18+
- npm

### Install & run tests

```bash
git clone https://github.com/Chamleck/realworld-playwright-demo.git
cd realworld-playwright-demo
git checkout tests/e2e-suite
npm install
npx playwright install
npm test
```

`npm test` will automatically start the application, run all tests, and stop the server.

### Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm test` | All tests, all browsers, headless |
| `npm run test:chromium` | Chromium only |
| `npm run test:firefox` | Firefox only |
| `npm run test:mobile` | Mobile Chrome + Mobile Safari |
| `npm run test:headed` | With visible browser |
| `npm run test:ui` | Playwright UI mode (visual debugger) |
| `npm run test:debug` | Step-by-step debugging with DevTools |
| `npm run test:grep -- @smoke` | Run tests by tag |
| `npm run test:list` | List all tests without running |
| `npm run test:with-report` | Tests + generate and open Allure report |
| `npm run test:report` | Open Playwright HTML report |
| `npm run test:trace` | Open Trace Viewer |
| `npm run allure:generate` | Generate Allure report from allure-results/ |
| `npm run allure:open` | Open generated Allure report |
| `npm run allure:report` | Generate + open Allure report |
| `npm run type:check` | TypeScript type check for test files only |
| `npm run lint:tests` | Run ESLint on test files only |

## Architecture

### Test framework layers
Specs (tests/e2e/*.spec.ts)
├── use Fixtures (tests/fixtures/test-fixtures.ts)
│     ├── authedPage         — browser with pre-loaded auth session (global user)
│     ├── testUser           — unique user seeded in DB, cleaned up after test
│     ├── authedTestUserPage — browser authenticated as testUser (for profile tests)
│     ├── seededArticle      — article created via API, cleaned up after test
│     └── profileUpdate      — unique profile data generated per test (parallel-safe)
├── use Page Objects (tests/pages/Page.ts)
│     └── encapsulate selectors and page interactions (BasePage + 6 page classes)
│         all action methods wrapped in test.step() for granular Allure reporting
└── use Test Data (tests/fixtures/data/.json)
└── typed JSON templates for users, articles, comments
Fixtures call Helpers (tests/helpers/)
├── db.ts  — Prisma: seedUser, deleteUser, deleteArticle
├── api.ts — tRPC: loginViaAPI, registerViaAPI, createArticleViaAPI
└── env.ts — zod-validated environment variables

### Browser coverage

| Project | Device | Engine |
|---|---|---|
| `chromium` | Desktop Chrome 1920×1080 | Blink |
| `firefox` | Desktop Firefox | Gecko |
| `mobile-chrome` | Pixel 7 (412×915) | Blink |
| `mobile-safari` | iPhone 13 (390×844) | WebKit |

### CI/CD

- **PR pipeline** (`e2e.yml`): Chromium only, runs on every push/PR. Target < 5 minutes.
- **Nightly regression** (`nightly.yml`): All 4 browsers, runs at 2:00 AM UTC daily.
- Both pipelines run `type:check` → `lint` gates before tests — CI fails fast on type errors or lint violations without spending time launching browsers.
- Both support manual trigger via `workflow_dispatch` with `grep` (tag filter), `environment` (dev/staging/production), and browser selection (nightly only).
- Workers: 2 in CI — GitHub runners handle 2 parallel workers stably for this suite size.
- Artifacts: Playwright HTML report + Allure report (always), traces/screenshots/videos (on failure only).
- **Docker considered and deprioritized**: GitHub Actions `ubuntu-latest` runners provide a clean, reproducible environment per run. Docker would add complexity and image pull time without meaningful benefit at this scale.
- **Allure report** (`pages.yml`): auto-published to [GitHub Pages](https://chamleck.github.io/realworld-playwright-demo) after every E2E run. Each pipeline run shows a direct link in its Summary tab.

### Multi-environment support

Both workflows support `dev`, `staging`, and `production` environments via a `workflow_dispatch` input. GitHub Environments are a paid feature for private repos — instead, secrets are prefixed per environment and stored in the shared repository secrets space:

| Environment | Secret naming | Example |
|---|---|---|
| `dev` | no prefix | `JWT_SECRET`, `TEST_USER_EMAIL` |
| `staging` | `STAGING_` prefix | `STAGING_JWT_SECRET`, `STAGING_TEST_USER_EMAIL` |
| `production` | `PROD_` prefix | `PROD_JWT_SECRET`, `PROD_TEST_USER_EMAIL` |

`BASE_URL` is also environment-specific (`STAGING_BASE_URL`, `PROD_BASE_URL`) — each points to the correct deploy target.

> **Note on simulation**: Staging and production secrets currently contain the same values as dev (pointing to `localhost:3000`). This intentionally demonstrates a production-ready multi-environment architecture. When real staging/production environments exist, only the secret values need updating — no workflow changes required.

### GitHub Secrets

| Secret | Environment |
|---|---|
| `JWT_SECRET`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_USER_USERNAME` | dev |
| `STAGING_JWT_SECRET`, `STAGING_TEST_USER_EMAIL`, `STAGING_TEST_USER_PASSWORD`, `STAGING_TEST_USER_USERNAME`, `STAGING_BASE_URL` | staging |
| `PROD_JWT_SECRET`, `PROD_TEST_USER_EMAIL`, `PROD_TEST_USER_PASSWORD`, `PROD_TEST_USER_USERNAME`, `PROD_BASE_URL` | production |

### Auth strategy

`globalSetup` logs in once via tRPC API → saves session to `storageState.json`. Tests use:
- `authedPage` — page pre-loaded with the global user's session (fast, no UI login). Trace recording starts on context creation — `trace.zip` attached to Allure report on failure.
- `authedTestUserPage` — page authenticated as a freshly created `testUser` via API (for profile tests that mutate user data). Also records traces on failure.
- plain `page` — anonymous browser context (no auth)

### Database isolation

Two separate databases, two separate purposes:
- `DATABASE_URL` → `database.sqlite` — used by the **application** (Next.js/Prisma) when it starts via `webServer`. Never touched by tests.
- `TEST_DATABASE_URL` → `test.sqlite` — used by the **test framework** (globalSetup, db helpers). Reset from seed data before every run.

Both variables must be set in CI — the app and the framework each need their own database path.

## Environment variables

Copy `.env.example` to `.env` (done automatically by `npm install`):

```bash
DATABASE_URL="file:./database.sqlite"
JWT_SECRET="some-super-secret-string"
BASE_URL="http://localhost:3000"
TEST_DATABASE_URL="file:./test.sqlite"
TEST_USER_EMAIL="jake@jake.jake"
TEST_USER_PASSWORD="jakejake"
TEST_USER_USERNAME="globalTestUser"
```

All variables are validated at startup via zod — missing or malformed values fail immediately with a clear error.

## How to evaluate this project

If you're reviewing this as a portfolio piece:

1. **Read the PRs** — each branch opens a PR showing a distinct phase of building the framework.
2. **View the live Allure report** — [open the report](https://chamleck.github.io/realworld-playwright-demo) to see step hierarchy, trace attachments, trend graphs, and bug categorization — no setup required.
3. **Look at the architecture** — `tests/` folder structure, separation of helpers/fixtures/pages/specs.
4. **Open the Allure report** — run `npm run allure:report` after `npm test` to see step hierarchy, trace attachments, and test categorization.
5. **Check the CI** — `.github/workflows/` for pipeline design, multi-environment strategy, artifact handling, matrix strategy.
6. **Run the tests** — `npm test` to see it work end-to-end.
7. **Read CLAUDE.md** — documents every architectural decision including tradeoffs and things explicitly not done (and why).


## Future improvements

- **Parallel sharding** — split tests across multiple GitHub Actions runners via `--shard=N/M`. Currently deprioritized: for 22 tests, runner startup overhead (~2-3 min per shard) exceeds the parallelization benefit. Becomes worthwhile at ~100+ tests.
- **Project Dependencies** — alternative to `globalSetup` for scoping setup/teardown per project.
- **API test layer** — complement E2E tests with direct tRPC API tests.
- **Flake analysis** — after 10+ CI runs, analyze retry patterns to identify and stabilize flaky tests.
- **Mobile viewport tests** — dedicated mobile-specific test scenarios.

## License

MIT — see [LICENSE](./LICENSE).