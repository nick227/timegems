// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testOtherUserId, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('listProjects', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /projects', async () => {
    await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listProjects', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})

describe('createProject', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /projects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: asAuth(testUserId),
      payload: { name: 'Website Redesign' },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createProject', 201, res.json())
    expect(res.json().data.gemType).toBeNull()
  })

  it('POST /projects — with a gem type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: asAuth(testUserId),
      payload: { name: 'Website Redesign', gemType: { name: 'Ruby', icon: 'gem', color: '#f00' } },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createProject', 201, res.json())
    expect(res.json().data.gemType).toMatchObject({ name: 'Ruby', icon: 'gem', color: '#f00' })
  })

  it('forbids ordinary members from creating projects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: asAuth(testOtherUserId),
      payload: { name: 'Unauthorized project' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a team from another tenant without revealing it', async () => {
    const otherTenant = await db.tenant.create({ data: { name: 'Other Co', slug: 'other-co-project-test' } })
    const otherTeam = await db.team.create({ data: { tenantId: otherTenant.id, name: 'Other Team' } })

    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: asAuth(testUserId),
      payload: { name: 'Bad relationship', teamId: otherTeam.id },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Team not found')
  })
})

describe('getProject', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /projects/{projectId}', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getProject', 200, res.json())
  })

  it('404s for a project in another tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/00000000-0000-0000-0000-000000000001',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('updateProject', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/projects/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /projects/{projectId}', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${project.id}`,
      headers: asAuth(testUserId),
      payload: { archived: true },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('updateProject', 200, res.json())
    expect(res.json().data.archivedAt).not.toBeNull()
  })

  it('adding a gem type retroactively awards gems for past sessions', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 3600,
      },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${project.id}`,
      headers: asAuth(testUserId),
      payload: { gemType: { name: 'Ruby', icon: 'gem', color: '#f00' } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.gemType).toMatchObject({ name: 'Ruby' })

    const balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(1)
  })
})
