# API Reference

> Generated from `packages/api-spec/openapi.yaml`. Do not edit by hand.

## Auth

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `POST /auth/google` | Sign in or register with Google | Public | `200` |
| `POST /auth/anonymous` | Create an instant guest account (auto-assigned name, personal tenant) -- no request body | Public | `201` |
| `POST /auth/register` | Register with email + password | Public | `201` |
| `POST /auth/login` | Sign in with email + password | Public | `200` |
| `POST /auth/claim` | Add email + password to the current (e.g. anonymous) user in place -- never creates a second account | Auth required | `200` |
| `POST /auth/claim/google` | Link a Google identity to the current (e.g. anonymous) user in place -- never creates a second account | Auth required | `200` |
| `POST /auth/logout` | logout | Auth required | `200` |
| `GET /auth/me` | getCurrentUser | Auth required | `200` |
| `PATCH /auth/me` | Update the current user's display name | Auth required | `200` |

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

## Users

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /users` | Search members of the active tenant for team management | Auth required | `200` |
| `GET /users/{userId}` | getUser | Auth required | `200` |

## Projects

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /projects` | listProjects | Auth required | `200` |
| `POST /projects` | createProject | Auth required | `201` |
| `GET /projects/{projectId}` | getProject | Auth required | `200` |
| `PATCH /projects/{projectId}` | updateProject | Auth required | `200` |
| `GET /projects/{projectId}/feed` | Chronological project activity feed (human notes, GitHub events, AI updates) | Auth required | `200` |
| `GET /projects/{projectId}/updates/{updateId}` | Fetch one persisted AI project update with evidence metadata | Auth required | `200` |

## WorkSessions

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /work-sessions/active` | The current user's active (non-STOPPED) sessions in the active tenant -- a list, since a user can run one concurrent session per project | Auth required | `200` |
| `POST /work-sessions/start` | startWorkSession | Auth required | `201` |
| `GET /work-sessions/{workSessionId}` | getWorkSession | Auth required | `200` |
| `PATCH /work-sessions/{workSessionId}` | Correct a session's duration, project, or goal; stopped-session corrections recompute gem ledgers | Auth required | `200` |
| `DELETE /work-sessions/{workSessionId}` | Delete a stopped session (owner or tenant admin); recomputes the gem ledger | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/pause` | pauseWorkSession | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/resume` | resumeWorkSession | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/review` | Authoritatively stop timing and move the active session into review | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/stop` | Finish a session that is awaiting review; optionally attach a final note | Auth required | `200` |
| `GET /work-sessions` | Paginated session history, for Views (daily/monthly/yearly) and drill-down | Auth required | `200` |

## Notes

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /work-sessions/{workSessionId}/notes` | listNotes | Auth required | `200` |
| `POST /work-sessions/{workSessionId}/notes` | Add an update note while running/paused | Auth required | `201` |
| `PATCH /notes/{noteId}` | Correct a saved note as the session owner or a tenant session manager | Auth required | `200` |

## Reports

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /reports/time-summary` | Daily/monthly/yearly time-by-project rollup, individual or team scope | Auth required | `200` |

## Gems

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /gem-balances` | Current user's Gem Bank — totals and carry progress by project | Auth required | `200` |

## AgentReports

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /agent-reports` | In-app feed of agent-generated reports for the active tenant | Auth required | `200` |
| `GET /agent-reports/{agentReportId}` | getAgentReport | Auth required | `200` |

## Goals

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /goals` | Goals for the active tenant, any status | Auth required | `200` |
| `POST /goals` | Author a goal directly for project planning (starts ACTIVE, no approval gate) | Auth required | `201` |
| `PATCH /goals/{goalId}` | Approve/drop/complete a proposed goal, or edit any goal's planning fields | Auth required | `200` |
| `POST /projects/{projectId}/goals/import` | Atomically import ACTIVE goals into one project | Auth required | `201` |

## TextAssist

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `POST /text-assist` | createTextAssist | Auth required | `200` |

## Admin

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /admin/tenants` | adminListTenants | Auth required | `200` |
| `PATCH /admin/tenants/{tenantId}` | adminUpdateTenant | Auth required | `200` |
| `GET /admin/users` | adminListUsers | Auth required | `200` |
| `PATCH /admin/users/{userId}` | adminUpdateUser | Auth required | `200` |
| `GET /admin/agent-employees` | View configured agent employees (Summarizer in V1). Config editing is V2. | Auth required | `200` |
| `POST /admin/agent-employees/{agentEmployeeId}/run` | Manually trigger a run now, outside its schedule | Auth required | `201` |

## Github

| Endpoint | Description | Auth | Success |
|---|---|---|---|
| `GET /integrations/github/installations` | List registered GitHub installations for the current tenant | Auth required | `200` |
| `POST /integrations/github/installations` | Register a new GitHub installation or update/reuse an existing one | Auth required | `201` |
| `DELETE /integrations/github/installations/{installationId}` | Disconnect a GitHub installation | Auth required | `204` |
| `GET /integrations/github/installations/{installationId}/repositories` | List repositories authorized for an installation | Auth required | `200` |
| `GET /projects/{projectId}/github/bindings` | List GitHub repository bindings for a project | Auth required | `200` |
| `POST /projects/{projectId}/github/bindings` | Bind a GitHub repository to a project | Auth required | `201` |
| `DELETE /projects/{projectId}/github/bindings/{bindingId}` | Unbind a GitHub repository from a project | Auth required | `204` |
| `POST /webhooks/github` | Receive GitHub webhook payloads | Public | `200` |
