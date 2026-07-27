# TimeGems — Data Model

## Entity overview

- **Tenant** is the isolation boundary. Everything else (except `User` and `AdminUser`) hangs off a `tenantId`.
- **User** is global (Google identity and/or email+password); joins tenants via **Membership**. A guest (`isAnonymous: true`, auto-provisioned, no credential) resolves into a durable identity one of two ways: **claim**, an in-place upgrade of the same row (add a credential, flip `isAnonymous` false, same id, nothing to transfer), or **merge**, authenticating as a *different*, already-existing `User` row — the guest's owned rows are reassigned to that account and the guest row is retired (`deletedAt`, never hard-deleted). **GuestMerge** is the one-row-per-merge audit trail this leaves behind; see `GuestMergeService`'s docstring for the full per-model collision policy.
- **WorkSession** is the core product artifact: one row per start→finish cycle, `status` tracks running/paused/reviewing/stopped.
- **UserActiveSession** is a coordination row keyed by `userId` that makes the single-active-session invariant safe under concurrent requests on MySQL.
- **WorkSessionInterval** exists because "time spent" must be exact — it's the append-only log of active/paused boundaries that a `WorkSession`'s duration is computed from, not a trusted client-side stopwatch.
- **Note** covers both live "updates" (posted while running/paused) and the final stop-note; `isStopSummary` distinguishes the latter.
- **AgentEmployee** + **AgentReport** model the AI workers: employee = configured role (Summarizer, QA, PM, Code Review, Steering), report = one produced artifact, scoped to tenant/team/project.
- **Integration** rows are per-tenant connection state; **GoogleDocLink**, **DiscordBinding**, **GithubBinding** are integration-specific detail tables rather than one polymorphic blob, since each has different shape.
- **AdminUser** is deliberately separate from `Membership` — site admin is a platform-level capability, not a tenant role.
- **GemType** is one-per-project (name/icon/color/description) chosen at project creation. **GemLedgerEntry** is the source of truth for earnings — exactly one row per finalized `WorkSession`, unique-constrained on `workSessionId` for idempotency, storing `carryInSec`/`carryOutSec`/`gemsAwarded` so the whole ledger for a (user, project) pair can be replayed deterministically from scratch (what correcting or deleting a session does). **GemBalance** is a materialized total (per user/project/gemType) recomputed from the ledger — a cache, never hand-edited, never the source of truth.
- **GemAccount** is the stable per-user/project database lock used to serialize incremental settlement and full replay even when a project does not yet have a gem type.
- **Presence is deliberately not a table.** It's ephemeral, in-memory, per server process (see functional-design.md) — ephemeral state has no business in the durable schema, and the whole point is that losing it costs nothing because `WorkSession` remains authoritative for anything that matters.
- **Goal** is the planning unit underneath the time-tracker surface: optionally scoped to a `Project` (`projectId`), carries `progressPercent` (0-100, manually reported) and `complexityScore` (1-5 relative sizing) for planning/estimation, and an optional `estimatedHours`. It's either agent-authored (Steering; starts `PROPOSED`, needs human approval, `createdByUserId` null) or human-authored (`createGoal`; starts `ACTIVE` directly, no approval gate — nobody needs to approve their own goal). `WorkSession.goalId` is how logged time rolls up to a goal: the API's `loggedSec` is a live `SUM(activeDurationSec)` over that goal's `STOPPED` sessions, not a stored/replicated field, so it can never drift out of sync.
- **GithubWebhookDelivery** is the raw inbound GitHub webhook row, deduplicated by `githubDeliveryId` (the `X-GitHub-Delivery` header). It answers "have we already processed this exact webhook delivery?"
- **ProjectEvent** is the canonical provider-neutral project activity unit used by the unified feed. It carries `source` (`HUMAN` | `GITHUB` | `SYSTEM` | `AI`), a provider-neutral `kind` string, and an `externalId` unique within `(projectId, source)`. For GitHub events that idempotency key is deliberately *not* just a commit SHA; it is derived as `github:{deliveryId}:{event}:{entityId}:{action}` so the same GitHub entity can appear in multiple webhook contexts without colliding.
- **ProjectUpdateJob** is the durable batching/retry layer between raw project activity and generated AI text. Related GitHub push/check/PR events accumulate into one grouped job via a stable `dedupeKey`.
- **ProjectUpdate** is the persisted AI-generated summary artifact. It stores `sourceEventIds`, model metadata, confidence, and evidence/links so a human can audit exactly what the writer had available.

## Relationships (textual ERD)

```
Tenant 1---* Membership *---1 User
Tenant 1---* Team 1---* TeamMembership *---1 User
Tenant 1---* Project *---0..1 Team
User   1---* WorkSession *---0..1 Project
User   1---0..1 UserActiveSession 1---1 WorkSession
WorkSession 1---* WorkSessionInterval
WorkSession 1---* Note
WorkSession *---0..1 Goal
Tenant 1---* AgentEmployee 1---* AgentReport *---0..1 Team/Project
Tenant 1---* Goal *---0..1 AgentReport (source), *---0..1 Project, *---0..1 User (createdBy)
Tenant 1---* Integration
Tenant 1---* GoogleDocLink / DiscordBinding / GithubBinding
Tenant 1---* GithubWebhookDelivery
Tenant 1---* ProjectEvent *---1 Project
Tenant 1---* ProjectUpdateJob *---1 Project
Tenant 1---* ProjectUpdate *---1 Project
User   1---0..1 AdminUser
User (guest) 1---0..1 GuestMerge 0..1---* User (target)
Project 1---0..1 GemType
WorkSession 1---0..1 GemLedgerEntry (unique per session)
User + Project + GemType ---* GemLedgerEntry
User + Project + GemType 1---1 GemBalance (materialized)
User + Project 1---1 GemAccount (serialization only)
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
  email: string?
  name: string
  avatarUrl: string?
  googleId: string?
  passwordHash: string?
  isAnonymous: bool                        # true only for an auto-provisioned guest, until claimed or merged away
  deletedAt: datetime?                      # set when this row is retired by a guest merge (see GuestMerge)
  createdAt: datetime

GuestMerge:
  id: uuid
  guestUserId: uuid                         # unique -- a guest can be merged exactly once, ever
  targetUserId: uuid
  sourceTenantId: uuid?
  finalizedSessionIds: json?                # sessions force-stopped (were still running/paused/reviewing) at merge time
  mergedAt: datetime

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
  goalId: -> Goal?                    # optional planning tag; must match goal.projectId if set
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
  projectId: -> Project?               # planning scope; null = team/tenant-wide
  createdByUserId: -> User?            # null for agent-authored (Steering); set for human-authored
  title: string
  description: text
  status: enum(proposed, active, done, dropped)
  progressPercent: int                 # 0-100, manually reported completeness
  complexityScore: int                 # 1 (trivial) - 5 (very complex)
  estimatedHours: float?
  sourceAgentReportId: -> AgentReport?
  createdAt: datetime
  # loggedSec (API-only, not a column): live SUM(activeDurationSec) over
  # this goal's STOPPED WorkSessions -- see WorkSession.goalId below.

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
  repoId: string
  repoFullName: string
  linkedProjectId: -> Project
  # unique(tenantId, linkedProjectId, repoId) -- many repos per project allowed

GithubWebhookDelivery:
  id: uuid
  githubDeliveryId: string               # unique; raw X-GitHub-Delivery
  event: string
  payload: json
  processed: bool
  error: text?

ProjectEvent:
  id: uuid
  tenantId: -> Tenant
  projectId: -> Project
  source: enum(human, github, system, ai)
  kind: string
  externalId: string                     # github:{deliveryId}:{event}:{entityId}:{action}
  title: string?
  body: text?
  payload: json
  actorUserId: -> User?
  occurredAt: datetime
  # unique(projectId, source, externalId)

ProjectUpdateJob:
  id: uuid
  tenantId: -> Tenant
  projectId: -> Project
  status: enum(pending, processing, completed, failed, dead)
  sourceEventIds: json
  dedupeKey: string                      # unique, used for grouped push/PR/check jobs
  batchKey: string?
  attemptCount: int
  maxAttempts: int
  scheduledAt: datetime
  lockedAt: datetime?
  lockedBy: string?
  lastError: text?

ProjectUpdate:
  id: uuid
  tenantId: -> Tenant
  projectId: -> Project
  body: text
  confidence: float
  modelName: string
  modelVersion: string?
  sourceEventIds: json
  evidence: json
  provenance: enum(ai, human)
  createdAt: datetime

AdminUser:
  id: uuid
  userId: -> User
  role: enum(superadmin, support)

GemType:
  id: uuid
  projectId: -> Project              # unique — one gem type per project
  name: string
  icon: string                       # lucide icon name
  color: string
  description: string?

GemLedgerEntry:
  id: uuid
  tenantId: -> Tenant
  userId: -> User
  projectId: -> Project
  workSessionId: -> WorkSession      # unique — one entry per finalized session
  gemTypeId: -> GemType              # snapshotted at award time
  activeDurationSec: int             # this session's contribution
  carryInSec: int                    # leftover before this session
  carryOutSec: int                   # leftover after (carryIn + duration) % 3600
  gemsAwarded: int                   # floor((carryIn + duration) / 3600)
  createdAt: datetime

GemBalance:
  id: uuid
  userId: -> User
  projectId: -> Project
  gemTypeId: -> GemType
  totalGems: int                     # materialized sum of GemLedgerEntry.gemsAwarded
  updatedAt: datetime
  # unique(userId, projectId, gemTypeId)
```

## Notes / assumptions

- `activeDurationSec` on `WorkSession` is a cached derivation from `WorkSessionInterval` rows, recomputed on stop — avoids trusting client timers (see NFR-3 in system-requirements.md) while keeping reads cheap.
- Views (daily/monthly/yearly) are computed queries over `WorkSession` + `Note`, not stored tables, in V1. Revisit as a materialized rollup if aggregation gets expensive.
- `postedTo` on `AgentReport` is JSON rather than a join table because destinations are heterogeneous and low-cardinality per report; revisit if querying "all reports posted to Discord" becomes common.
- **Why one `GemLedgerEntry` per session instead of a running counter:** a bare running total per (user, project) can't be safely reversed — if session #7 of 20 gets deleted, you can't know how much of the current total came from it without replaying. One entry per session, each snapshotting its own carry-in/carry-out, makes replay (and therefore correction/deletion) a full deterministic recompute rather than fragile incremental math.
- **Why `GemBalance` exists at all if the ledger is authoritative:** reading "does this user have 40 gems on this project" by summing potentially thousands of ledger rows on every Work-screen render doesn't scale. `GemBalance` is a cache maintained by the same recompute that rebuilds the ledger — if it and the ledger ever disagree, the ledger wins and `GemBalance` gets rebuilt, never the reverse.
- **Why guest merge exists as a real operation instead of "claim only":** an earlier design held that account-merging (two `User` rows for one person) would never need to exist, since claiming a guest's own row in place covers "attach a credential to what I've already been doing." That's true only when the guest keeps using the *same* identity. It doesn't cover a guest signing into a *different*, already-existing account — a real and common path (AuthGuard auto-provisions a guest for every unauthenticated visit, including a first-time visit straight to the login page), and one where two identities genuinely can't both stay canonical. `GuestMergeService` is that operation, made safe rather than assumed away: atomic (one transaction, finalize → reassign → resolve membership collisions → recompute gems → audit → retire), idempotent (`GuestMerge.guestUserId` unique + a row lock on the guest during merge), and gem-accounting-correct (rebuilt through the same replay `GemService` already uses for corrections, never hand-copied).
