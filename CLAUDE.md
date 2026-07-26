# Project State

## MVP

**What it does:** A single-focus work tracker where developers hit "Start Work" to log time against a project, add running notes, and get AI-agent-generated summaries/reviews of team activity.

**Users:**
- Member: own work sessions, own projects, team views (read)
- Tenant Admin: team/project management, integrations
- Site Admin: platform administration + agent employee console
- Agent Employee: non-human actor, reads work logs, writes reports

**In V1:**
- Google auth (login/register), tenant + team + project structure
- Start / Pause / Stop core loop with notes, stop-review-save step
- Daily / Monthly / Yearly views (individual + team scope)
- 5 agent employees (Summarizer, QA, PM, Code Review, Steering) posting to an in-app Reports feed — see "V2 pulled forward" below
- Site Admin: platform administration + agent employee run console

**Parking lot (V2+):** Discord/GitHub cross-posting, Google Docs sync, full agent-config editing UI (schedule/prompt editor, per-tenant overrides, run history), Goals workflow UI (Goal rows are created by Steering but there's no dedicated page to browse/manage them yet), billing/plans.

**Stack:** defaults (Vite + React, Fastify, MySQL, Prisma), PNPM workspaces.

**Plugins:** `google-auth` (built directly into Phase 1/2, not deferred — see Deviations).

Full docs: `docs/system-requirements.md`, `docs/data-model.md`, `docs/functional-design.md`, `docs/roadmap.md` (original plan — see this file for what's *actually* built).

## Stack

Default stack. See Deviations below.

## Phase Completed

Phase 6 — Documentation. Plus a V2 item pulled forward: all 5 agent employee kinds (roadmap originally scoped only Summarizer for V1).

## Modules Built

- [x] Auth (Google-only) — Login page, GoogleLoginButton, AuthGuard
- [x] Tenant / Membership — Settings page (org list + switcher)
- [x] Team / TeamMembership — Teams list, Team detail (members add/remove)
- [x] Project — Projects list (search + inline create), Project detail (archive/restore)
- [x] WorkSession / WorkSessionInterval — **the Work screen**: Idle → Running/Paused (live timer, project tagging, notes) → Stop/Review → Save
- [x] Note — inline composer during Running/Paused, stop-review final note
- [x] AgentEmployee / AgentReport — Reports feed (list + detail); **all 5 kinds implemented** (see below), manual admin "Run now" trigger
- [x] Goal — created by the Steering agent (`status: PROPOSED`, linked via `sourceAgentReportId`); no browse/manage UI yet (parking lot)
- [x] Views — daily/monthly/yearly × individual/team time-by-project rollup
- [ ] Integration / GoogleDocLink / DiscordBinding / GithubBinding (V2) — Integrations page is a static status display (Google connected-by-definition, Discord/GitHub "coming in V2"); no backing endpoint yet, intentionally
- [x] AdminUser — Admin page (tabs: tenants, users w/ suspend, agent employees w/ run)

## Agent employees (`apps/server/src/services/AgentEmployeeService.ts`)

All 5 kinds implemented and demoed end-to-end (seed script creates one of each; Admin → Agent Employees → "Run now" triggers any of them). None call a real LLM yet — each is aggregation/heuristics over `WorkSession`/`Note` rows, chosen to keep the `AgentReport` interface (and the feed, and the admin run button) stable for a real model call to replace later:

- **Summarizer** → `SUMMARY`: session count/time/project count in the last 24h.
- **QA** → `REVIEW`: flags stopped sessions closed with zero notes (documentation-coverage gap).
- **PM** → `PROPOSAL`: time-by-project over the last 7 days, calls out the highest and lowest.
- **Code Review** → `REVIEW`: scans notes for code-related keywords (bug/fix/PR/review/merge/etc.); explicitly states it has no GitHub integration yet, so it can't see real diffs.
- **Steering** → `GOAL`: picks the project with the most time over 7 days, writes a report **and** creates a `Goal` row (`status: PROPOSED`, `sourceAgentReportId` linked back to the report).

Tests: `apps/server/src/__tests__/admin.test.ts` — one case per kind, including the Goal-row assertion for Steering.

## Deviations from Defaults

- Auth is Google-only in V1 — no email/password. `User.googleId` is required + unique (not nullable as in the stock `google-auth` plugin patch, which assumes it's additive to existing password auth). No `/auth/register`, `/auth/login` (password) routes; only `/auth/google`, `/auth/logout`, `/auth/me`. Login.tsx doubles as register (first Google sign-in creates the account).
- Multi-tenant from the start: every domain model except `User`/`AdminUser` carries `tenantId`.
- No persistent sidebar/bottom-nav (`Shell.tsx` deviates from the stock template) — full-screen single-focus design per the product brief. Hamburger button is `fixed`; `<main>` has `pt-14` so page content clears it (pages own their own `min-h-screen`, `main` does not, to avoid double-min-height scroll).
- `pnpm pages:generate`'s naive per-operation routing (every POST → create-form, every PATCH → edit-form) doesn't fit an action-heavy API. Generated stubs for list/detail-shaped resources (Projects, Teams, AgentReports, Admin lists) were kept and filled in; stubs for action endpoints (start/pause/resume/stop/select/run/googleAuth/createNote) were deleted and replaced by the hand-authored `WorkPage.tsx` state machine + inline actions on other pages. `App.tsx` is hand-written, not generated, for the same reason.
- `vitest.config.ts` sets `fileParallelism: false` — all server test files share one MySQL DB and `afterEach` wipes every table; parallel files race otherwise.
- `.redocly.yaml` turns off `operation-summary` and `info-license` (cosmetic); `operation-4xx-response` is left ON — it's load-bearing: openapi-fetch's generated `error`/`response` typing breaks (collapses to `never`) for operations with no documented non-2xx response, so every op has an explicit `401`/`400`/`409` etc.
- `AgentEmployee.config` has `@default("{}")` — no config-editing UI yet (parking lot).
- **`pages:generate` / `bootstrap` re-run caveat:** recreates any page file that doesn't exist, including the ~24 action-form stubs we deliberately deleted (they don't fit our hand-written hooks' signatures — e.g. `useUpdateTeam(teamId)` takes the ID as a hook argument, not a mutate variable — and will fail `tsc` if regenerated). If you ever run `pnpm bootstrap` or `pnpm pages:generate` fresh, delete anything in `apps/web/src/pages/` not imported by `App.tsx` afterward, then re-run `pnpm --filter web typecheck` to confirm.
- Global mutation error toast: `apps/web/src/lib/queryClient.ts` wires `MutationCache.onError` to `toast.error(error.message)` so no mutation fails silently. Individual mutations only add their own `toast.success` for positive confirmation and a `try/catch` where they need to skip follow-up state changes on failure — they should *not* add their own `toast.error`, since the ApiError message from the server (already human-readable) covers it and a second local toast would double up.

## Verified this session

- Full server integration suite: 83 passing, 1 intentionally skipped (`POST /auth/google` needs a real Google ID token — plugin's own documented limitation).
- Browser verification (Playwright, headless, via a directly-seeded session cookie since no real Google account is available in this environment): full Start → tag project → add note → Pause → Resume → Stop → Review → Save loop confirmed correct at the database level; all hamburger-menu routes render without console errors; dark mode and mobile (320px)/desktop (1024px) layouts verified via screenshot; all 5 agent employees run successfully from Admin and produce distinct, correctly-typed reports in the feed.
- `pnpm db:seed` creates a dev user/tenant/project/**5 agent employees** and prints a session token you can set as a `token` cookie on `localhost:5173` to explore the app without configuring real Google OAuth credentials first.
- `docs/` fully populated: the 4 planning docs plus generated (`api-reference.md`, `env-vars.md`, `database.md`) and hand-written (`architecture.md`, `setup.md`, `sdk.md`, `deployment.md`, `admin.md`) developer docs.

## Known follow-ups (not yet done)

- Real Google OAuth credentials still need to be supplied in `.env` (`GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`) for actual login — the dev-seed-token shortcut covers local exploration only.
- No dedicated Goals page (Steering creates `Goal` rows but nothing browses/updates them yet).
- Agent employees run on-demand only (admin "Run now" or the seed script) — no scheduler wired to `AgentEmployee.schedule` yet.
- `pnpm lint` is a no-op for `apps/web` (no eslint config was set up for it, despite eslint being a root devDependency) — not a hidden failure, just unconfigured.
- `npx fallow` flags handler-file "dead code" (false positive — `fastify-openapi-glue` dispatches by `operationId` string, not static import, so nothing statically references the handler exports) and some duplicate cursor-pagination boilerplate across services (accepted — matches the established per-service list-method convention). `WorkPage.tsx`'s flagged complexity was addressed by extracting `WorkIdle`/`WorkReview`/`WorkActive`/`ProjectPicker`/`NoteComposer`/`NoteList` sub-components.

## Last Session Summary

Phases 1–6 complete (full factory build), plus the V2 "additional agent employees" item pulled forward per explicit request. The app is fully runnable end-to-end: `pnpm bootstrap` then `pnpm dev`, use `pnpm db:seed`'s printed token to skip real Google login for local exploration. Next open items are listed above under "Known follow-ups" — pick one, or ask what to build next.
