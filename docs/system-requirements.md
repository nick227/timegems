# TimeGems — System Requirements

Terse spec. V1 scope unless marked `[V2]`.

## 1. Purpose

Multi-tenant work tracker for developer teams, built around a single individual action: **start work, log time, leave notes, stop.** Two systems make this more than a stopwatch and are first-class in V1, not polish: the **TimeGem economy** (earning a tangible unit of progress per hour worked) and **live project presence** (seeing who's working, right now). Team/yearly/monthly/daily rollups and agent-employee commentary sit on top of that core loop.

## 2. Actors

| Actor | Scope |
|---|---|
| Member | Own work sessions, own projects, team views (read) |
| Tenant Admin | Team/project management, integrations, billing `[V2]` |
| Site Admin | Platform administration + AI agent employee management (business console) |
| Agent Employee | Non-human actor; reads work logs, writes reports, posts to feed/Discord/GitHub |

## 3. Functional Requirements

### 3.1 Auth
- FR-1: Google OAuth login/register is the only auth method in V1.
- FR-2: A user can belong to multiple tenants (organizations); one active tenant context at a time.
- FR-3: Tenant membership carries a role (owner/admin/member).

### 3.2 Core work loop
- FR-4: Landing screen post-login is blank except a single **Start Work** button.
- FR-5: Start Work logs `startedAt`, transitions state to `running`, displays "working" confirmation.
- FR-6: Pause/Resume toggles state between `running` and `paused` without ending the session; paused time is excluded from worked duration.
- FR-7: Stop authoritatively ends timing, enters durable review, and shows a summary screen before final completion.
- FR-8: While `running` or `paused`, a persistent "what are you working on" project picker is shown: existing projects + "new project."
- FR-9: While `running` or `paused`, a persistent Updates/notes composer is available; notes are timestamped and attach to the active session.
- FR-10: In review, the user may add a final note and Finish the session, or Resume working.
- FR-11: Only one active (running/paused/reviewing) session per user at a time.

### 3.3 Projects & Teams
- FR-12: Projects belong to a tenant, optionally to a team, optionally archived.
- FR-12a: An active project can start a project-tagged work session directly from the project list or project detail. If another session is already active, the user returns to that authoritative session rather than silently replacing it.
- FR-12b: A user can atomically import up to 500 ACTIVE goals into a project from CSV. The client validates the complete file before submission; an invalid row imports nothing.
- FR-13: Teams group users within a tenant for reporting purposes.
- FR-13a: Tenant owners/admins can search existing tenant members by name or email, select one or more non-members, and add them to a team. Tenant role and team membership are shown separately; external invitations are not part of V1.

### 3.4 Activity
- FR-14: Day, week, and month activity ranges of time-by-project, individually scoped and interpreted in the viewer's local timezone.
- FR-15: Day, week, and month activity ranges scoped to a team (aggregated across members).
- FR-16: Activity is derived from session + note data; no separate editable model.

### 3.5 TimeGem economy
- FR-26: Each project has one gem type: name, icon, color, optional description. Chosen at project creation, editable later.
- FR-27: A user earns 1 gem per completed active hour worked on a project. Active hour = summed `activeDurationSec` from `WorkSessionInterval`, never wall-clock or paused time.
- FR-28: Partial hours **carry forward**, per (user, project) — never fractional gems, never lost. Leftover minutes from one session count toward the next gem on the next session for that project.
- FR-29: Gem awards are ledger-based: one entry per finalized (`STOPPED`) `WorkSession`, unique per session (idempotent — re-processing a session is a no-op, never a duplicate award).
- FR-30: Correcting or deleting a `WorkSession` recomputes that user+project's gem ledger from scratch, in session order. No manual ledger edits.
- FR-31: The Work screen shows live progress toward the next gem while running/paused (an estimate; not committed until Stop).
- FR-32: The Stop → Review screen previews gems earned by this session before Save.
- FR-33: User profile has a Gem Bank: totals by project and gem type.
- FR-34: Day/week/month Activity shows gems earned alongside time, individual and team scope.
- FR-35: Team/project views may show aggregate gems earned, but must not be framed as a leaderboard or individual performance score — aggregate only, no per-member ranking UI.

### 3.6 Live project presence
- FR-36: Real-time presence over WebSocket: online/working/paused, current project, session start time, last heartbeat.
- FR-37: Presence is ephemeral (in-memory on the server) — the database remains the sole source of truth for actual work sessions. Losing all presence state loses nothing real.
- FR-38: Presence is scoped to the tenant — visible to other members of the same tenant, not cross-tenant.
- FR-39: An authenticated user's active work session remains server-authoritative and active when every TimeGems tab or the browser is closed. Only an explicit pause/review/finish action changes work-session state; disconnecting live presence does not.
- FR-40: Project list and detail surfaces identify the current user's persisted active project and provide a direct return to Work instead of offering a conflicting second start.
- FR-41: Anonymous work-session recovery is best-effort and bound to the guest's browser cookie. Clearing or losing that cookie can make the guest unable to recover otherwise persisted work.
- FR-42: Stale presence expires automatically (heartbeat timeout) — a crashed tab/closed laptop stops showing as online within a bounded time, without a clean disconnect.
- FR-43: Multiple tabs/devices for the same user are tracked as multiple connections to one presence entry; the entry stays "present" as long as at least one connection is alive.
- FR-44: Clients reconnect automatically on drop and resync current state.

### 3.7 Agent Employees
- FR-17: Up to 5 configurable agent employees, each with a role: Summarizer, QA, PM/Proposal, Code Review, Project Steering. **As of this build, all 5 are heuristic/aggregation workers, not AI agents** — no LLM call is wired in yet (see NFR-7). "Employee" is aspirational framing for the product; today they are scheduled/on-demand analysis jobs.
- FR-18: Each agent runs on a schedule (real scheduler, not manual-only) or on-demand trigger, reads recent work logs/notes for its tenant/team/project scope, and produces a report (summary, review, proposal, or goal).
- FR-19: Reports post into an in-app feed by default; optionally to Discord `[V2]` or GitHub (issue/PR comment) `[V2]`.
- FR-20: Agents only *propose* — they never mutate existing `Project`/`WorkSession` data, and any new entity they create (e.g. a Steering-proposed `Goal`) starts in a non-authoritative state (`PROPOSED`) that requires an explicit human action, on a page a human can actually reach, before it means anything. A proposal nobody can see or act on is not a proposal — it's an orphaned mutation with extra steps, so the browsing/approval surface is part of this requirement, not a separate nice-to-have.

### 3.6 Integrations
- FR-21: Google: OAuth login + Google Docs — session/agent reports can sync to a linked Google Doc. `[V2 for doc sync; V1 login only]`
- FR-22: Discord: per-tenant webhook/bot binding to a channel for agent report posting. `[V2]`
- FR-23: GitHub: per-tenant app installation; bind a project to a repo for cross-posting reports/issues. `[V2]`

### 3.7 Admin
- FR-24: Site Admin console: standard user/tenant administration (suspend, impersonate-for-support, plan/limits).
- FR-25: Site Admin console: agent employee management — enable/disable, edit prompt/config, view run history, manual re-run, per-tenant overrides.

## 4. Non-Functional Requirements

- NFR-1: Multi-tenant data isolation enforced at the query layer (tenant_id scoping), not just UI.
- NFR-2: Full-screen, single-focus UI — one primary action per screen; all secondary functionality lives behind a hamburger menu.
- NFR-3: Timer accuracy: session duration derived from server-recorded timestamps, not client clock, to survive tab close/offline.
- NFR-4: Agent reports must be idempotent per run — re-running an agent job must not duplicate posted reports.
- NFR-5: All external integrations (Google, Discord, GitHub) are optional per tenant; app is fully usable with none connected.
- NFR-6: Mobile-usable at minimum for Start/Pause/Stop + notes (core loop), desktop-first for reporting views.
- NFR-7: Agent employees are honestly represented as heuristic/aggregation workers in all user- and developer-facing copy until a real model call is wired in. Code Review and QA are explicitly limited without GitHub/Google Docs access (V2) — they read work-log notes only, and must say so in their own output rather than imply broader visibility.
- NFR-8: Presence data is never treated as authoritative for billing, reporting, or gem awards — those always derive from persisted `WorkSession` rows. Presence answers "who's around right now," nothing else.
- NFR-9: Perceived responsiveness — every user action acknowledges input within 100 ms through immediate local feedback. Under expected V1 load, normal server-backed Start/Pause/Resume/Review mutations complete within 300 ms at the 95th percentile. Reversible actions may update optimistically when rollback is unambiguous; session state and gem awards remain server-authoritative.
- NFR-10: Fast initial use — the authenticated Work surface becomes usable without loading supporting feature bundles or secondary datasets. The initial app shell is visible within 1.5 seconds on normal broadband and within 750 ms on a warm return visit.
- NFR-11: Efficient reads — frequently rendered active-session state, elapsed duration, and gem balances use bounded or indexed queries and materialized values rather than replaying full history. Active timer recovery completes within one second after authentication resolves.

### 4.1 Perceived performance targets

| Interaction | Target |
|---|---|
| Initial app shell visible | Under 1.5 seconds on normal broadband |
| Return visit shell visible | Under 750 ms |
| Start / Pause / Resume / Review response | Under 300 ms typical |
| Local UI acknowledgement | Under 100 ms |
| Navigation between loaded surfaces | Visually immediate |
| Search suggestions | Under 150 ms after debounce |
| Drawer or dialog opening | Next frame |
| Active timer recovery after refresh | Under 1 second after authentication resolves |
| Activity range change | Under 500 ms typical |
| Voice transcription partial result | Appears continuously, not only after completion |

These are product targets measured from the user's interaction to visible feedback. Server latency, bundle size, and query timings are supporting diagnostics rather than substitutes for end-to-end measurement.

## 5. Out of Scope (V1)

- Billing/plans, Discord/GitHub posting, Google Doc sync, agent config-editing UI (schedule/prompt editor, per-tenant overrides, run history), team-admin self-serve invites (manual/seeded in V1), mobile app (web-responsive only), real LLM calls for agent employees.
