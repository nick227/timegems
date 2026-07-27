# TimeGems — Functional Design Requirements

Short spec of screens, states, and interaction rules. Companion to `system-requirements.md`.

## Design principle

**Full-screen, single-focus.** Every primary screen shows exactly one thing to do next. Supporting functionality (planning, team activity, agent reports, account settings, and authorized administration) lives behind a grouped hamburger menu — it's never competing with the active work screen.

## Core screen: Work

The app has one dominant screen with three states.

### State: Idle
- Blank screen.
- One button: **Start Work**.

### State: Running
- Confirmation: "Working" + live elapsed time.
- Controls: **Pause**, **Stop**.
- Section reveal: **"What are you working on?"** — grid/list of the user's projects + **New project** action. Selecting a project tags the current session (changeable mid-session).
- Section reveal: **"Working toward a goal?"** — optional; offers the tagged project's own `ACTIVE` goals plus any tenant/team-wide ones (no project scope), or "No goal." Only shown when at least one such goal exists — this is planning-time bookkeeping, not a required step. Time logged this way rolls into that goal's `loggedSec` once the session is stopped.
- Section reveal: **Updates** — always-available note composer; submitted notes append to the session's note timeline with a timestamp. Not required to use it.
- Section reveal: **Gem progress** — live progress toward the next gem for the tagged project (carried-over minutes from prior sessions + elapsed active time this session, out of 60). This is an estimate computed client-side from the same interval data the timer uses; nothing is awarded until Stop.

### State: Paused
- Same layout as Running, "Working" label swaps to "Paused."
- Project picker, Updates, and gem progress remain visible; gem progress freezes (paused time doesn't advance it).
- Controls: **Resume**, **Stop**.
- Paused duration is excluded from tracked time (see NFR-3) and from gem progress.

### State: Stop → Review
- On Stop, the server immediately closes the current interval and moves the session to durable `REVIEWING`; timing has authoritatively stopped before the summary is shown.
- The review survives navigation, refresh, tab close, and another-device recovery through the active-session endpoint.
- Show total active duration, project, full note timeline for the session, **and gems to be earned by this session** (could be 0 if still mid-carry).
- One more note field, optional, pre-focused.
- **Finish session** closes the session, commits the gem ledger entry, and returns to Idle.
- **Resume working** returns the session to `RUNNING` and opens a new active interval.
- No silent auto-save — Finish is an explicit confirmation step so the user can correct/add context before it is final.

## Hamburger menu (secondary surfaces)

- **Projects** — list, create, archive; each project's gem type (name/icon/color/description) is set here. Active projects expose **Start work** in both the list row and detail header, creating a project-tagged session and returning to Work. Project detail accepts a CSV goal batch with `title`, optional `description`, `complexityScore` (1–5), and `estimatedHours`; the complete batch validates before an atomic import.
- **Teams** — members, tenant roles, and live presence. Users with `team:manage` search existing tenant members by name/email, select one or several, and add them without handling raw IDs. Existing team members are excluded from results. External invitations remain out of scope.
- **Activity** — Day / Week / Month selector with previous/next navigation and a Today shortcut; each range has an Individual / Team scope toggle. Show completion summaries, time-by-project, and session history with notes, goals, gems, and correction status.
- **Agent Reports** — chronological list of `AgentReport`s across all 5 agent kinds; filterable by type.
- **Goals** — list of `Goal` rows: agent-proposed (Steering; starts `PROPOSED`, approvable → `ACTIVE` or droppable → `DROPPED` by a human — the required counterpart to any agent "proposing" anything, a proposal with no page to act on it isn't a proposal) or human-authored directly here (starts `ACTIVE`, no approval gate). Each goal can be scoped to a `Project` for planning, carries a `progressPercent` (nudge ±10%, or "Mark done"), a `complexityScore` (1-5 relative sizing), and an optional `estimatedHours` shown against live `loggedSec` (time actually logged by `WorkSession`s tagged with the goal). A project's own detail page also shows a scoped "Goals" planning section with the same create/update affordances.
- **Integrations** — Google account status, Discord binding `[V2]`, GitHub binding `[V2]`; directly addressable but omitted from primary navigation until it offers a meaningful action.
- **Settings** — profile, tenant switcher (if user belongs to >1 tenant), **Gem Bank** (totals by project and gem type), sign out.
- **Admin** (Site Admin only) — omitted from navigation and route-guarded unless the authenticated context includes the server-derived `site:admin` capability.

## Activity: Day / Week / Month

- Same component, different local-time range (today / this week / this month, navigable backward and forward).
- Individual scope: current user's sessions only.
- Team scope: aggregated across team members, grouped by member and/or project.
- Both scopes show **gems earned** alongside time. Team scope shows an aggregate gem count per project — explicitly not a per-member leaderboard; no ranking, no "top earner" framing anywhere in this view.
- Summary rollups stay read-only. A stopped session row exposes deliberate correction and deletion actions only to its owner or a user with the server-derived `session:manage` capability.

## Gem Bank (Settings)

- Grouped by project, then gem type: icon, color, name, total gems, small "X min to next gem" if there's an active carry-over.
- Read-only. No spending/redeeming mechanic in V1 — gems are a progress/recognition unit, not a currency yet.

## Guest accounts: claim vs. merge

Two distinct ways a guest's session resolves into a durable identity — the Settings guest card and the general login page both expose the same underlying choice, just framed differently:

- **Claim** (default framing on the Settings guest card: "Register"): the guest adds a credential (email/password or Google) to their *own* row. Same user id, same history, nothing to transfer — `isAnonymous` just flips to `false`.
- **Merge** (default framing: "Sign in"): the guest authenticates as a *different*, already-existing account. Since the two identities can't both remain canonical, the guest's work sessions (finalizing any still running/paused/awaiting-review first, so nothing looks like it was recording and then vanished), notes, goals, gem history, and tenant/team memberships are transferred to the account signed into, and the guest identity is retired. This happens automatically, server-side, on any login/register/Google-auth call made while the caller's current session is still a guest — there is no separate "confirm the merge" step, because the transfer is guaranteed atomic and nothing is lost. The account's active tenant switches to the guest's former workspace immediately, so the merged content is visible without an extra manual step.
- Sign-in copy should make the outcome legible even though there's no confirmation gate: *"Sign in to keep this guest workspace with your account"* rather than a bare "Sign in" with no context.
- Full collision/idempotency policy lives in code, not here: see `GuestMergeService`'s docstring (apps/server) and the `User`/`GuestMerge` model comments in `schema.prisma`.

## Live presence

- A small presence indicator (colored dot + label: online / working — *Project* / paused / offline) appears next to each teammate wherever teammates are listed (Team page in V1).
- Presence is best-effort and eventually-consistent — a few seconds of lag after a tab closes uncleanly before it flips to offline is expected and fine (see NFR-8, system-requirements.md).
- No presence history or "last seen" log — it's a live-only signal, not a tracking feature.

## Admin section (Site Admin only)

Two distinct areas, both behind the hamburger → Admin:

1. **Platform administration** (standard): tenants, users, suspend/support-impersonate, plan limits `[V2]`.
2. **Agent employee console** (business management for the automation workforce):
   - List of configured `AgentEmployee` rows — all 5 kinds (Summarizer, QA, PM, Code Review, Steering).
   - V1: view + manual "run now" only. Enabled toggle, schedule/prompt editor, run history, and per-tenant override are `[V2]` — the console today is a trigger panel, not full configuration management; don't oversell it as more than that in the UI copy.
   - These are framed as automation workers with clearly heuristic, non-LLM logic today (see NFR-7, system-requirements.md) — copy should not imply intelligence the current implementation doesn't have.

## Session correction & deletion

- A past stopped session in Activity exposes **Edit** and **Delete** to the session owner or a user with `session:manage` (tenant OWNER/ADMIN).
- Edit can correct duration, project, goal, and saved note text. Duration uses an hours:minutes input rather than exposing raw interval boundaries.
- Duration or project changes replay affected gem ledgers atomically; moving projects replays both the old and new project accounts in stable lock order. The UI confirms when gem totals were recalculated.
- Every edit sets `correctedAt`, providing an explicit audit signal instead of guessing from `updatedAt`.
- Deleting a session removes its notes, intervals, and ledger entry, then replays the remaining sessions for the session owner and affected project.

## Presence protocol

- Heartbeat every ~15s over WebSocket while the app is open and the user is authenticated; payload includes status (online/working/paused), current `projectId`, and the active session's `startedAt` if any.
- Server marks a connection stale and broadcasts "offline" if no heartbeat arrives within ~45s (three missed beats) — tolerates one dropped packet without flickering.
- Multiple tabs/devices each hold their own socket; the user reads as present as long as any one of them is alive. Closing one tab doesn't flip the user offline if another tab is still open.
- On reconnect (network blip, laptop sleep/wake), the client re-establishes the socket and immediately re-sends current status — no manual refresh needed.
- Presence is tenant-scoped only: a user sees live status for other members of their *current active tenant*, never across tenants they don't share.
- Live presence and active work are intentionally different signals. Closing the browser removes the user's ephemeral online presence, but it does not pause or finish a persisted work session. Project and Work surfaces derive the current user's "working" state from `WorkSession`, not the WebSocket presence map.
- Credentialed accounts recover their active session after reopening the browser while their authenticated session remains valid. Guest recovery is browser-cookie-bound and therefore best-effort *until the guest authenticates* — claiming upgrades the same account in place, and signing into a different, already-existing account triggers an automatic merge of the guest's activity into it (see "Guest accounts: claim vs. merge" below); either path makes recovery durable, so "claim an account when durable recovery matters" applies equally to signing in, not just registering fresh.

## Interaction rules

- No competing primary actions on one screen — if a screen needs a second decision point, it's a sub-step (like Stop → Review), not a second button of equal weight.
- Notes are append-only during a session; no editing/deleting past notes mid-session (reduces "what really happened" ambiguity for agent summarization).
- Only one active session at a time — starting work with an existing running/paused/reviewing session elsewhere should recover that session's state, not silently start a second one.
- Agent Reports are read-only to end users in V1 (no reactions/comments) — keep the feed simple until there's a reason to add interaction.
- Privileged navigation and actions consume capabilities returned by the server; the frontend never recreates OWNER/ADMIN/MEMBER policy.
- Google sign-in loads on demand and exposes distinct configuration, script-loading, initialization, and authentication failures. Configuration/script failures offer reload or retry; rejected credentials and tenant-access failures remain visible and let the user try sign-in again.
- Authenticated routing distinguishes an expired session (`401`, return to Login while preserving the intended route), unavailable access (`403`), and a temporary session-verification failure (retry in place).
- Resource detail screens distinguish not found (`404`), no access (`403`), and a temporary load failure. Temporary query failures expose an explicit Retry action; list and supporting query surfaces follow the same retry convention.
- Unknown authenticated URLs render a real 404 with a Return to Work action instead of silently redirecting.

## Assumptions

- Mobile web must support the full core loop (Idle/Running/Paused/Stop) at minimum; Activity and Admin are desktop-first.
- Tenant switching (for users in multiple orgs) lives in Settings, not on the main Work screen — the Work screen should never ask the user to make an unrelated decision.
