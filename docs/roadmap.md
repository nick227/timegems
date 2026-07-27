# TimeGems — Project Roadmap

Compiled from `system-requirements.md`, `data-model.md`, and `functional-design.md`. Milestones are product scope; each milestone still runs through the standard build phases (Contract → Server → Frontend Shell → Feature Pages → Polish → Docs) per `nick-webapp-factory`.

> This roadmap was revised after an initial build pass under-scoped V1 — TimeGems (the gem economy) and live presence were treated as polish/V2 when they're actually core to what makes this product distinct from a plain stopwatch. They're V1 here. See `CLAUDE.md` at the project root for the actual chronological build state, which may differ from this document's ordering.

## V1 — Core Loop, Gem Economy, Presence, and Agent Workforce

Goal: prove the single-focus work-tracking loop end to end, with the gem economy and live presence as first-class (not deferred), and all 5 agent employees running as heuristic workers.

- Google OAuth login/register; tenant + membership model (FR-1–3).
- Core Work screen: Idle → Running → Paused → durable Review → Finish or Resume (FR-4–11).
- Project picker (create/select) surfaced during Running/Paused (FR-8, FR-12).
- Persistent Updates/notes composer + stop-note review step (FR-9–10).
- `WorkSession` + `WorkSessionInterval` + `Note` data model; server-timestamped duration (NFR-3).
- **TimeGem economy**: `GemType` per project, ledger-based idempotent awards (`GemLedgerEntry`, `GemBalance`), carry-forward partial hours, live progress on the Work screen, stop-review preview, Gem Bank in Settings, gems in Activity (FR-26–35).
- **Live presence**: WebSocket, ephemeral/tenant-scoped, heartbeat + stale expiry + reconnect + multi-tab, presence indicators on the Team page (FR-36–41).
- Day/Week/Month Activity, individual + team scope, local date boundaries, gems alongside time (FR-14–16, FR-34–35).
- Team management picker for existing tenant members, including name/email search, multi-select add, tenant-role visibility, and no external invitations.
- All 5 agent employees (Summarizer, QA, PM, Code Review, Steering) as heuristic/aggregation workers on a real schedule, posting to an in-app Reports feed (FR-17–20).
- **Goals page**: browse/approve/drop `Goal` rows the Steering agent proposes — required so "agents only propose" is an enforceable rule, not an unreachable one.
- Session correction/deletion (with gem-ledger recompute) for a session's owner or a tenant admin.
- Grouped hamburger menu shell: Work; Plan (Projects, Goals); Team (Teams, Activity); Automation (Agent Reports); Account (Settings); capability-gated Administration.
- Site Admin: platform administration (tenants/users) + agent employee run console (view + manual trigger; full config editor is V2).

**Exit criteria:** a user can log in, start work, watch live gem progress, pause/resume, tag a project, leave notes, stop, review (including gems earned), save — see it reflected in day/week/month Activity with gems, see teammates' live presence on the Team page, see all 5 agent kinds produce distinct reports in the feed, and approve or drop a Steering-proposed goal.

## V2 — External Integrations & Full Agent Console

Goal: give the agent workforce real evidence sources and full self-service configuration.

- Discord binding: per-tenant channel, agent reports cross-post (FR-19, FR-22).
- GitHub binding: per-tenant app install, project↔repo link — this is what actually unblocks meaningful Code Review (real diffs, not just note text) and closes the gap noted in NFR-7 (FR-23).
- Google Docs sync: session/report content syncable to a linked Google Doc (FR-21 doc-sync half) — same rationale for QA (real documents, not just notes).
- Real LLM call replacing the heuristic report bodies for all 5 agent kinds, once the above evidence sources exist to feed it.
- Site Admin: full **Agent employee console** — enable/disable, schedule, prompt/config editor, run history, per-tenant overrides (FR-25).
- Self-serve team invites and tenant admin role management.
- Plan/limits groundwork for billing (not billing itself).
- Gem economy V2 ideas: redeeming/spending gems, gem-type customization beyond icon/color/name (e.g. tiers), cross-project gem totals on a public profile.

**Exit criteria:** all 5 agent kinds have real evidence (GitHub/Docs) where relevant and a real model call producing their report bodies; admin console can fully manage agent behavior without a code deploy; at least one tenant has live Discord + GitHub bindings.

## V3 — Scale & Polish

Goal: harden for real multi-tenant, multi-team usage.

- Billing/plan enforcement (`Tenant.plan`).
- Materialized rollups for views if on-the-fly aggregation becomes slow (see data-model.md notes).
- Presence beyond single-process in-memory (e.g. Redis pub/sub) if multi-instance deployment is needed.
- Agent report interactions (reactions/comments) if usage shows demand.
- Mobile-optimized full core loop (beyond responsive web).
- Expanded permission granularity beyond owner/admin/member.
- Cross-tenant analytics for Site Admin (usage, agent cost/performance).

## Explicitly deferred / parking lot

- Payments beyond plan gating.
- Non-Google auth (email/password, SSO) — revisit only if demand appears.
- Native mobile app.
- Agent employees beyond the initial 5 kinds.
- Gem redemption/spending mechanic.
- Multi-instance presence (Redis-backed) — single-process in-memory is fine until there's more than one server process.

## Sequencing note

Within V1, build order follows the data model's dependency chain: Tenant/User/Membership → Project/Team → WorkSession/WorkSessionInterval/Note → GemType/GemLedgerEntry/GemBalance → Views → AgentEmployee/AgentReport/Goal → Presence (additive, no DB dependency). Integrations (`Integration`, `GoogleDocLink`, `DiscordBinding`, `GithubBinding`) are additive tables that don't block V1 work and should not be started before V1's exit criteria are met.
