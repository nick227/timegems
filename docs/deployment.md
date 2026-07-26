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

Push schema changes before deploying a new server version:

```bash
pnpm db:push   # dev/staging
# or: pnpm --filter @timegems/db exec prisma migrate deploy   # production, once migrations are adopted
```

`packages/db/prisma/schema.prisma` currently uses `db push` (no migration history) — fine for the current stage. Switch to `prisma migrate` before this has real production data you can't just re-push over.

## Multi-tenant note

There is no tenant-level data residency or isolation beyond application-level `tenantId` scoping (every query filters by it explicitly in the service layer — see `docs/architecture.md`). This is sufficient for a single shared database; it is not a substitute for row-level security if that becomes a compliance requirement later.
