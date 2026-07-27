import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/**
 * Runs `packages/db/prisma/seed-e2e.ts` via `tsx` (through pnpm, so it
 * inherits the workspace's own DATABASE_URL / node_modules resolution) to
 * seed a dedicated e2e fixture identity, then writes a Playwright
 * storageState with that fixture's session token as a cookie -- the same
 * bypass `apps/server/src/plugins/security.ts`'s bearerAuth already accepts
 * for the dev-seed-token workflow. See seed-e2e.ts for why this runs as a
 * child process rather than importing `@timegems/db` directly.
 */
const AUTH_FILE = 'e2e/.auth/e2e-user.json'

async function globalSetup() {
  // pnpm --filter resolves the workspace root by walking up from cwd, so
  // this works regardless of where `playwright test` was invoked from --
  // no need to hand-compute a repo-root path (which ESM's lack of
  // `__dirname` makes awkward anyway).
  const output = execFileSync('pnpm', ['--filter', '@timegems/db', 'run', 'db:seed:e2e'], {
    encoding: 'utf-8',
  })

  const match = output.match(/^TOKEN=(.+)$/m)
  if (!match) throw new Error(`seed-e2e.ts did not print a token. Output:\n${output}`)
  const token = match[1]

  mkdirSync(dirname(AUTH_FILE), { recursive: true })
  writeFileSync(
    AUTH_FILE,
    JSON.stringify({
      cookies: [
        {
          name: 'token',
          value: token,
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  )
}

export default globalSetup
