// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('listGoals', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/goals' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /goals', async () => {
    await db.goal.create({
      data: { tenantId: testTenantId, title: 'Ship the thing', description: 'Because reasons', status: 'PROPOSED' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/goals',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listGoals', 200, res.json())
    expect(res.json().data.length).toBe(1)
    expect(res.json().data[0].loggedSec).toBe(0)
  })

  it('filters by projectId', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const other = await db.project.create({ data: { tenantId: testTenantId, name: 'Mobile App' } })
    await db.goal.create({ data: { tenantId: testTenantId, projectId: project.id, title: 'Ship redesign', description: 'd', status: 'ACTIVE' } })
    await db.goal.create({ data: { tenantId: testTenantId, projectId: other.id, title: 'Ship mobile', description: 'd', status: 'ACTIVE' } })

    const res = await app.inject({
      method: 'GET',
      url: `/goals?projectId=${project.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.length).toBe(1)
    expect(res.json().data[0].title).toBe('Ship redesign')
  })

  it('reflects logged time from STOPPED sessions tagged with the goal', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, projectId: project.id, title: 'Ship redesign', description: 'd', status: 'ACTIVE' },
    })
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        goalId: goal.id,
        status: 'STOPPED',
        activeDurationSec: 1800,
      },
    })
    // A RUNNING session tagged with the same goal shouldn't count yet.
    await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', projectId: project.id, goalId: goal.id, status: 'RUNNING', activeDurationSec: 0 },
    })

    const res = await app.inject({ method: 'GET', url: '/goals', headers: asAuth(testUserId) })
    expect(res.json().data[0].loggedSec).toBe(1800)
  })
})

describe('createGoal', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/goals', payload: { title: 'x', description: 'y' } })
    expect(res.statusCode).toBe(401)
  })

  it('creates a goal that starts ACTIVE (no approval gate for human-authored goals)', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: asAuth(testUserId),
      payload: {
        title: 'Ship v2',
        description: 'Get the redesign out the door',
        projectId: project.id,
        complexityScore: 4,
        estimatedHours: 12,
      },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createGoal', 201, res.json())
    const goal = res.json().data
    expect(goal.status).toBe('ACTIVE')
    expect(goal.projectId).toBe(project.id)
    expect(goal.complexityScore).toBe(4)
    expect(goal.estimatedHours).toBe(12)
    expect(goal.createdByUserId).toBe(testUserId)
  })

  it('defaults complexityScore to 3 when omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: asAuth(testUserId),
      payload: { title: 'Ship v2', description: 'd' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.complexityScore).toBe(3)
  })

  it('404s for a project that does not exist in this tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/goals',
      headers: asAuth(testUserId),
      payload: { title: 'Ship v2', description: 'd', projectId: '00000000-0000-0000-0000-000000000099' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('importProjectGoals', () => {
  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects/project-id/goals/import',
      payload: { goals: [{ title: 'Ship', description: 'Done means shipped' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('atomically imports ACTIVE goals scoped to the project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${project.id}/goals/import`,
      headers: asAuth(testUserId),
      payload: {
        goals: [
          { title: 'Ship onboarding', description: 'Deliver the first-run flow', complexityScore: 4, estimatedHours: 12 },
          { title: 'Measure activation', description: '', complexityScore: 2, estimatedHours: null },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    await validateResponse('importProjectGoals', 201, res.json())
    expect(res.json().data.imported).toBe(2)
    const goals = await db.goal.findMany({ where: { projectId: project.id }, orderBy: { title: 'asc' } })
    expect(goals).toHaveLength(2)
    expect(goals.every((goal) => goal.status === 'ACTIVE' && goal.createdByUserId === testUserId)).toBe(true)
  })

  it('rejects the entire batch when any row is invalid', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${project.id}/goals/import`,
      headers: asAuth(testUserId),
      payload: {
        goals: [
          { title: 'Valid goal', description: 'Would otherwise be created' },
          { title: '', description: 'Invalid title' },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(await db.goal.count({ where: { projectId: project.id } })).toBe(0)
  })

  it('does not import into a project outside the active tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects/not-in-this-tenant/goals/import',
      headers: asAuth(testUserId),
      payload: { goals: [{ title: 'Ship', description: 'Done means shipped' }] },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('updateGoal', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/goals/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('approves a proposed goal', async () => {
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, title: 'Ship the thing', description: 'Because reasons', status: 'PROPOSED' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: asAuth(testUserId),
      payload: { status: 'ACTIVE' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('updateGoal', 200, res.json())
    expect(res.json().data.status).toBe('ACTIVE')
  })

  it('drops a proposed goal', async () => {
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, title: 'Ship the thing', description: 'Because reasons', status: 'PROPOSED' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: asAuth(testUserId),
      payload: { status: 'DROPPED' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('DROPPED')
  })

  it('updates progressPercent, complexityScore, and estimatedHours', async () => {
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, title: 'Ship the thing', description: 'Because reasons', status: 'ACTIVE' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/goals/${goal.id}`,
      headers: asAuth(testUserId),
      payload: { progressPercent: 60, complexityScore: 2, estimatedHours: 8 },
    })
    expect(res.statusCode).toBe(200)
    const updated = res.json().data
    expect(updated.progressPercent).toBe(60)
    expect(updated.complexityScore).toBe(2)
    expect(updated.estimatedHours).toBe(8)
  })

  it('404s for a goal in another tenant', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/goals/00000000-0000-0000-0000-000000000001',
      headers: asAuth(testUserId),
      payload: { status: 'ACTIVE' },
    })
    expect(res.statusCode).toBe(404)
  })
})
