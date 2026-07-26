# API Reference

> Generated from `packages/api-spec/openapi.yaml`. Do not edit by hand.

## Auth

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `POST /auth/google` | Sign in or register with Google (the only auth method in V1) | Public | `200` |
| `POST /auth/logout` | logout | Auth required | `200` |
| `GET /auth/me` | getCurrentUser | Auth required | `200` |

## Tenants

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /tenants` | Tenants the current user belongs to | Auth required | `200` |
| `POST /tenants` | Create a new tenant; caller becomes OWNER | Auth required | `201` |
| `POST /tenants/{tenantId}/select` | Set the active tenant for the current session | Auth required | `200` |

## Teams

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /teams` | Teams in the active tenant | Auth required | `200` |
| `POST /teams` | createTeam | Auth required | `201` |
| `GET /teams/{teamId}` | getTeam | Auth required | `200` |
| `PATCH /teams/{teamId}` | updateTeam | Auth required | `200` |
| `GET /teams/{teamId}/members` | listTeamMembers | Auth required | `200` |
| `POST /teams/{teamId}/members` | addTeamMember | Auth required | `201` |
| `DELETE /teams/{teamId}/members/{userId}` | removeTeamMember | Auth required | `200` |

## Projects

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /projects` | listProjects | Auth required | `200` |
| `POST /projects` | createProject | Auth required | `201` |
| `GET /projects/{projectId}` | getProject | Auth required | `200` |
| `PATCH /projects/{projectId}` | updateProject | Auth required | `200` |

## WorkSessions

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /work-sessions/active` | The current user's running/paused session in the active tenant, if any | Auth required | `200` |
| `POST /work-sessions/start` | startWorkSession | Auth required | `201` |
| `GET /work-sessions/{workSessionId}` | getWorkSession | Auth required | `200` |
| `PATCH /work-sessions/{workSessionId}` | Change the project tagged to an in-progress session | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/pause` | pauseWorkSession | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/resume` | resumeWorkSession | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/stop` | Stop and close the session; optionally attach a final note | Auth required | `200` |
| `GET /work-sessions` | Paginated session history, for Views (daily/monthly/yearly) and drill-down | Auth required | `200` |

## Notes

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /work-sessions/{workSessionId}/notes` | listNotes | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/notes` | Add an update note while running/paused | Auth required | `201` |

## Reports

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /reports/time-summary` | Daily/monthly/yearly time-by-project rollup, individual or team scope | Auth required | `200` |

## AgentReports

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /agent-reports` | In-app feed of agent-generated reports for the active tenant | Auth required | `200` |
| `GET /agent-reports/{agentReportId}` | getAgentReport | Auth required | `200` |

## Admin

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /admin/tenants` | adminListTenants | Auth required | `200` |
| `PATCH /admin/tenants/{tenantId}` | adminUpdateTenant | Auth required | `200` |
| `GET /admin/users` | adminListUsers | Auth required | `200` |
| `PATCH /admin/users/{userId}` | adminUpdateUser | Auth required | `200` |
| `GET /admin/agent-employees` | View configured agent employees (Summarizer in V1). Config editing is V2. | Auth required | `200` |
| `POST /admin/agent-employees/{agentEmployeeId}/run` | Manually trigger a run now, outside its schedule | Auth required | `201` |
