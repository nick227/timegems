# Architecture

## The Pipeline

Every feature flows from the OpenAPI spec:

```
packages/api-spec/openapi.yaml   ← source of truth for all routes
  ├── openapi-typescript          → packages/sdk/src/generated/types.ts
  ├── openapi-fetch               → packages/sdk/src/client.ts (typed, zero hand-written methods)
  ├── fastify-openapi-glue        → apps/server routes, validation, and auth wired automatically
  ├── generate-tests.ts           → apps/server/src/__tests__/ (one stub per operationId)
  └── generate-docs.ts            → docs/api-reference.md
```

## Packages

| Package | Purpose |
|---|---|
| `packages/db` | Prisma client and schema — only place DB structure is defined |
| `packages/api-spec` | OpenAPI 3.1 YAML — the contract between server and client |
| `packages/sdk` | Typed fetch client + React Query hooks — portable across any React app |
| `apps/server` | Fastify API server — implements what the spec declares |
| `apps/web` | Vite + React frontend — imports data only from `@timegems/sdk` |

## Rules

- A route exists only if it is in `openapi.yaml`.
- The SDK never imports from `apps/server`.
- Pages never call `fetch` directly — all data comes from `@timegems/sdk` hooks.
- Generated files (`types.ts`, test stubs, API reference) are never edited by hand.

## Domain model

Multi-tenant from the ground up: every domain model except `User` and `AdminUser` carries a `tenantId`. A `Session` row tracks which tenant is currently active (`activeTenantId`) — `POST /tenants/{id}/select` is how a user with multiple tenant memberships switches context.

The core product artifact is `WorkSession`, whose duration is never trusted from a client clock — it's derived from an append-only `WorkSessionInterval` log (`ACTIVE`/`PAUSED` boundaries), summed server-side on stop into `activeDurationSec`. See `docs/database.md` for the full model list, and `../docs/data-model.md` (the original design doc) for the reasoning behind each modeling choice.

`AgentEmployee` + `AgentReport` model the AI workforce: an employee is a configured role (Summarizer in V1; QA/PM/Code Review/Steering added in V2), a report is one produced artifact scoped to a tenant/team/project. Reports post into an in-app feed (`postedTo: [{channel: "feed"}]`); Discord/GitHub cross-posting is V2.

## Frontend: full-screen, single-focus

`apps/web/src/components/layout/Shell.tsx` deviates from the factory's default sidebar+bottom-nav template. TimeGems has one dominant screen (Work, at `/`) with no persistent navigation chrome; a `fixed` hamburger button opens a slide-over drawer for every secondary surface (Projects, Team, Views, Reports, Integrations, Settings, Admin). `<main>` carries `pt-14` so page content clears the button; it does not declare `min-h-screen` itself so it doesn't double up with each page's own full-height wrapper.

`apps/web/src/App.tsx` is hand-written, not generated — `pnpm pages:generate`'s per-HTTP-method heuristic (every `POST` → create-form, every `PATCH` → edit-form) doesn't fit an action-heavy API like `/work-sessions/{id}/pause`. The generator is still useful for genuinely list/detail-shaped resources (Projects, Teams, Reports, Admin lists); action endpoints are hand-built instead (see `apps/web/src/pages/WorkPage.tsx`).

## Auth: Google-only

There is no email/password flow. `User.googleId` is required and unique. `POST /auth/google` verifies a Google ID token server-side (`google-auth-library`) and sets the same httpOnly session cookie either way. `apps/web/src/pages/Login.tsx` doubles as registration — a first-time Google sign-in creates the account.
