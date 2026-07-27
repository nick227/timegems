# TimeGems — Web

The frontend for TimeGems, a single-focus work tracker: start a session against a project, earn TimeGems for hours worked, see teammates' live presence, keep running notes, and read automated agent-generated summaries/reviews of team activity.

Vite + React + TypeScript, talking to the Fastify API in `apps/server` through the typed client in `packages/sdk`.

## Getting started

From the repo root:

```bash
pnpm bootstrap   # installs deps, generates the SDK/pages from the OpenAPI spec, runs migrations + seed
pnpm dev         # starts server + web together
```

Or just this package, once the workspace is bootstrapped:

```bash
pnpm --filter web dev
```

`pnpm db:seed` (run from the repo root) prints a dev token you can use to skip real Google login. Real login requires `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` in `.env`.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | `tsc` then production build |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (flat config, includes the architecture-boundary rules below) |
| `pnpm test:e2e` | Playwright, against a running dev server (see `e2e/global-setup.ts`) |

## Architecture

Business logic lives in `src/features/*` — one folder per domain (`work-sessions`, `projects`, `teams`, `gems`, `goals`, `reports`, `presence`, `agent-employees`, `integrations`, `views`, `admin`, `account`, `auth`, and a few more). Each feature's `index.ts` is its only public boundary: routes and other features import through it, never by reaching into a feature's internal files directly.

`src/components/ui/` holds proven-reusable primitives only (`Button`, `Card`, `Input`, `Dialog`, `PageHeader`, the `SmartTextEditor` rich-text input, etc.) — no feature-specific logic. This split is enforced by `eslint-plugin-boundaries` (see `eslint.config.js`), not just convention: shared-ui can never import a feature, and a feature importing a different feature must go through that feature's `index.ts`.

`src/App.tsx` and `src/components/layout/Shell.tsx` are the composition root and are deliberately left out of the boundary rules — they're expected to wire features together.

## Testing

- Unit/component coverage lives alongside the code it tests.
- `e2e/*.spec.ts` (Playwright) drives real user flows against a live dev server and the real API, using a seeded fixture identity (`packages/db/prisma/seed-e2e.ts` + `e2e/global-setup.ts`) rather than mocks. `e2e/a11y.spec.ts` runs axe-core against the rendered DOM for the main screens.

## Notes

- `apps/web/src/pages/` is generated scaffolding from `pnpm pages:generate` (part of `bootstrap`) and is not used — `App.tsx` imports exclusively from `src/features/*`. If a `pages/` directory reappears after a bootstrap run, it's safe to delete.
- See the repo root `CLAUDE.md` for full product scope, phase history, and design decisions.
