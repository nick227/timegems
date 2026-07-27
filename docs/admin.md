# Admin

Site admin is a platform-level capability (`AdminUser`), separate from tenant roles (`Membership.role`). A user can be a `MEMBER` of one tenant and still be a platform `SUPERADMIN`/`SUPPORT` — the two are unrelated.

## Granting admin access

There's no self-serve UI for this in V1 (by design — it's a rare, high-trust action). Grant it directly:

```typescript
await db.adminUser.create({ data: { userId: '<user id>', role: 'SUPERADMIN' } })
```

The seed script (`packages/db/prisma/seed.ts`) grants it to the seeded dev user automatically.

## Routes

All under `/admin/*`, gated by the `adminAuth` security scheme (`apps/server/src/plugins/security.ts`) — it runs `bearerAuth` first, then requires an `AdminUser` row for that user, else `403`.

| Route | Purpose |
|---|---|
| `GET /admin/tenants` | Platform-wide tenant list |
| `PATCH /admin/tenants/{tenantId}` | Change plan |
| `GET /admin/users` | Platform-wide user list |
| `PATCH /admin/users/{userId}` | Suspend / unsuspend |
| `GET /admin/agent-employees` | View configured agent employees, including `lastRunAt` |
| `POST /admin/agent-employees/{agentEmployeeId}/run` | Manually trigger a run, outside its schedule |

## Frontend

`apps/web/src/pages/AdminPage.tsx` — tabbed (Tenants / Users / Agent Employees), all client-side tab state, no separate routes per tab.

## Agent employee console — what's V1 vs V2

V1 ships enough to make agent employees actual scheduled/reactive workers, not just a manual trigger: view configured employees (with last-run time) and manually trigger a run. There is no config-editing UI, no schedule *editor*, and no per-tenant override UI yet — `AgentEmployee.schedule`/`.config` are set directly in the database (see the seed script for the two schedule styles). The full console (FR-25 in `docs/system-requirements.md`) — enable/disable toggle in the UI, edit prompt/config, view run history, per-tenant overrides — is V2, per `docs/roadmap.md`.

## Scheduling (`apps/server/src/scheduler.ts` + `AgentEmployeeService.runOnChangeForTenant`)

Two trigger styles, both real, neither manual-only:

- **`on_change`** — event-driven. `WorkSessionService.stop()` fires `runOnChangeForTenant(tenantId)` for every enabled `on_change` employee in that tenant, fire-and-forget (never awaited by the Stop response — a slow or failing agent run must not delay or break the person who was just working).
- **`every:<n><unit>`** (`m`/`h`/`d`, e.g. `every:24h`) — interval-based. A single sweep (`startScheduler()`, called once from `apps/server/src/index.ts`) runs every 60s, checks every enabled employee's `lastRunAt` against its interval, and runs any that are due. This is a small dependency-free mini-syntax, not a full cron parser — it covers every interval an agent employee actually needs; anything more exotic can wait for V2's real config editor.

Both paths — and the manual "Run now" button — funnel through the same `AgentEmployeeService.run()`, which is what updates `lastRunAt`. There's exactly one place that decides what a report looks like, regardless of what triggered it.

## Agent employee kinds

See `apps/server/src/services/AgentEmployeeService.ts` for the dispatch logic — one report-generation function per `AgentEmployeeKind` (`SUMMARIZER`, `QA`, `PM`, `CODE_REVIEW`, `STEERING`). All of them read recent `WorkSession`/`Note` data for the employee's tenant and write one `AgentReport`; `STEERING` additionally creates a `Goal` row (`status: PROPOSED` — see `docs/functional-design.md` on why a Goals approval page, not just the report, is what actually makes "agents only propose" true).

**These are heuristic/aggregation workers, not AI agents** — no LLM call is wired in yet (see NFR-7, `docs/system-requirements.md`). Code Review and QA are explicitly limited to reading work-log note text; they say so in their own generated output rather than imply broader visibility, because they have no GitHub or Google Docs access yet (V2 — see `docs/roadmap.md`). This keeps the report shape, the admin "Run now" button, and the Reports feed stable so a real model call can replace the body-generation logic later without changing the API contract or the UI.
