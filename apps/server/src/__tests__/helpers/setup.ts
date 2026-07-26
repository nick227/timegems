import { db } from '@timegems/db'
import { afterEach } from 'vitest'

// clean between tests — order matters for FK constraints (children before parents)
afterEach(async () => {
  await db.goal.deleteMany()
  await db.agentReport.deleteMany()
  await db.agentEmployee.deleteMany()
  await db.googleDocLink.deleteMany()
  await db.discordBinding.deleteMany()
  await db.githubBinding.deleteMany()
  await db.integration.deleteMany()
  await db.note.deleteMany()
  await db.workSessionInterval.deleteMany()
  await db.workSession.deleteMany()
  await db.project.deleteMany()
  await db.teamMembership.deleteMany()
  await db.team.deleteMany()
  await db.membership.deleteMany()
  await db.tenant.deleteMany()
  await db.adminUser.deleteMany()
  await db.session.deleteMany()
  await db.user.deleteMany()
})
