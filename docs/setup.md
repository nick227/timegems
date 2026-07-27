# Developer Setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8+ / MariaDB 10.11+ (or compatible)
- A Google Cloud project with OAuth 2.0 credentials only when testing real Google login

## First-time setup

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL; Google credentials are optional locally
pnpm bootstrap              # installs, migrates, generates, and seeds
```

`pnpm bootstrap` prints a dev session token from the seed script — set it as a `token` cookie on `localhost:5173` (via devtools) to explore the app immediately without configuring real Google OAuth first.

## Running

```bash
pnpm dev      # starts all apps in parallel
```

Web: http://localhost:5173
API: http://localhost:3001
API Docs: http://localhost:3001/docs — live Swagger UI

## Google OAuth setup (for real login)

1. Create OAuth 2.0 credentials in the Google Cloud Console.
2. Add `http://localhost:5173` (dev) and your production domain to Authorized JavaScript origins.
3. Copy the Client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in `.env`.

## Daily commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the web and API development servers |
| `pnpm check:fast` | Typecheck, lint, and check generated-file/contract drift |
| `pnpm test:affected` | Run the currently applicable package tests |
| `pnpm test` | Run all package test suites |
| `pnpm verify` | Full typecheck, lint, server tests, Playwright, generation drift, production build, and migration status |
| `pnpm db:migrate` | Apply committed database migrations |
| `pnpm generate` | Regenerate SDK types, missing test stubs, explicitly opted-in pages, and docs in the correct order |

## Running tests

Server integration tests always use an isolated database because they wipe every table between tests. Set `TEST_DATABASE_URL` explicitly when needed; otherwise the runner derives a sibling database ending in `_test` from `DATABASE_URL`, creates it if necessary, and applies migrations before Vitest starts.

```bash
pnpm test                       # package tests, including server integration tests
pnpm --filter web test:e2e      # Playwright; starts the web and API servers
pnpm verify                     # exhaustive release verification
```

## Code generators

| Command | What it does |
|---|---|
| `pnpm sdk:generate` | Regenerate SDK types from `openapi.yaml` — run after spec changes |
| `pnpm test:generate` | Append safe `it.todo` coverage markers for new routes |
| `pnpm docs:generate` | Regenerate `docs/api-reference.md`, `docs/env-vars.md`, `docs/database.md` |
| `pnpm pages:generate` | Generate only pages explicitly opted in with `x-timegems-page` |
| `pnpm generate:check` | Check SDK, test coverage markers, opted-in pages, and docs without writing |

### Safe page generation

Page generation is opt-in rather than inferred from HTTP methods. Add `x-timegems-page: list`, `detail`, `create-form`, `edit-form`, or `auth` to an operation only when its SDK hook follows that supported page shape. Generated pages live under `apps/web/src/generated/pages`; the generator never rewrites `App.tsx` or handcrafted feature routes. Action endpoints such as pause, resume, review, stop, and tenant selection are therefore ignored by default.

## Adding a new route

1. Add the route + schemas to `packages/api-spec/openapi.yaml` (give every non-2xx response an entry — see `docs/architecture.md` on why this is load-bearing for SDK typing, not just documentation).
2. `pnpm sdk:generate` — updates `packages/sdk/src/generated/types.ts`.
3. Add a named export to `apps/server/src/handlers/` matching the `operationId`, delegating to a service in `apps/server/src/services/`.
4. `pnpm test:generate` — appends a test stub; fill in seed data and assertions.
5. Add a hook to `packages/sdk/src/hooks/` and export it from `hooks/index.ts`.
6. Use the hook from the relevant page in `apps/web`.
7. `pnpm docs:generate` — updates the API reference.
