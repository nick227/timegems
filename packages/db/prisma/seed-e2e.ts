import { db } from '../src/client'
import { randomUUID } from 'crypto'

/**
 * Seeds a dedicated e2e fixture identity for Playwright coverage, separate
 * from `seed.ts`'s alice/acme dev fixtures (namespaced with an `e2e-`
 * prefix throughout so the two never collide or depend on each other).
 * Invoked by apps/web/e2e/global-setup.ts via `tsx` (not imported directly
 * as a module) because apps/web is an ESM package and this package's
 * `main` points at raw TypeScript -- Playwright's own loader doesn't
 * transitively transform a workspace dependency's TS syntax, only its own
 * entry files, so cross-package Prisma access has to go through a child
 * process running under tsx (the same mechanism `db:seed` already uses)
 * rather than a direct `import { db } from '@timegems/db'`.
 *
 * Prints `TOKEN=<value>` as the last line of stdout for the caller to parse.
 */
async function main() {
  const user = await db.user.upsert({
    where: { googleId: 'e2e-google-id' },
    update: {},
    create: { googleId: 'e2e-google-id', email: 'e2e@example.com', name: 'E2E User' },
  })
  const candidate = await db.user.upsert({
    where: { googleId: 'e2e-candidate-google-id' },
    update: {},
    create: { googleId: 'e2e-candidate-google-id', email: 'candidate@example.com', name: 'Casey Candidate' },
  })

  const tenant = await db.tenant.upsert({
    where: { slug: 'e2e-tenant' },
    update: {},
    create: { name: 'E2E Tenant', slug: 'e2e-tenant' },
  })

  await db.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: {},
    create: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
  })
  await db.membership.upsert({
    where: { userId_tenantId: { userId: candidate.id, tenantId: tenant.id } },
    update: { role: 'MEMBER' },
    create: { userId: candidate.id, tenantId: tenant.id, role: 'MEMBER' },
  })

  await db.adminUser.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, role: 'SUPERADMIN' },
  })

  const team = await db.team.upsert({
    where: { id: 'e2e-team' },
    update: {},
    create: { id: 'e2e-team', tenantId: tenant.id, name: 'E2E Team' },
  })

  await db.teamMembership.upsert({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
    update: {},
    create: { teamId: team.id, userId: user.id },
  })
  // The picker test owns adding/removing this candidate. Reset it to the
  // available pool on every suite run so repeated local runs are deterministic.
  await db.teamMembership.deleteMany({ where: { teamId: team.id, userId: candidate.id } })

  const project = await db.project.upsert({
    where: { id: 'e2e-project' },
    update: {},
    create: {
      id: 'e2e-project',
      tenantId: tenant.id,
      teamId: team.id,
      name: 'E2E Project',
      color: '#6366f1',
      gemType: { create: { name: 'Sapphire', icon: '🔷', color: '#3b82f6', description: 'E2E fixture gem type' } },
    },
  })

  const agentEmployee = await db.agentEmployee.upsert({
    where: { id: 'e2e-agent-summarizer' },
    update: {},
    create: { id: 'e2e-agent-summarizer', tenantId: tenant.id, kind: 'SUMMARIZER', name: 'Summarizer', schedule: 'on_change' },
  })

  // Finishing work triggers the on-change summarizer. Remove reports from
  // prior Playwright runs so the fixed route fixture cannot be paginated out
  // of the first feed page after repeated local verification.
  await db.goal.updateMany({
    where: {
      tenantId: tenant.id,
      sourceAgentReportId: { not: null },
      NOT: { sourceAgentReportId: 'e2e-report' },
    },
    data: { sourceAgentReportId: null },
  })
  await db.agentReport.deleteMany({
    where: { tenantId: tenant.id, NOT: { id: 'e2e-report' } },
  })

  const report = await db.agentReport.upsert({
    where: { id: 'e2e-report' },
    update: {},
    create: {
      id: 'e2e-report',
      agentEmployeeId: agentEmployee.id,
      tenantId: tenant.id,
      projectId: project.id,
      type: 'SUMMARY',
      title: 'E2E fixture report',
      body: 'Fixture body for Playwright route coverage.',
      postedTo: [{ channel: 'feed' }],
    },
  })

  await db.goal.upsert({
    where: { id: 'e2e-goal' },
    update: {},
    create: {
      id: 'e2e-goal',
      tenantId: tenant.id,
      title: 'E2E fixture goal',
      description: 'Fixture goal for Playwright route coverage.',
      status: 'PROPOSED',
      sourceAgentReportId: report.id,
    },
  })

  // Repeated test runs shouldn't accumulate one Session row per run.
  await db.session.deleteMany({ where: { userId: user.id } })

  // Nor should a WorkSession left RUNNING/PAUSED/REVIEWING by a prior run (e.g. a test
  // that starts work but doesn't reach Stop) leak into the next run --
  // routes.spec.ts's '/' test expects the idle "Start Work" state. Children
  // deleted first since none of these FKs cascade.
  const staleSessions = await db.workSession.findMany({ where: { userId: { in: [user.id, candidate.id] } }, select: { id: true } })
  const staleSessionIds = staleSessions.map((s) => s.id)
  if (staleSessionIds.length > 0) {
    await db.userActiveSession.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.gemLedgerEntry.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.note.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.workSessionInterval.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.workSession.deleteMany({ where: { id: { in: staleSessionIds } } })
  }
  await db.gemBalance.deleteMany({ where: { userId: { in: [user.id, candidate.id] } } })
  await db.gemAccount.deleteMany({ where: { userId: { in: [user.id, candidate.id] } } })

  const token = randomUUID()
  await db.session.create({
    data: {
      userId: user.id,
      token,
      activeTenantId: tenant.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  console.log(`TOKEN=${token}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
