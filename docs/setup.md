# Developer Setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8+ / MariaDB 10.11+ (or compatible)
- A Google Cloud project with OAuth 2.0 credentials (for real login — see below)

## First-time setup

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL, GOOGLE_CLIENT_ID
pnpm bootstrap               # installs, pushes schema, generates SDK/pages/tests, seeds
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

## Running tests

Server integration tests need `DATABASE_URL` pointed at a **separate** database from dev (tests wipe every table between runs):

```bash
export DATABASE_URL="mysql://user:pass@localhost:3306/timegems_test"
pnpm --filter @timegems/db exec prisma db push --skip-generate
pnpm test          # Vitest — server integration tests (79 tests)
pnpm test:e2e      # Playwright — frontend smoke test (requires both dev servers)
```

## Code generators

| Command | What it does |
|---|---|
| `pnpm sdk:generate` | Regenerate SDK types from `openapi.yaml` — run after spec changes |
| `pnpm test:generate` | Append test stubs for new routes — run after spec changes |
| `pnpm docs:generate` | Regenerate `docs/api-reference.md`, `docs/env-vars.md`, `docs/database.md` |
| `pnpm pages:generate` | Generate page stubs from the spec — **see the caveat below** |

### `pages:generate` caveat

The generator infers a page pattern from HTTP method alone (every `POST` → create-form, every `PATCH` → edit-form, every parameterless `GET` → list, every `GET` with a path param → detail). That fits CRUD resources (Projects, Teams, Reports, Admin lists) but not action endpoints (`/work-sessions/{id}/pause`, `/tenants/{id}/select`, etc.) — those are hand-built (see `apps/web/src/pages/WorkPage.tsx`). If you re-run `pnpm pages:generate` or `pnpm bootstrap` on a clean checkout, it will recreate stub pages for those action endpoints using signatures that don't match our hand-written hooks, and `pnpm --filter web typecheck` will fail. Delete anything created in `apps/web/src/pages/` that isn't imported by `App.tsx`, then re-run typecheck.

## Adding a new route

1. Add the route + schemas to `packages/api-spec/openapi.yaml` (give every non-2xx response an entry — see `docs/architecture.md` on why this is load-bearing for SDK typing, not just documentation).
2. `pnpm sdk:generate` — updates `packages/sdk/src/generated/types.ts`.
3. Add a named export to `apps/server/src/handlers/` matching the `operationId`, delegating to a service in `apps/server/src/services/`.
4. `pnpm test:generate` — appends a test stub; fill in seed data and assertions.
5. Add a hook to `packages/sdk/src/hooks/` and export it from `hooks/index.ts`.
6. Use the hook from the relevant page in `apps/web`.
7. `pnpm docs:generate` — updates the API reference.
