# TimeGems Production Hardening Plan

## Goal

Preserve the existing modular-monolith architecture while making tenant authorization, work-session state, gem accounting, and agent execution safe under concurrency, restarts, and multiple API instances.

Do not split services into microservices during this work.

---

## Phase 1 — Centralize authenticated tenant context

### Objective

Prevent revoked users from retaining tenant access and establish one trusted authorization context for every tenant-scoped request.

### Changes

Create a request-level authenticated context:

```ts
type AuthContext = {
  userId: string;
  sessionId: string;
  tenantId: string;
  membershipId: string;
  membershipRole: TenantRole;
};
```

Update the authentication plugin to:

1. Resolve the session.
2. Resolve `Session.activeTenantId`.
3. Query the matching active tenant membership.
4. Reject the request when the membership no longer exists.
5. Attach the verified `AuthContext` to the request.

Do not attach `tenantId` directly from the session without membership validation.

Add one central tenant guard:

```ts
request.auth.tenantId
request.auth.membershipRole
```

Remove or deprecate handlers that reconstruct tenant context from request parameters or call `requireTenantId()` independently.

When a membership is removed:

* Clear matching active tenant selections where practical.
* Still rely on request-time membership validation as the authoritative protection.

### Tests

* Revoked membership cannot access any tenant endpoint with an existing session.
* A user can switch only to a tenant where they hold membership.
* Deleted tenants and memberships produce a consistent authorization error.
* Tenant identity cannot be supplied through request bodies or route parameters.

### Deliverable

One PR containing only authenticated tenant-context enforcement and regression tests.

---

## Phase 2 — Add capability-based authorization

### Objective

Make `OWNER`, `ADMIN`, and `MEMBER` meaningful and prevent ordinary members from performing administrative mutations.

### Changes

Define explicit capabilities:

```ts
type Capability =
  | 'tenant:manage'
  | 'team:manage'
  | 'project:manage'
  | 'work-session:correct'
  | 'report:view-team'
  | 'agent:manage';
```

Create a centralized role-to-capability map:

```ts
const ROLE_CAPABILITIES: Record<TenantRole, readonly Capability[]> = {
  OWNER: [...],
  ADMIN: [...],
  MEMBER: [...],
};
```

Add a reusable authorization function:

```ts
requireCapability(authContext, 'project:manage');
```

Apply capability checks at the application boundary before invoking domain services.

Also pass `AuthContext` into services so repository queries remain tenant-scoped and services do not accept untrusted tenant IDs as authority.

Audit at minimum:

* Tenant settings
* Membership management
* Team create/update/delete
* Team membership changes
* Project create/update/delete
* Work-session corrections and deletion
* Team and tenant reports
* Agent employee configuration

### Tests

Create a role matrix test suite that verifies every protected action for:

* Owner
* Admin
* Member
* User from another tenant
* Revoked member

### Deliverable

One PR introducing the capability model and converting all existing protected mutations.

---

## Phase 3 — Introduce Prisma migration history

### Objective

Establish reviewable schema evolution before adding concurrency-control tables and constraints.

### Changes

* Replace production `prisma db push` guidance with Prisma migrations.
* Generate a baseline migration from the current schema.
* Add migration execution to deployment.
* Add a CI check that detects schema changes without a migration.
* Document local migration and rollback procedures.

Do this before introducing new state-control tables.

### Verification

* Empty database can be created entirely from migrations.
* Existing development data can migrate forward.
* CI fails when schema and migration history drift.

---

## Phase 4 — Make work-session transitions transactional

### Objective

Guarantee that start, pause, resume, stop, and delete cannot partially complete or race into invalid state.

### Schema addition

Add a database-backed active-session guard:

```prisma
model UserActiveSession {
  userId        String @id
  workSessionId String @unique
  createdAt     DateTime @default(now())

  user          User        @relation(...)
  workSession   WorkSession @relation(...)
}
```

This row becomes the database-enforced answer to “does this user already have an active session?”

Consider a current interval reference on `WorkSession` or a dedicated current-state table so one open interval is directly lockable rather than inferred from interval history.

### Start transaction

Within one interactive transaction:

1. Lock or atomically claim the user’s active-session row.
2. Fail if one already exists.
3. Create the work session.
4. Create the first open interval.
5. Create `UserActiveSession`.

### Pause transaction

1. Conditionally update the session from `RUNNING` to `PAUSED`.
2. Close the current open interval.
3. Verify exactly one row transitioned.

### Resume transaction

1. Conditionally update `PAUSED` to `RUNNING`.
2. Create one new open interval.
3. Reject duplicate or stale resumes.

### Stop transaction

Within one transaction:

1. Conditionally transition `RUNNING` or `PAUSED` to `STOPPED`.
2. Close any open interval.
3. Persist final timestamps.
4. Create the summary note.
5. Update or enqueue gem accounting.
6. Write agent-trigger outbox records.
7. Remove `UserActiveSession`.

### Delete transaction

Within one transaction:

1. Lock the session.
2. Remove active-session coordination if present.
3. Delete dependent intervals and notes.
4. Recompute or invalidate gem accounting.
5. Persist any required outbox work.

### Concurrency strategy

Use both:

* Database uniqueness for invariant enforcement.
* Conditional updates such as:

```sql
UPDATE WorkSession
SET status = 'PAUSED'
WHERE id = ? AND status = 'RUNNING';
```

Check affected-row counts and return conflict responses for stale requests.

### Tests

Add concurrent integration tests:

* Two simultaneous starts produce one session and one conflict.
* Two pauses cannot create conflicting state.
* Pause and stop racing result in one valid final state.
* Two resumes cannot create multiple open intervals.
* A failed stop transaction leaves no partial summary, ledger, or agent trigger.
* Retried requests return stable conflict or idempotent results.

### Deliverable

Prefer two PRs:

1. Schema and active-session coordination.
2. Transactional transition rewrite and concurrency tests.

---

## Phase 5 — Make gem accounting atomic and incremental

### Objective

Prevent ledger corruption and remove full historical replay from normal stop operations.

### Changes

Split gem updates into two paths.

#### Normal append path

For a newly stopped session:

1. Lock the `(userId, projectId)` gem state.
2. Calculate only the new session’s award.
3. Insert one ledger entry.
4. Increment the materialized balance.
5. Commit everything in one transaction.

#### Replay path

Use full recomputation only for:

* Session corrections
* Session deletion
* Gem-rule changes
* Administrative repair

Within one transaction:

1. Acquire a lock for `(userId, projectId)`.
2. Rebuild ledger entries.
3. Replace or reconcile the materialized balance.
4. Commit atomically.

Add an explicit lock row if necessary:

```prisma
model GemAccount {
  userId    String
  projectId String
  balance   Int

  @@id([userId, projectId])
}
```

Use this row as the serialization point.

### Tests

* Concurrent stopped sessions produce both ledger entries and the correct balance.
* Duplicate session settlement cannot create duplicate awards.
* Replay failure preserves the prior valid ledger and balance.
* Deleting or correcting a session produces deterministic results.
* Balance always equals the sum of authoritative ledger entries.

### Deliverable

One PR for atomic incremental accounting, followed by a smaller replay optimization PR if needed.

---

## Phase 6 — Add durable agent execution

### Objective

Ensure agent work is idempotent, retryable, observable, and safe across restarts and multiple workers.

### Schema

Add `AgentRun`:

```prisma
model AgentRun {
  id                String         @id @default(cuid())
  tenantId          String
  agentEmployeeId   String
  triggerType       AgentTriggerType
  idempotencyKey    String         @unique
  status            AgentRunStatus
  attemptCount      Int            @default(0)
  availableAt       DateTime       @default(now())
  leaseOwner        String?
  leaseExpiresAt    DateTime?
  startedAt         DateTime?
  finishedAt        DateTime?
  errorMessage      String?
  workSessionId     String?
  reportId          String?
  proposedGoalId    String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
}
```

Statuses:

* `PENDING`
* `RUNNING`
* `SUCCEEDED`
* `FAILED`
* `DEAD`

### Idempotency keys

Examples:

```text
scheduled:{agentEmployeeId}:{scheduledWindow}
session:{agentEmployeeId}:{workSessionId}
manual:{requestId}
```

Scheduled, manual, and on-change paths must all create or locate an `AgentRun`; none should directly execute agent business logic.

### Worker

Create one worker process that:

1. Claims available jobs atomically.
2. Assigns a lease owner and expiration.
3. Executes the corresponding handler.
4. Associates reports and proposed goals with the run.
5. Marks success or failure.
6. Retries with bounded backoff.
7. Moves repeatedly failing jobs to `DEAD`.

Use a `Record<AgentType, handler>` dispatch map with compile-time exhaustiveness.

### Scheduler

Change the scheduler from “execute agents” to “enqueue due runs.”

Multiple scheduler instances must be safe because the idempotency key is unique.

### Tests

* Two schedulers enqueue only one run for the same window.
* Manual and scheduled execution do not duplicate the same logical operation.
* Worker crash after claim allows execution after lease expiration.
* Retried runs do not create duplicate reports or goals.
* Failed jobs expose attempts and error details.
* Multiple workers cannot execute the same active lease.

### Deliverable

Use three PRs:

1. `AgentRun` schema and repository.
2. Worker, leasing, and handlers.
3. Scheduler and trigger conversion.

---

## Phase 7 — Add a transactional outbox

### Objective

Guarantee that domain changes and their required background work are committed together.

### Schema

```prisma
model OutboxEvent {
  id            String   @id @default(cuid())
  tenantId      String
  eventType     String
  aggregateType String
  aggregateId   String
  payload       Json
  status        OutboxStatus
  availableAt   DateTime @default(now())
  attempts      Int      @default(0)
  leaseOwner    String?
  leaseExpiresAt DateTime?
  createdAt     DateTime @default(now())
  processedAt   DateTime?
}
```

### Changes

During a successful work-session stop transaction:

* Persist the stopped session.
* Persist gem-related work where asynchronous processing is appropriate.
* Persist agent-trigger outbox events.
* Commit once.

A worker converts outbox events into idempotent `AgentRun` or other job records.

Do not use unawaited promises for required business operations.

### Tests

* A committed stop always has its expected outbox events.
* A rolled-back stop produces no outbox events.
* Reprocessing the same event is safe.
* Worker restart does not lose committed work.

### Deliverable

One infrastructure PR, followed by conversion of each fire-and-forget call site.

---

## Phase 8 — Enforce tenant-safe relationships

### Objective

Make cross-tenant references impossible or consistently rejected.

### Audit

Review every relationship between tenant-owned entities, including:

* Project → Team
* Work session → Project
* Team member → Team/User
* Agent employee → Project/Team
* Report → Project/Team
* Goal → Project/Agent run
* Upload → Tenant/User/Project

### Preferred enforcement

Where practical, use composite tenant-aware references:

```prisma
@@unique([tenantId, id])
```

Then reference both values:

```prisma
tenantId String
teamId   String

team Team @relation(
  fields: [tenantId, teamId],
  references: [tenantId, id]
)
```

Where Prisma or schema complexity makes this impractical, enforce tenant ownership in a shared repository helper inside the same transaction.

Never accept a foreign ID and query it without tenant scope.

### Tests

For every tenant-owned relationship:

* Same-tenant relationship succeeds.
* Cross-tenant relationship fails.
* Error responses do not reveal whether the foreign entity exists.

---

## Phase 9 — Production storage for uploads

### Objective

Replace local public files with tenant-owned object storage.

### Changes

Introduce an `ObjectStore` boundary:

```ts
interface ObjectStore {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  createSignedReadUrl(key: string): Promise<string>;
}
```

Persist upload metadata:

* Tenant
* Owner
* Object key
* Detected media type
* Size
* Original filename
* Created timestamp
* Lifecycle status

Security rules:

* Generate server-side object keys.
* Inspect file signatures instead of trusting declared MIME type.
* Use an explicit allowlist.
* Reject or sanitize SVG.
* Enforce size and tenant quotas.
* Authorize reads.
* Add cleanup for abandoned uploads.

### Deliverable

One storage-boundary PR, then one provider implementation and migration PR.

---

## Phase 10 — Multi-instance presence

### Objective

Support presence across multiple API replicas without making it authoritative.

### Trigger

Do not implement until more than one API replica is planned.

### Changes

* Validate every WebSocket payload with a runtime schema.
* Ignore client claims about authoritative work-session state.
* Tenant-scope all referenced projects.
* Store short-lived presence records in Redis.
* Use Redis pub/sub for cross-instance broadcasts.
* Expire records automatically with TTL.
* Continue treating presence as disposable UI state.

### Tests

* Users connected to different API instances see the same tenant presence.
* Cross-tenant project IDs are rejected.
* Expired connections disappear without explicit cleanup.
* Redis loss does not affect work-session correctness.

---

## Phase 11 — Reporting and time-zone correctness

### Objective

Make reports efficient and align daily boundaries with user expectations.

### Changes

Add an explicit time zone to the user or tenant model.

Define report attribution rules:

* Whether sessions are assigned by start time.
* Whether sessions are assigned by stop time.
* Whether sessions crossing midnight are split.

Prefer splitting interval durations across calendar boundaries for accurate daily reports.

Move aggregation into SQL rather than loading every session into Node.

Add indexes based on actual query shapes, likely including:

```text
(tenantId, startedAt)
(tenantId, status, startedAt)
(projectId, userId, startedAt)
(teamId, startedAt)
```

Introduce daily rollups only after measured query volume justifies them.

---

## Phase 12 — Operational production controls

### Objective

Make failures visible and deployment behavior predictable.

### Changes

* Add `/health/live` for process liveness.
* Add `/health/ready` with database and migration readiness.
* Add graceful shutdown for HTTP, WebSockets, workers, and Prisma.
* Add rate limits for authentication, uploads, and mutations.
* Disable or protect Swagger UI in production.
* Store session tokens as hashes rather than plaintext.
* Add expired-session cleanup.
* Add structured request and audit logging.
* Add metrics for:

  * Active sessions
  * Transition conflicts
  * Agent queue depth
  * Failed and dead jobs
  * Outbox lag
  * Gem replay duration
  * WebSocket connections
* Add centralized error reporting.

---

# Recommended PR sequence

1. Verified tenant context
2. Capability authorization
3. Prisma migration baseline
4. Active-session guard schema
5. Transactional work-session transitions
6. Atomic incremental gem ledger
7. `AgentRun` schema
8. Agent worker and leases
9. Scheduler and trigger conversion
10. Transactional outbox
11. Tenant-safe relationship audit
12. Object-storage boundary
13. Production health, shutdown, and rate limiting
14. Reporting time-zone semantics
15. Redis presence when multi-instance deployment begins

---

# Release gates

## Gate A — Secure single-instance beta

Required:

* Membership revalidation
* Capability enforcement
* Tenant-safe foreign relationships
* Transactional work-session transitions
* Atomic gem accounting
* Migration history

## Gate B — Reliable production single instance

Required:

* Durable `AgentRun`
* Transactional outbox
* Retry and dead-job visibility
* Object storage
* Readiness checks
* Graceful shutdown
* Rate limiting
* Session cleanup and token hashing

## Gate C — Horizontally scalable production

Required:

* Multi-worker job leasing
* Safe multi-instance scheduler
* Redis-backed presence
* Shared object storage
* Cross-instance metrics and tracing

---

# Definition of done

The hardening work is complete when:

* Revoking membership immediately prevents tenant access.
* Every privileged action is capability-checked.
* Concurrent session commands cannot violate state invariants.
* A user cannot hold more than one active session.
* Gem balance always reconciles with the ledger.
* Restarts cannot lose required agent work.
* Duplicate scheduler or worker execution cannot duplicate outputs.
* Cross-tenant entity references are impossible or rejected.
* Schema changes deploy through reviewed migrations.
* Production health distinguishes process liveness from dependency readiness.
* The application can safely run more than one API or worker instance when required.
