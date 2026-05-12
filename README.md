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

## Architecture

### Test framework layers

```
Specs (tests/e2e/*.spec.ts)
  ├── use Fixtures (tests/fixtures/test-fixtures.ts)
  │     ├── authedPage         — browser with pre-loaded auth session (global user)
  │     ├── testUser           — unique user seeded in DB, cleaned up after test
  │     ├── authedTestUserPage — browser authenticated as testUser (for profile tests)
  │     ├── seededArticle      — article created via API, cleaned up after test
  │     └── profileUpdate      — unique profile data generated per test (parallel-safe)
  ├── use Page Objects (tests/pages/*Page.ts)
  │     └── encapsulate selectors and page interactions (BasePage + 6 page classes)
  └── use Test Data (tests/fixtures/data/*.json)
        └── typed JSON templates for users, articles, comments

Fixtures call Helpers (tests/helpers/)
  ├── db.ts  — Prisma: seedUser, deleteUser, deleteArticle
  ├── api.ts — tRPC: loginViaAPI, registerViaAPI, createArticleViaAPI
  └── env.ts — zod-validated environment variables
```

### Browser coverage

| Project | Device | Engine |
|---|---|---|
| `chromium` | Desktop Chrome 1920×1080 | Blink |
| `firefox` | Desktop Firefox | Gecko |
| `mobile-chrome` | Pixel 7 (412×915) | Blink |
| `mobile-safari` | iPhone 13 (390×844) | WebKit |

### CI/CD

- **PR pipeline** (`e2e.yml`): Chromium only, runs on every push/PR. Fast feedback.
- **Nightly regression** (`nightly.yml`): All 4 browsers, runs at 2:00 AM UTC daily.
- Both support manual trigger with tag filtering and browser selection.
- Artifacts: Playwright HTML report, Allure report, traces/screenshots/videos on failure.

### Auth strategy

`globalSetup` logs in once via tRPC API → saves session to `storageState.json`. Tests use:
- `authedPage` — page pre-loaded with the global user's session (fast, no UI login)
- `authedTestUserPage` — page authenticated as a freshly created `testUser` via API (for profile tests that mutate user data)
- plain `page` — anonymous browser context (no auth)

### Database isolation

Tests use a separate `test.sqlite` (copied from seed data in `globalSetup`). Dev database (`database.sqlite`) is never touched by tests.

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
2. **Look at the architecture** — `tests/` folder structure, separation of helpers/fixtures/pages/specs.
3. **Check the CI** — `.github/workflows/` for pipeline design, artifact handling, matrix strategy.
4. **Run the tests** — `npm test` to see it work end-to-end.
5. **Read CLAUDE.md** — documents every architectural decision.

## License

MIT — see [LICENSE](./LICENSE).