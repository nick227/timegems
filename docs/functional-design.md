# TimeGems — Functional Design Requirements

Short spec of screens, states, and interaction rules. Companion to `system-requirements.md`.

## Design principle

**Full-screen, single-focus.** Every primary screen shows exactly one thing to do next. All secondary/browsing functionality (project list, team settings, reports archive, integrations, admin) lives behind a hamburger menu — it's never competing with the active work screen.

## Core screen: Work

The app has one dominant screen with three states.

### State: Idle
- Blank screen.
- One button: **Start Work**.

### State: Running
- Confirmation: "Working" + live elapsed time.
- Controls: **Pause**, **Stop**.
- Section reveal: **"What are you working on?"** — grid/list of the user's projects + **New project** action. Selecting a project tags the current session (changeable mid-session).
- Section reveal: **Updates** — always-available note composer; submitted notes append to the session's note timeline with a timestamp. Not required to use it.

### State: Paused
- Same layout as Running, "Working" label swaps to "Paused."
- Project picker and Updates remain visible/editable.
- Controls: **Resume**, **Stop**.
- Paused duration is excluded from tracked time (see NFR-3).

### State: Stop → Review
- On Stop, show a summary screen: total active duration, project, full note timeline for the session.
- One more note field, optional, pre-focused.
- Single **Save** button closes the session and returns to Idle.
- No silent auto-save — Save is an explicit confirm step so the user can correct/add context before it's final.

## Hamburger menu (secondary surfaces)

- **Projects** — list, create, archive.
- **Team** — members, roles (admin only for edits).
- **Views** — Daily / Monthly / Yearly toggle; each with an Individual / Team scope toggle. Table or timeline of time-by-project; notes visible inline or expandable per session.
- **Reports** (agent feed) — chronological list of `AgentReport`s (summaries in V1); filter by type once more agent kinds ship `[V2]`.
- **Goals** `[V2]` — list of proposed/active goals, sourced from steering agent or manually created.
- **Integrations** — Google account status, Discord binding `[V2]`, GitHub binding `[V2]`.
- **Settings** — profile, tenant switcher (if user belongs to >1 tenant), sign out.
- **Admin** (Site Admin only) — separate section, see below.

## Views: Daily / Monthly / Yearly

- Same component, different bucket size and default range (today / this month / this year, navigable back).
- Individual scope: current user's sessions only.
- Team scope: aggregated across team members, grouped by member and/or project.
- No editing from views — read-only rollups; drill into a session to see its notes.

## Admin section (Site Admin only)

Two distinct areas, both behind the hamburger → Admin:

1. **Platform administration** (standard): tenants, users, suspend/support-impersonate, plan limits `[V2]`.
2. **Agent employee console** (business management for virtual team members):
   - List of configured `AgentEmployee` rows (Summarizer in V1; QA/PM/Code Review/Steering `[V2]`).
   - Per-agent: enabled toggle, schedule/trigger, prompt/config editor, run history, manual "run now," per-tenant override.
   - This is explicitly framed as managing team members, not just toggling features — it's the interface for directing what the AI workers do.

## Interaction rules

- No competing primary actions on one screen — if a screen needs a second decision point, it's a sub-step (like Stop → Review), not a second button of equal weight.
- Notes are append-only during a session; no editing/deleting past notes mid-session (reduces "what really happened" ambiguity for agent summarization).
- Only one active session at a time — starting work with an existing running/paused session elsewhere should resume that session's state, not silently start a second one.
- Agent Reports are read-only to end users in V1 (no reactions/comments) — keep the feed simple until there's a reason to add interaction.

## Assumptions

- Mobile web must support the full core loop (Idle/Running/Paused/Stop) at minimum; Views and Admin are desktop-first.
- Tenant switching (for users in multiple orgs) lives in Settings, not on the main Work screen — the Work screen should never ask the user to make an unrelated decision.
