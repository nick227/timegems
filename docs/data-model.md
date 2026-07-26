# TimeGems — Data Model

## Entity overview

- **Tenant** is the isolation boundary. Everything else (except `User` and `AdminUser`) hangs off a `tenantId`.
- **User** is global (one Google identity); joins tenants via **Membership**.
- **WorkSession** is the core product artifact: one row per start→stop cycle, `status` tracks running/paused/stopped.
- **WorkSessionInterval** exists because "time spent" must be exact — it's the append-only log of active/paused boundaries that a `WorkSession`'s duration is computed from, not a trusted client-side stopwatch.
- **Note** covers both live "updates" (posted while running/paused) and the final stop-note; `isStopSummary` distinguishes the latter.
- **AgentEmployee** + **AgentReport** model the AI workers: employee = configured role (Summarizer, QA, PM, Code Review, Steering), report = one produced artifact, scoped to tenant/team/project.
- **Integration** rows are per-tenant connection state; **GoogleDocLink**, **DiscordBinding**, **GithubBinding** are integration-specific detail tables rather than one polymorphic blob, since each has different shape.
- **AdminUser** is deliberately separate from `Membership` — site admin is a platform-level capability, not a tenant role.

## Relationships (textual ERD)

```
Tenant 1---* Membership *---1 User
Tenant 1---* Team 1---* TeamMembership *---1 User
Tenant 1---* Project *---0..1 Team
User   1---* WorkSession *---0..1 Project
WorkSession 1---* WorkSessionInterval
WorkSession 1---* Note
Tenant 1---* AgentEmployee 1---* AgentReport *---0..1 Team/Project
Tenant 1---* Goal *---0..1 AgentReport (source)
Tenant 1---* Integration
Tenant 1---* GoogleDocLink / DiscordBinding / GithubBinding
User   1---0..1 AdminUser
```

## YAML sketch

Lightweight entity sketch — precursor to the Prisma schema in Phase 1, not the schema itself.

```yaml
Tenant:
  id: uuid
  name: string
  slug: string
  plan: enum(free, team, enterprise)      # [V2] enforcement
  createdAt: datetime

User:
  id: uuid
  email: string
  name: string
  avatarUrl: string?
  googleId: string
  createdAt: datetime

Membership:
  id: uuid
  userId: -> User
  tenantId: -> Tenant
  role: enum(owner, admin, member)
  createdAt: datetime
  # unique(userId, tenantId)

Team:
  id: uuid
  tenantId: -> Tenant
  name: string

TeamMembership:
  id: uuid
  teamId: -> Team
  userId: -> User
  # unique(teamId, userId)

Project:
  id: uuid
  tenantId: -> Tenant
  teamId: -> Team?
  name: string
  color: string?
  archivedAt: datetime?

WorkSession:
  id: uuid
  tenantId: -> Tenant
  userId: -> User
  projectId: -> Project?
  status: enum(running, paused, stopped)
  startedAt: datetime
  stoppedAt: datetime?
  activeDurationSec: int              # derived/cached from intervals on stop
  # constraint: at most one non-`stopped` WorkSession per userId

WorkSessionInterval:
  id: uuid
  workSessionId: -> WorkSession
  kind: enum(active, paused)
  startedAt: datetime
  endedAt: datetime?                  # null = currently open interval

Note:
  id: uuid
  workSessionId: -> WorkSession
  authorId: -> User
  body: text
  isStopSummary: bool = false
  createdAt: datetime

AgentEmployee:
  id: uuid
  tenantId: -> Tenant
  kind: enum(summarizer, qa, pm, code_review, steering, custom)
  name: string
  enabled: bool = true
  schedule: string                    # cron expr, or "on_change"
  config: json                        # prompt/params per kind

AgentReport:
  id: uuid
  agentEmployeeId: -> AgentEmployee
  tenantId: -> Tenant
  teamId: -> Team?
  projectId: -> Project?
  type: enum(summary, review, proposal, goal)
  title: string
  body: text
  postedTo: json                      # [{channel: feed|discord|github|doc, ref}]
  createdAt: datetime

Goal:
  id: uuid
  tenantId: -> Tenant
  teamId: -> Team?
  title: string
  description: text
  status: enum(proposed, active, done, dropped)
  sourceAgentReportId: -> AgentReport?
  createdAt: datetime

Integration:
  id: uuid
  tenantId: -> Tenant
  kind: enum(google, discord, github)
  status: enum(connected, disconnected, error)
  credentials: json                   # encrypted at rest
  createdAt: datetime

GoogleDocLink:
  id: uuid
  tenantId: -> Tenant
  workSessionId: -> WorkSession?
  projectId: -> Project?
  docId: string
  docUrl: string
  syncedAt: datetime?

DiscordBinding:
  id: uuid
  tenantId: -> Tenant
  guildId: string
  channelId: string
  postTypes: json                     # subset of AgentReport.type

GithubBinding:
  id: uuid
  tenantId: -> Tenant
  installationId: string
  repoFullName: string
  linkedProjectId: -> Project?

AdminUser:
  id: uuid
  userId: -> User
  role: enum(superadmin, support)
```

## Notes / assumptions

- `activeDurationSec` on `WorkSession` is a cached derivation from `WorkSessionInterval` rows, recomputed on stop — avoids trusting client timers (see NFR-3 in system-requirements.md) while keeping reads cheap.
- Views (daily/monthly/yearly) are computed queries over `WorkSession` + `Note`, not stored tables, in V1. Revisit as a materialized rollup if aggregation gets expensive.
- `postedTo` on `AgentReport` is JSON rather than a join table because destinations are heterogeneous and low-cardinality per report; revisit if querying "all reports posted to Discord" becomes common.
