// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
// testUserId (alice) is seeded as a SUPERADMIN AdminUser; testOtherUserId (bob) is not.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('adminListTenants', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/tenants' })
    expect(res.statusCode).toBe(401)
  })

  it('forbids a non-admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: asAuth(testOtherUserId),
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET /admin/tenants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('adminListTenants', 200, res.json())
    expect(res.json().data.some((t: any) => t.id === testTenantId)).toBe(true)
  })
})

describe('adminUpdateTenant', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/admin/tenants/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /admin/tenants/{tenantId}', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/tenants/${testTenantId}`,
      headers: asAuth(testUserId),
      payload: { plan: 'TEAM' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('adminUpdateTenant', 200, res.json())
    expect(res.json().data.plan).toBe('TEAM')
  })
})

describe('adminListUsers', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/users' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /admin/users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('adminListUsers', 200, res.json())
    expect(res.json().data.length).toBe(2)
  })
})

describe('adminUpdateUser', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/admin/users/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /admin/users/{userId} — suspends a user', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${testOtherUserId}`,
      headers: asAuth(testUserId),
      payload: { suspended: true },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('adminUpdateUser', 200, res.json())
    expect(res.json().data.suspendedAt).not.toBeNull()
  })
})

describe('adminListAgentEmployees', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/agent-employees' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /admin/agent-employees', async () => {
    await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'SUMMARIZER', name: 'Summarizer', schedule: 'on_change' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/agent-employees',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('adminListAgentEmployees', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})

describe('adminRunAgentEmployee', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/agent-employees/00000000-0000-0000-0000-000000000001/run' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /admin/agent-employees/{agentEmployeeId}/run', async () => {
    const employee = await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'SUMMARIZER', name: 'Summarizer', schedule: 'on_change' },
    })
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 1800,
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/admin/agent-employees/${employee.id}/run`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('adminRunAgentEmployee', 201, res.json())
    expect(res.json().data.type).toBe('SUMMARY')

    const updated = await db.agentEmployee.findUnique({ where: { id: employee.id } })
    expect(updated?.lastRunAt).not.toBeNull()
  })

  it('QA flags sessions closed with no notes', async () => {
    const employee = await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'QA', name: 'QA', schedule: 'on_change' },
    })
    await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/admin/agent-employees/${employee.id}/run`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('adminRunAgentEmployee', 201, res.json())
    expect(res.json().data.type).toBe('REVIEW')
    expect(res.json().data.body).toMatch(/no notes at all/)
  })

  it('PM proposes based on time-by-project over the last week', async () => {
    const employee = await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'PM', name: 'PM', schedule: 'on_change' },
    })
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 3600,
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/admin/agent-employees/${employee.id}/run`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('adminRunAgentEmployee', 201, res.json())
    expect(res.json().data.type).toBe('PROPOSAL')
    expect(res.json().data.body).toMatch(/Website Redesign/)
  })

  it('CODE_REVIEW surfaces notes mentioning code-related keywords', async () => {
    const employee = await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'CODE_REVIEW', name: 'Code Review', schedule: 'on_change' },
    })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    await db.note.create({ data: { workSessionId: session.id, authorId: testUserId, body: 'Fixed the login bug' } })
    const res = await app.inject({
      method: 'POST',
      url: `/admin/agent-employees/${employee.id}/run`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('adminRunAgentEmployee', 201, res.json())
    expect(res.json().data.type).toBe('REVIEW')
    expect(res.json().data.body).toMatch(/Fixed the login bug/)
  })

  it('STEERING proposes a goal and creates a Goal row linked to the report', async () => {
    const employee = await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'STEERING', name: 'Steering', schedule: 'on_change' },
    })
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Mobile App' } })
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 7200,
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/admin/agent-employees/${employee.id}/run`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('adminRunAgentEmployee', 201, res.json())
    expect(res.json().data.type).toBe('GOAL')

    const goal = await db.goal.findFirst({ where: { tenantId: testTenantId } })
    expect(goal?.sourceAgentReportId).toBe(res.json().data.id)
    expect(goal?.status).toBe('PROPOSED')
  })
})
