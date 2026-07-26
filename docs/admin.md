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
| `GET /admin/agent-employees` | View configured agent employees |
| `POST /admin/agent-employees/{agentEmployeeId}/run` | Manually trigger a run, outside its schedule |

## Frontend

`apps/web/src/pages/AdminPage.tsx` — tabbed (Tenants / Users / Agent Employees), all client-side tab state, no separate routes per tab.

## Agent employee console — what's V1 vs V2

V1 ships the minimum to demo the AI workforce concept: view configured employees and manually trigger a run. There is no config-editing UI, no schedule editor, and no per-tenant override UI yet — `AgentEmployee.schedule`/`.config` are set directly in the database (seed script sets `schedule: 'on_change'`, `config: {}`). The full console (FR-25 in `docs/system-requirements.md`) — enable/disable, edit prompt/config, view run history, per-tenant overrides — is V2, per `docs/roadmap.md`.

## Agent employee kinds

See `apps/server/src/services/AdminService.ts` for the `runAgentEmployee` dispatch logic — one report-generation function per `AgentEmployeeKind` (`SUMMARIZER`, `QA`, `PM`, `CODE_REVIEW`, `STEERING`). All of them read recent `WorkSession`/`Note` data for the employee's tenant and write one `AgentReport`; `STEERING` additionally creates a `Goal` row. None of them call a real LLM yet — the report bodies are generated from simple aggregation/heuristics over the work-log data, which keeps the interface (and the admin "Run now" button, and the Reports feed) stable for a real model call to replace later without changing the API contract.
