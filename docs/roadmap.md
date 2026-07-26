# TimeGems — Project Roadmap

Compiled from `system-requirements.md`, `data-model.md`, and `functional-design.md`. Milestones are product scope; each milestone still runs through the standard build phases (Contract → Server → Frontend Shell → Feature Pages → Polish → Docs) per `nick-webapp-factory`.

## V1 — Core Loop MVP

Goal: prove the single-focus work-tracking loop end to end, for one agent employee.

- Google OAuth login/register; tenant + membership model (FR-1–3).
- Core Work screen: Idle → Running → Paused → Stop/Review → Save (FR-4–11).
- Project picker (create/select) surfaced during Running/Paused (FR-8, FR-12).
- Persistent Updates/notes composer + stop-note review step (FR-9–10).
- `WorkSession` + `WorkSessionInterval` + `Note` data model; server-timestamped duration (NFR-3).
- Daily/Monthly/Yearly views, individual scope; team scope if a Team already exists (FR-14–16).
- Basic Team model (manual/seeded membership — no self-serve invites yet).
- One agent employee: **Summarizer**, scheduled/on-change, posting to an in-app Reports feed (FR-17–18, FR-20, feed portion of FR-19).
- Hamburger menu shell: Projects, Team, Views, Reports, Integrations (status-only), Settings.
- Site Admin: basic platform administration (tenants/users) — agent console deferred.

**Exit criteria:** a user can log in, start work, pause/resume, tag a project, leave notes, stop, review, save — and see that session reflected correctly in daily/monthly/yearly views, with at least one Summarizer report generated from real activity.

## V2 — Team & Agent Workforce

Goal: turn on the multi-agent "virtual team" and external integrations.

- Additional agent employees: QA, PM/Proposal, Code Review, Steering/Goals (FR-17).
- `Goal` model + workflow — steering agent proposes goals, users/admins act on them.
- Discord binding: per-tenant channel, agent reports cross-post (FR-19, FR-22).
- GitHub binding: per-tenant app install, project↔repo link, report/issue cross-post (FR-23).
- Google Docs sync: session/report content syncable to a linked Google Doc (FR-21 doc-sync half).
- Site Admin: full **Agent employee console** — enable/disable, schedule, prompt/config editor, run history, manual run, per-tenant overrides (FR-25).
- Self-serve team invites and tenant admin role management.
- Plan/limits groundwork for billing (not billing itself).

**Exit criteria:** all 5 agent kinds configurable and running; at least one tenant has live Discord + GitHub bindings; admin console can fully manage agent behavior without a code deploy.

## V3 — Scale & Polish

Goal: harden for real multi-tenant, multi-team usage.

- Billing/plan enforcement (`Tenant.plan`).
- Materialized rollups for views if on-the-fly aggregation becomes slow (see data-model.md notes).
- Agent report interactions (reactions/comments) if usage shows demand.
- Mobile-optimized full core loop (beyond responsive web).
- Expanded permission granularity beyond owner/admin/member.
- Cross-tenant analytics for Site Admin (usage, agent cost/performance).

## Explicitly deferred / parking lot

- Payments beyond plan gating.
- Non-Google auth (email/password, SSO) — revisit only if demand appears.
- Native mobile app.
- Agent employees beyond the initial 5 kinds.

## Sequencing note

Within V1, build order follows the data model's dependency chain: Tenant/User/Membership → Project/Team → WorkSession/WorkSessionInterval/Note → Views → AgentEmployee/AgentReport. Integrations (`Integration`, `GoogleDocLink`, `DiscordBinding`, `GithubBinding`) are additive tables that don't block core-loop work and should not be started before V1's exit criteria are met.
