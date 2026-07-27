# Deployment

## Environment variables

See `.env.example` / `docs/env-vars.md` for all required variables. Never commit `.env`. In production, `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` must match the deployed domain in the Google Cloud Console's Authorized JavaScript origins.

## Server

The Fastify server (`apps/server`) is a standard Node.js process.

```bash
pnpm --filter server build
node apps/server/dist/index.js
```

Recommended hosts: Railway, Render, Fly.io. All support Node.js with a Dockerfile or buildpack.

**Dockerfile (server):**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @timegems/db exec prisma generate
RUN pnpm --filter server build
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
```

Set `CORS_ORIGIN` to the deployed frontend's origin, and `NODE_ENV=production` so cookies are set with `Secure` + `SameSite=None` (required for cross-site cookie auth when the web app and API are on different domains).

## Web

The Vite frontend builds to static files.

```bash
VITE_API_URL=https://api.yourapp.com VITE_GOOGLE_CLIENT_ID=... pnpm --filter web build
```

Recommended hosts: Vercel, Netlify, Cloudflare Pages.

## Database

Apply reviewed migrations before deploying a new server version:

```bash
pnpm db:migrate
```

New databases apply the baseline and every later migration automatically.

For a database that was created with `prisma db push` before migration history
was introduced, first compare the live database with the desired schema:

```bash
pnpm exec prisma migrate diff \
  --from-schema-datasource packages/db/prisma/schema.prisma \
  --to-schema-datamodel packages/db/prisma/schema.prisma \
  --exit-code
```

If there is no drift because `db push` already installed the full current
schema, mark each existing migration as applied:

```bash
pnpm exec prisma migrate resolve --schema packages/db/prisma/schema.prisma --applied 20260726000100_baseline
pnpm exec prisma migrate resolve --schema packages/db/prisma/schema.prisma --applied 20260726000200_active_session_guard
pnpm exec prisma migrate resolve --schema packages/db/prisma/schema.prisma --applied 20260726000300_gem_account_lock
pnpm db:migrate:status
```

If the database contains only the pre-hardening schema, mark only the baseline
as applied and let deploy create the newer tables:

```bash
pnpm exec prisma migrate resolve --schema packages/db/prisma/schema.prisma --applied 20260726000100_baseline
pnpm db:migrate
```

The active-session migration intentionally fails if existing data has more
than one `RUNNING`/`PAUSED` session for a user. Repair that invariant before
retrying; the migration never silently chooses which session to preserve.

Use `pnpm db:push` only for disposable local prototyping. Production and shared
environments must use migration history.

## Multi-tenant note

There is no tenant-level data residency or isolation beyond application-level `tenantId` scoping (every query filters by it explicitly in the service layer — see `docs/architecture.md`). This is sufficient for a single shared database; it is not a substitute for row-level security if that becomes a compliance requirement later.
