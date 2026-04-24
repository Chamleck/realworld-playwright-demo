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
- **JWT** auth — token stored in `sessionStorage` by the frontend
- **TypeScript** strict mode, **Tailwind CSS**

### Test framework (to be introduced in `setup/playwright` branch)

- **Playwright** + **TypeScript**
- **Allure** reporter (`allure-playwright` + `allure-commandline`)
- **Playwright Trace Viewer** (built-in, no extra deps)
- **GitHub Actions** for CI
- **dotenv** + **zod** for typed, validated env loading

---

## Branch strategy (git flow for this project)

```
main                         ← application under test only (no tests)   [YOU ARE HERE]
 └── setup/playwright           ← Playwright infrastructure, config, CI, reporting
      └── tests/e2e-suite         ← actual spec files + Page Objects
           └── dev                   ← stable integration branch, polish, final docs
```

- Each branch opens a **pull request into its parent**. PRs are the primary demo artifact.
- No direct pushes to `main`.
- `dev` eventually merges back to `main` once the full project is complete.

---

## Repository conventions

### Package manager

**npm** (not pnpm, not yarn). `package-lock.json` is committed and must be kept in sync.

### Code style

- **ESLint + Prettier** are already configured for the app. Tests follow the same config.
- **Strict TypeScript** everywhere — no `any` without an explanatory comment.
- **Selectors**: prefer Playwright's semantic locators (`getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId`) over CSS/XPath. When a stable test hook is missing in the UI, add a `data-testid` attribute to the app rather than chain brittle CSS selectors in tests.
- **Comments**: this is a learning-mode demo project — verbose block comments explaining **why** (not just **what**) are encouraged, especially above non-obvious config or fixtures.

### Target structure (from `setup/playwright` onwards)

```
tests/
  e2e/                 # spec files, one per feature area (auth.spec.ts, articles.spec.ts, ...)
  pages/               # Page Object Models — class per page, receives `page: Page` via constructor
  fixtures/
    data/              # JSON test data (users.json, articles.json, ...)
    test-fixtures.ts   # Playwright custom fixtures (authedPage, seededUser, ...)
  helpers/
    db.ts              # Prisma helpers: seedUser, deleteUser, deleteArticle
    api.ts             # tRPC helpers: loginViaAPI, registerViaAPI
    env.ts             # typed env loader (zod-validated)
  auth/
    .storage-state.json  # saved auth state — gitignored

.github/
  workflows/
    e2e.yml            # PR pipeline — Chromium only, fast feedback
    nightly.yml        # full matrix — all browsers + mobile, runs on schedule

playwright.config.ts
.env.example           # committed template
.env                   # local overrides, gitignored
```

### Naming

- Spec files: `<feature>.spec.ts` (e.g. `auth.spec.ts`, `articles.spec.ts`)
- Page classes: `PascalCase` + `Page` suffix (`LoginPage`, `ArticlePage`)
- Custom fixtures: `camelCase` functions exported from `test-fixtures.ts`
- JSON fixtures: `camelCase` filenames

---

## Environment variables

The **application** requires (loaded from `.env`, copied from `.env.example`):

```bash
DATABASE_URL="file:./database.sqlite"
JWT_SECRET="some-super-secret-string"
```

`npm run initialize:env` copies `.env.example` → `.env` automatically (idempotent — won't overwrite).

The **test framework** (to be added in `setup/playwright`) will additionally require:

```bash
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
TEST_DATABASE_URL="file:./test.sqlite"
```

All env vars must be validated at startup via zod. New vars require adding them to **both** `.env.example` AND the zod schema in `tests/helpers/env.ts`.

---

## Commands

### Current (`main` branch)

| Command | What it does |
|---|---|
| `npm install` | Installs deps + runs postinstall (env + DB setup + Prisma generate) |
| `npm run dev` | Starts Next.js dev server on `localhost:3000` |
| `npm run build` / `npm run start` | Production build + serve |
| `npm run lint` | ESLint |
| `npm run initialize:fresh` | Reset `.env` and DB to seed state |

### Placeholder scripts (inherited from template, to be replaced in `setup/playwright`)

| Command | Current state |
|---|---|
| `npm run test:initialize:database` | Copies `base.sqlite` → `test.sqlite`. Will be kept and wired into `globalSetup`. |
| `npm run test:run` | Prints an echo. Will be replaced with `playwright test`. |

### Planned (added progressively in later branches)

| Command | What it does |
|---|---|
| `npm test` | Run all Playwright tests (headless) |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:headed` | Headed mode |
| `npm run test:debug` | Playwright debug mode |
| `npm run test:trace` | Open Trace Viewer on the last run |
| `npm run allure:generate` | Build Allure report from `allure-results/` |
| `npm run allure:open` | Open the generated Allure report |

---

## Architectural decisions (ADRs)

*Grows as decisions are made. Each decision gets a short rationale so future readers understand the "why".*

### D1 — Why Playwright, not Cypress *(to be expanded in `setup/playwright`)*

Headlines: native WebKit support (real Safari testing, not simulated via userAgent), built-in parallelism and sharding, auto-waiting locators, first-class Trace Viewer with time-travel debugging, cleaner `async`/`await` model, superior TypeScript inference, better CI story with sharding and dependency projects.

### D2 — Auth via API + storage state *(planned, `setup/playwright`)*

Rather than logging in through the UI on every test, log in **once** via the tRPC API in `global.setup.ts`, save `sessionStorage` + cookies to `tests/auth/.storage-state.json`, and reuse it as the default state for authenticated specs. Cuts per-test startup by several seconds and eliminates a common source of flake (the login form itself).

### D3 — Separate test database *(planned, `setup/playwright`)*

Tests run against `prisma/test.sqlite`, reset from `prisma/base.sqlite` in `globalSetup`. `DATABASE_URL` is overridden at the test-process level so the dev database is never touched.

### D4 — Allure on top of Playwright's HTML reporter *(planned, `setup/playwright`)*

Playwright's HTML reporter stays as the quick-look local debugging tool. Allure layers on top for richer reporting: history, trends, severity tags, step-level attachments. Traces, screenshots, and videos attach to Allure results automatically.

---

## Notes for Claude Code (when assisting on this repo)

- **When adding a new test**, follow the Page Object pattern established in `tests/pages/`. Don't put selectors in spec files.
- **Prefer semantic locators**: `page.getByRole('button', { name: /sign up/i })` over `page.locator('button:has-text("Sign up")')`.
- **Every new env variable** must be added to **both** `.env.example` AND the zod schema in `tests/helpers/env.ts` — otherwise it won't be validated at startup and will silently be `undefined`.
- **CI workflows** live in `.github/workflows/`. If you add a new npm script that should run in CI, update the workflow in the same commit.
- **Verbose comments** explaining design choices are welcome, even encouraged — this is a learning/demo project.
- **When modifying a Page Object's public API**, update the specs that use it in the same commit.
- **Don't touch application code** in `src/` unless the task explicitly calls for it (e.g. adding `data-testid` attributes to improve test selectors). All other work happens in `tests/`, `.github/`, and root config files.
- **Placeholder scripts** `test:run` and `test:initialize:database` exist in `package.json` from the upstream template — they are intentionally left there to be replaced in the `setup/playwright` branch. Don't remove them from `main`.
