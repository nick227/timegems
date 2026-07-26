# TimeGems — System Requirements

Terse spec. V1 scope unless marked `[V2]`.

## 1. Purpose

Multi-tenant work tracker for developer teams, built around a single individual action: **start work, log time, leave notes, stop.** Team/yearly/monthly/daily rollups and AI-agent commentary sit on top of that core loop.

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
- FR-7: Stop ends the session, computes total active duration, and shows a summary screen (what we know: duration, project, notes so far) before final save.
- FR-8: While `running` or `paused`, a persistent "what are you working on" project picker is shown: existing projects + "new project."
- FR-9: While `running` or `paused`, a persistent Updates/notes composer is available; notes are timestamped and attach to the active session.
- FR-10: On Stop, user may add a final note before Save; Save is required to close the session.
- FR-11: Only one active (running/paused) session per user at a time.

### 3.3 Projects & Teams
- FR-12: Projects belong to a tenant, optionally to a team, optionally archived.
- FR-13: Teams group users within a tenant for reporting purposes.

### 3.4 Reporting / Views
- FR-14: Daily, monthly, yearly views of time-by-project, individually scoped.
- FR-15: Daily, monthly, yearly views scoped to a team (aggregated across members).
- FR-16: Views are read-only rollups of session + note data; no separate editable model.

### 3.5 AI Agent Employees
- FR-17: 3–5 configurable agent employees, each with a role: Summarizer (V1), QA `[V2]`, PM/Proposal `[V2]`, Code Review `[V2]`, Project Steering/Goals `[V2]`.
- FR-18: Each agent runs on a schedule or on-change trigger, reads recent work logs/notes for its tenant/team/project scope, and produces a report (summary, review, proposal, or goal).
- FR-19: Reports post into an in-app feed by default; optionally to Discord `[V2]` or GitHub (issue/PR comment) `[V2]`.
- FR-20: Agents only summarize/propose — they do not alter work session data or projects.

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

## 5. Out of Scope (V1)

- Billing/plans, Discord/GitHub posting, Google Doc sync, QA/PM/Code Review/Steering agents, goal-setting workflow, team-admin self-serve invites (manual/seeded in V1), mobile app (web-responsive only).
