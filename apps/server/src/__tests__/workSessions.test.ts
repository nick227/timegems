// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('getActiveWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/work-sessions/active' })
    expect(res.statusCode).toBe(401)
  })

  it('returns null when nothing is running', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/work-sessions/active',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getActiveWorkSession', 200, res.json())
    expect(res.json().data).toBeNull()
  })
})

describe('startWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/start' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /work-sessions/start', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('startWorkSession', 201, res.json())
    expect(res.json().data.status).toBe('RUNNING')
    expect(res.json().data.project).toBeNull()
  })

  it('409s if a session is already active', async () => {
    await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('getWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/work-sessions/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /work-sessions/{workSessionId}', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getWorkSession', 200, res.json())
    expect(res.json().data.intervals.length).toBe(1)
  })
})

describe('updateWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/work-sessions/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /work-sessions/{workSessionId} — changes the tagged project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'New Project' } })
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { projectId: project.id },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('updateWorkSession', 200, res.json())
    expect(res.json().data.projectId).toBe(project.id)
  })

  it('cannot update another user\'s session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testOtherUserId, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('pauseWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/00000000-0000-0000-0000-000000000001/pause' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /work-sessions/{workSessionId}/pause', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/pause`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('pauseWorkSession', 200, res.json())
    expect(res.json().data.status).toBe('PAUSED')
    expect(res.json().data.intervals.at(-1).kind).toBe('PAUSED')
  })
})

describe('resumeWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/00000000-0000-0000-0000-000000000001/resume' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /work-sessions/{workSessionId}/resume', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'PAUSED',
        intervals: { create: [{ kind: 'ACTIVE', endedAt: new Date() }, { kind: 'PAUSED' }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/resume`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('resumeWorkSession', 200, res.json())
    expect(res.json().data.status).toBe('RUNNING')
    expect(res.json().data.intervals.at(-1).kind).toBe('ACTIVE')
  })
})

describe('stopWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/00000000-0000-0000-0000-000000000001/stop' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /work-sessions/{workSessionId}/stop — with a final note', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId,
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: { note: 'Shipped the thing' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('stopWorkSession', 200, res.json())
    const body = res.json().data
    expect(body.status).toBe('STOPPED')
    expect(body.activeDurationSec).toBeGreaterThanOrEqual(0)
    expect(body.notes.some((n: any) => n.isStopSummary && n.body === 'Shipped the thing')).toBe(true)
  })

  it('409s if already stopped', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('listWorkSessions', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/work-sessions' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /work-sessions', async () => {
    await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/work-sessions',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listWorkSessions', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})
