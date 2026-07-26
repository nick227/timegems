# TimeGems

Multi-tenant work tracker for developer teams. Single-focus core loop — Start Work, Pause, Stop, notes — with AI agent employees that summarize and review team activity.

See `docs/` for the system requirements, data model, functional design, and roadmap this build follows, plus generated/developer docs: [`architecture`](docs/architecture.md), [`setup`](docs/setup.md), [`sdk`](docs/sdk.md), [`deployment`](docs/deployment.md), [`admin`](docs/admin.md), [`api-reference`](docs/api-reference.md), [`env-vars`](docs/env-vars.md), [`database`](docs/database.md).

## Setup

1. Copy env: `cp .env.example .env` and fill in `DATABASE_URL` and Google OAuth `GOOGLE_CLIENT_ID`
2. Run bootstrap: `pnpm bootstrap` — installs deps, pushes schema, generates SDK + pages + tests, seeds data

## Dev

```bash
pnpm dev
```

Web: http://localhost:5173
API: http://localhost:3001

## Commands

| Command | Description |
|---|---|
| `pnpm bootstrap` | First-run: install, push schema, generate everything, seed |
| `pnpm dev` | Run all apps in dev mode |
| `pnpm sdk:generate` | Regenerate types from OpenAPI spec |
| `pnpm sdk:check` | Fail if committed types.ts has drifted from spec |
| `pnpm test:generate` | Generate test stubs for new operationIds |
| `pnpm docs:generate` | Regenerate docs from spec/schema/env |
| `pnpm pages:generate` | Generate page stubs + App.tsx from spec (re-run safe) |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm db:push` | Push Prisma schema to DB |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Prisma Studio |
