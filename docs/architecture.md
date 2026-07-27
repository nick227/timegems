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

The core product artifact is `WorkSession`, whose duration is never trusted from a client clock — it's derived from an append-only `WorkSessionInterval` log (`ACTIVE`/`PAUSED` boundaries), summed server-side on stop into `activeDurationSec`. `UserActiveSession` is a database coordination row keyed uniquely by `userId`; start inserts it in the same transaction as the session, and stop removes it atomically, so concurrent requests cannot create two active sessions for one user. Pause/resume/stop use conditional status updates and transactional interval boundaries. See `docs/database.md` for the full model list, and `../docs/data-model.md` (the original design doc) for the reasoning behind each modeling choice.

`AgentEmployee` + `AgentReport` model the automation workforce: an employee is a configured role (all 5 kinds — Summarizer, QA, PM, Code Review, Steering — ship in this build), a report is one produced artifact scoped to a tenant/team/project. Reports post into an in-app feed (`postedTo: [{channel: "feed"}]`); Discord/GitHub cross-posting is V2. **These are heuristic/aggregation workers today, not AI agents** — see `docs/admin.md` for the honesty note and `apps/server/src/services/AgentEmployeeService.ts` for the dispatch logic.

`GithubWebhookDelivery` + `ProjectEvent` + `ProjectUpdateJob` + `ProjectUpdate` model the GitHub-to-AI project activity pipeline. Ownership is deliberate: `GithubService` verifies the webhook signature, persists the raw GitHub delivery, resolves repository/project bindings, and normalizes provider payloads; `ProjectEventService.record()` owns canonical event persistence, unified-feed broadcast, and AI job scheduling; `ProjectUpdateJobService` batches related push activity and turns it into one durable `ProjectUpdate`; `ProjectUpdateWriterService` writes an evidence-grounded summary from commits, changed files, PR/check context, and recent project activity. This keeps "raw delivery dedupe" (`GithubWebhookDelivery.githubDeliveryId`) separate from "normalized event idempotency" (`ProjectEvent.externalId`).

`GemType` + `GemLedgerEntry` + `GemBalance` model the TimeGem economy: one gem type per project, one ledger entry per finalized `WorkSession` (unique-constrained on `workSessionId` for idempotency), a materialized `GemBalance` cache. `GemAccount` is a stable `(userId, projectId)` serialization row acquired with `FOR UPDATE` by every accounting mutation. Normal Stop appends one entry and advances carry inside the work-session transaction; corrections, deletion, rule changes, and administrative repair replay the ledger deterministically under the same lock. Out-of-order settlement automatically falls back to replay so per-session carry remains canonical.

Agent employees run two ways, neither manual-only: `on_change` fires from `WorkSessionService.stop()` (fire-and-forget, never blocking the response), `every:<n><unit>` is swept every 60s by `apps/server/src/scheduler.ts`. Both funnel through `AgentEmployeeService.run()`, the single place that updates `lastRunAt` and produces a report regardless of trigger source.

Live presence (`apps/server/src/presence.ts`) is a WebSocket route registered directly on the Fastify instance — deliberately bypassing `fastify-openapi-glue`, since OpenAPI 3.1 has no first-class way to describe a WebSocket message protocol. Presence state is in-memory only (`tenantId -> userId -> {sockets, status, ...}`), never a database table; the database remains authoritative for real work sessions. The frontend's `usePresenceConnection`/`usePresenceList` hooks (`packages/sdk/src/hooks/usePresence.ts`) share one WebSocket per browser tab via module-level state, pushing live updates into the React Query cache under the `['presence']` key. The same socket now also delivers project-room activity frames (`project-note`, `project-activity`) only to authorized viewers currently present on that project.

## Frontend: full-screen, single-focus

`apps/web/src/components/layout/Shell.tsx` deviates from the factory's default sidebar+bottom-nav template. TimeGems has one dominant screen (Work, at `/`) with no persistent navigation chrome; a `fixed` hamburger button opens a grouped slide-over drawer for the supporting surfaces: Work; Plan (Projects, Goals); Team (Teams, Activity); Automation (Agent Reports); Account (Settings); and capability-gated Administration (Admin). Empty capability-gated groups are omitted. Integrations remains directly addressable but is not promoted in primary navigation until it offers a meaningful action. `<main>` carries `pt-14` so page content clears the button; it does not declare `min-h-screen` itself so it doesn't double up with each page's own full-height wrapper.

`apps/web/src/App.tsx` is hand-written, not generated — `pnpm pages:generate`'s per-HTTP-method heuristic (every `POST` → create-form, every `PATCH` → edit-form) doesn't fit an action-heavy API like `/work-sessions/{id}/pause`. The generator is still useful for genuinely list/detail-shaped resources (Projects, Teams, Reports, Admin lists); action endpoints are hand-built instead (see `apps/web/src/features/work-sessions/WorkSessionsRoute.tsx`).

Frontend authorization consumes the server-derived `capabilities` returned by
`GET /auth/me`; it does not translate tenant roles locally. `AuthGuard`
provides the authenticated user/tenant/capability context, `can()` controls
privileged actions and navigation visibility, and `CapabilityGuard` protects
the Admin route. `session:manage` authorizes tenant owners/admins to correct
or delete another member's stopped session; resource ownership independently
allows members to correct their own history. Server authorization remains
authoritative for every request.

## Auth: Google-only

There is no email/password flow. `User.googleId` is required and unique. `POST /auth/google` verifies a Google ID token server-side (`google-auth-library`) and sets the same httpOnly session cookie either way. `apps/web/src/features/auth/LoginRoute.tsx` doubles as registration — a first-time Google sign-in creates the account.

The Google Identity Services script is loaded dynamically by the login control so script, client-ID configuration, SDK initialization, and credential-exchange failures have separate user-visible recovery paths. The server returns `503` when its Google client ID is missing instead of treating deployment misconfiguration as a bad credential.

`AuthGuard` preserves the requested in-app route across an expired session, distinguishes `403` from an authentication-service outage, and exposes an in-place retry for transient failures. Query-driven detail routes share a status-aware error state: `404` is not found, `403` is no access, and other failures are retryable without leaving the route.
