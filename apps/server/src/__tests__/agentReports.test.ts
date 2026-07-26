// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

async function seedAgentReport() {
  const employee = await db.agentEmployee.create({
    data: { tenantId: testTenantId, kind: 'SUMMARIZER', name: 'Summarizer', schedule: 'on_change' },
  })
  return db.agentReport.create({
    data: {
      agentEmployeeId: employee.id,
      tenantId: testTenantId,
      type: 'SUMMARY',
      title: 'Daily activity summary',
      body: 'Nothing happened.',
      postedTo: [{ channel: 'feed' }],
    },
  })
}

describe('listAgentReports', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/agent-reports' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /agent-reports', async () => {
    await seedAgentReport()
    const res = await app.inject({
      method: 'GET',
      url: '/agent-reports',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listAgentReports', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})

describe('getAgentReport', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/agent-reports/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /agent-reports/{agentReportId}', async () => {
    const report = await seedAgentReport()
    const res = await app.inject({
      method: 'GET',
      url: `/agent-reports/${report.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getAgentReport', 200, res.json())
  })
})
