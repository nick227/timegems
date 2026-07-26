import { db } from '../src/client'
import { randomUUID } from 'crypto'

// Dev convenience only: creates a user + session directly (bypassing real
// Google verification) so a developer can explore the app before Google
// OAuth credentials are configured. Prints the session token to paste into
// devtools as a `token` cookie at http://localhost:5173.
async function main() {
  console.log('Seeding...')

  const alice = await db.user.upsert({
    where: { googleId: 'seed-google-id-alice' },
    update: {},
    create: { googleId: 'seed-google-id-alice', email: 'alice@example.com', name: 'Alice' },
  })

  const tenant = await db.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme', slug: 'acme' },
  })

  await db.membership.upsert({
    where: { userId_tenantId: { userId: alice.id, tenantId: tenant.id } },
    update: {},
    create: { userId: alice.id, tenantId: tenant.id, role: 'OWNER' },
  })

  await db.adminUser.upsert({
    where: { userId: alice.id },
    update: {},
    create: { userId: alice.id, role: 'SUPERADMIN' },
  })

  const project = await db.project.upsert({
    where: { id: 'seed-project-website' },
    update: {},
    create: { id: 'seed-project-website', tenantId: tenant.id, name: 'Website Redesign', color: '#6366f1' },
  })

  const agentEmployees: { id: string; kind: 'SUMMARIZER' | 'QA' | 'PM' | 'CODE_REVIEW' | 'STEERING'; name: string }[] = [
    { id: 'seed-agent-summarizer', kind: 'SUMMARIZER', name: 'Summarizer' },
    { id: 'seed-agent-qa', kind: 'QA', name: 'QA' },
    { id: 'seed-agent-pm', kind: 'PM', name: 'PM' },
    { id: 'seed-agent-code-review', kind: 'CODE_REVIEW', name: 'Code Review' },
    { id: 'seed-agent-steering', kind: 'STEERING', name: 'Steering' },
  ]
  for (const employee of agentEmployees) {
    await db.agentEmployee.upsert({
      where: { id: employee.id },
      update: {},
      create: { ...employee, tenantId: tenant.id, schedule: 'on_change' },
    })
  }

  const token = randomUUID()
  await db.session.create({
    data: {
      userId: alice.id,
      token,
      activeTenantId: tenant.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  console.log(`✓ User: ${alice.email} (tenant: ${tenant.name}, project: ${project.name})`)
  console.log(`✓ Dev session token (set as a 'token' cookie on localhost to skip Google login):`)
  console.log(`  ${token}`)
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
