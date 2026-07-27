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

  it('returns an empty list when nothing is running', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/work-sessions/active',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getActiveWorkSession', 200, res.json())
    expect(res.json().data).toEqual([])
  })

  it('lists multiple concurrent sessions, one per project', async () => {
    const projectA = await db.project.create({ data: { tenantId: testTenantId, name: 'Project A' } })
    const projectB = await db.project.create({ data: { tenantId: testTenantId, name: 'Project B' } })
    await app.inject({ method: 'POST', url: '/work-sessions/start', headers: asAuth(testUserId), payload: { projectId: projectA.id } })
    await app.inject({ method: 'POST', url: '/work-sessions/start', headers: asAuth(testUserId), payload: { projectId: projectB.id } })

    const res = await app.inject({ method: 'GET', url: '/work-sessions/active', headers: asAuth(testUserId) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
    expect(res.json().data.every((s: any) => typeof s.name === 'string' && s.name.length > 0)).toBe(true)
    const projectIds = res.json().data.map((s: any) => s.projectId).sort()
    expect(projectIds).toEqual([projectA.id, projectB.id].sort())
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
    expect(await db.userActiveSession.count({ where: { userId: testUserId } })).toBe(1)
  })

  it('409s starting a second unassigned session while one is already active', async () => {
    const active = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'RUNNING' },
    })
    // '__unassigned__' matches WorkSessionService's UNASSIGNED_PROJECT_GUARD
    // sentinel -- a real null here wouldn't collide with it (MySQL treats
    // every NULL in a unique index as distinct), so this wouldn't actually
    // simulate "an unassigned session is already active" without it.
    await db.userActiveSession.create({
      data: { userId: testUserId, projectId: '__unassigned__', workSessionId: active.id },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(409)
  })

  it('does not 409 starting a session on a different project than an already-active one', async () => {
    const projectA = await db.project.create({ data: { tenantId: testTenantId, name: 'Project A' } })
    const projectB = await db.project.create({ data: { tenantId: testTenantId, name: 'Project B' } })
    const first = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: projectA.id },
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: projectB.id },
    })
    expect(second.statusCode).toBe(201)
  })

  it('409s starting a second session on the same project as an already-active one', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Project A' } })
    const first = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: project.id },
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: project.id },
    })
    expect(second.statusCode).toBe(409)
  })

  it('allows exactly one of two concurrent starts to commit', async () => {
    const request = {
      method: 'POST' as const,
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: {},
    }
    const responses = await Promise.all([app.inject(request), app.inject(request)])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409])
    expect(
      await db.workSession.count({
        where: { userId: testUserId, status: { not: 'STOPPED' } },
      }),
    ).toBe(1)
    expect(await db.userActiveSession.count({ where: { userId: testUserId } })).toBe(1)
  })

  it('starts tagged with a goal scoped to the same project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, projectId: project.id, title: 'Ship redesign', description: 'd', status: 'ACTIVE' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: project.id, goalId: goal.id },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.goalId).toBe(goal.id)
  })

  it('409s starting with a goal scoped to a different project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const otherProject = await db.project.create({ data: { tenantId: testTenantId, name: 'Mobile App' } })
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, projectId: otherProject.id, title: 'Ship mobile', description: 'd', status: 'ACTIVE' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { projectId: project.id, goalId: goal.id },
    })
    expect(res.statusCode).toBe(409)
  })

  it('404s starting with a goal from another tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/work-sessions/start',
      headers: asAuth(testUserId),
      payload: { goalId: '00000000-0000-0000-0000-000000000099' },
    })
    expect(res.statusCode).toBe(404)
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
        userId: testUserId, name: 'Test session',
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    await db.userActiveSession.create({
      data: { userId: testUserId, workSessionId: session.id },
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
        userId: testUserId, name: 'Test session',
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
      data: { tenantId: testTenantId, userId: testOtherUserId, name: 'Test session', status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(403)
  })

  it('moves a stopped session to another project and marks it corrected', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'New Project' } })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { projectId: project.id },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.projectId).toBe(project.id)
    expect(res.json().data.correctedAt).not.toBeNull()
  })

  it('correcting duration on a stopped session recomputes the gem ledger', async () => {
    const project = await db.project.create({
      data: { tenantId: testTenantId, name: 'Gem Project', gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } } },
    })
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 1800,
      },
    })
    const { GemService } = await import('../services/GemService')
    await new GemService().recompute(testUserId, project.id)
    let balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(0)

    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { activeDurationSec: 3600 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.gemsAwarded).toBe(1)

    balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(1)
  })

  it('cannot correct duration on a running session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { activeDurationSec: 3600 },
    })
    expect(res.statusCode).toBe(409)
  })

  it('tags a running session with a goal scoped to its current project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, projectId: project.id, title: 'Ship redesign', description: 'd', status: 'ACTIVE' },
    })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', projectId: project.id, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { goalId: goal.id },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.goalId).toBe(goal.id)
  })

  it('409s tagging a goal scoped to a different project than the session', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const otherProject = await db.project.create({ data: { tenantId: testTenantId, name: 'Mobile App' } })
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, projectId: otherProject.id, title: 'Ship mobile', description: 'd', status: 'ACTIVE' },
    })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', projectId: project.id, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { goalId: goal.id },
    })
    expect(res.statusCode).toBe(409)
  })

  it('changes the goal on a stopped session', async () => {
    const goal = await db.goal.create({
      data: { tenantId: testTenantId, title: 'Ship redesign', description: 'd', status: 'ACTIVE' },
    })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { goalId: goal.id },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.goalId).toBe(goal.id)
    expect(res.json().data.correctedAt).not.toBeNull()
  })

  it('allows a session manager to correct another member’s stopped session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testOtherUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
      payload: { activeDurationSec: 900 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.activeDurationSec).toBe(900)
  })

  it('does not let a member correct another user’s stopped session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testOtherUserId),
      payload: { activeDurationSec: 900 },
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
        userId: testUserId, name: 'Test session',
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

  it('allows exactly one of two concurrent pauses to transition', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const request = {
      method: 'POST' as const,
      url: `/work-sessions/${session.id}/pause`,
      headers: asAuth(testUserId),
    }
    const responses = await Promise.all([app.inject(request), app.inject(request)])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409])
    expect(
      await db.workSessionInterval.count({
        where: { workSessionId: session.id, kind: 'PAUSED', endedAt: null },
      }),
    ).toBe(1)
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
        userId: testUserId, name: 'Test session',
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

  it('resumes a session that was awaiting review', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'REVIEWING',
        intervals: { create: [{ kind: 'ACTIVE', endedAt: new Date() }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/resume`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('RUNNING')
    expect(res.json().data.intervals.at(-1).kind).toBe('ACTIVE')
    expect(res.json().data.intervals.at(-1).endedAt).toBeNull()
  })
})

describe('reviewWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/00000000-0000-0000-0000-000000000001/review' })
    expect(res.statusCode).toBe(401)
  })

  it('authoritatively closes timing and remains the active session', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE', startedAt: new Date(Date.now() - 1_000) }] },
      },
    })
    await db.userActiveSession.create({
      data: { userId: testUserId, workSessionId: session.id },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/review`,
      headers: asAuth(testUserId),
    })

    expect(res.statusCode).toBe(200)
    await validateResponse('reviewWorkSession', 200, res.json())
    expect(res.json().data.status).toBe('REVIEWING')
    expect(res.json().data.intervals.every((interval: any) => interval.endedAt !== null)).toBe(true)
    expect(await db.userActiveSession.count({ where: { userId: testUserId } })).toBe(1)

    const active = await app.inject({
      method: 'GET',
      url: '/work-sessions/active',
      headers: asAuth(testUserId),
    })
    expect(active.json().data).toHaveLength(1)
    expect(active.json().data[0].status).toBe('REVIEWING')
  })

  it('enters review from a paused session and closes the pause interval', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'PAUSED',
        intervals: { create: [{ kind: 'ACTIVE', endedAt: new Date() }, { kind: 'PAUSED' }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/review`,
      headers: asAuth(testUserId),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('REVIEWING')
    expect(res.json().data.intervals.every((interval: any) => interval.endedAt !== null)).toBe(true)
  })

  it('allows exactly one of two concurrent review transitions', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const request = {
      method: 'POST' as const,
      url: `/work-sessions/${session.id}/review`,
      headers: asAuth(testUserId),
    }
    const responses = await Promise.all([app.inject(request), app.inject(request)])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409])
    expect((await db.workSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('REVIEWING')
    expect(await db.workSessionInterval.count({ where: { workSessionId: session.id, endedAt: null } })).toBe(0)
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
        userId: testUserId, name: 'Test session',
        status: 'REVIEWING',
        intervals: { create: [{ kind: 'ACTIVE', startedAt: new Date(Date.now() - 1_000), endedAt: new Date() }] },
      },
    })
    await db.userActiveSession.create({
      data: { userId: testUserId, workSessionId: session.id },
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
    expect(await db.userActiveSession.count({ where: { userId: testUserId } })).toBe(0)
  })

  it('409s if already stopped', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(409)
  })

  it('409s if timing has not first entered review', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'RUNNING',
        intervals: { create: [{ kind: 'ACTIVE' }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(409)
    expect((await db.workSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('RUNNING')
  })

  it('allows exactly one of finish or resume to win a race', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'REVIEWING',
        intervals: { create: [{ kind: 'ACTIVE', endedAt: new Date() }] },
      },
    })
    await db.userActiveSession.create({
      data: { userId: testUserId, workSessionId: session.id },
    })

    const [finishResponse, resumeResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/work-sessions/${session.id}/stop`,
        headers: asAuth(testUserId),
        payload: {},
      }),
      app.inject({
        method: 'POST',
        url: `/work-sessions/${session.id}/resume`,
        headers: asAuth(testUserId),
      }),
    ])

    expect([finishResponse.statusCode, resumeResponse.statusCode].sort()).toEqual([200, 409])
    const persisted = await db.workSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(['RUNNING', 'STOPPED']).toContain(persisted.status)
    expect(await db.userActiveSession.count({ where: { userId: testUserId } })).toBe(persisted.status === 'RUNNING' ? 1 : 0)
  })

  it('awards a gem once carry-over crosses an hour', async () => {
    const project = await db.project.create({
      data: { tenantId: testTenantId, name: 'Gem Project', gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } } },
    })
    // Pre-existing 50 minutes of carry from an earlier stopped session
    await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 3000,
      },
    })
    const { GemService } = await import('../services/GemService')
    await new GemService().recompute(testUserId, project.id)

    // A fresh 20-minute session should push the total over 3600s -> 1 gem, 10min carry
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'REVIEWING',
        intervals: { create: [{ kind: 'ACTIVE', startedAt: new Date(Date.now() - 1200 * 1000), endedAt: new Date() }] },
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.gemsAwarded).toBe(1)

    const balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(1)
  })

  it('triggers on-change agent employees (fire-and-forget, not awaited by the response)', async () => {
    await db.agentEmployee.create({
      data: { tenantId: testTenantId, kind: 'SUMMARIZER', name: 'Summarizer', schedule: 'on_change' },
    })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'REVIEWING', intervals: { create: [{ kind: 'ACTIVE', endedAt: new Date() }] } },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/stop`,
      headers: asAuth(testUserId),
      payload: {},
    })
    expect(res.statusCode).toBe(200)

    // Fire-and-forget: poll briefly rather than assume it's done by the time
    // the HTTP response returned.
    let report = null
    for (let i = 0; i < 20 && !report; i++) {
      report = await db.agentReport.findFirst({ where: { tenantId: testTenantId, type: 'SUMMARY' } })
      if (!report) await new Promise((r) => setTimeout(r, 50))
    }
    expect(report).not.toBeNull()
  })
})

describe('listWorkSessions', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/work-sessions' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /work-sessions', async () => {
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        status: 'STOPPED',
        stoppedAt: new Date(),
        notes: { create: { authorId: testUserId, body: '<p>Finished the review</p>' } },
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/work-sessions',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listWorkSessions', 200, res.json())
    expect(res.json().data.length).toBe(1)
    expect(res.json().data[0]).toMatchObject({
      id: session.id,
      gemsAwarded: null,
      notes: [{ body: '<p>Finished the review</p>' }],
    })
  })

  it('filters session history by status and uses an exclusive upper boundary', async () => {
    const from = new Date('2026-07-01T05:00:00.000Z')
    const to = new Date('2026-07-02T05:00:00.000Z')
    await db.workSession.createMany({
      data: [
        { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', startedAt: from },
        { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'RUNNING', startedAt: new Date('2026-07-01T12:00:00.000Z') },
        { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', startedAt: to },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: `/work-sessions?status=STOPPED&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      headers: asAuth(testUserId),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(1)
    expect(res.json().data[0].startedAt).toBe(from.toISOString())
  })
})

describe('deleteWorkSession', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/work-sessions/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /work-sessions/{workSessionId}', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('deleteWorkSession', 200, res.json())
    expect(await db.workSession.findUnique({ where: { id: session.id } })).toBeNull()
  })

  it('409s on a session that is still running', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(409)
  })

  it('allows a session manager to delete another member’s stopped session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testOtherUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    expect(await db.workSession.findUnique({ where: { id: session.id } })).toBeNull()
  })

  it('does not let a member delete another user’s stopped session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/work-sessions/${session.id}`,
      headers: asAuth(testOtherUserId),
    })
    expect(res.statusCode).toBe(403)
  })

  it('deleting a session recomputes the gem ledger', async () => {
    const project = await db.project.create({
      data: { tenantId: testTenantId, name: 'Gem Project', gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } } },
    })
    const keep = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', projectId: project.id, status: 'STOPPED', stoppedAt: new Date(), activeDurationSec: 1800 },
    })
    const toDelete = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, name: 'Test session', projectId: project.id, status: 'STOPPED', stoppedAt: new Date(), activeDurationSec: 1800 },
    })
    // Recompute both into the ledger first (as if each had been stopped via the API)
    const { GemService } = await import('../services/GemService')
    const gemService = new GemService()
    await gemService.recompute(testUserId, project.id)

    let balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(1) // 1800 + 1800 = 3600s = 1 gem

    const res = await app.inject({
      method: 'DELETE',
      url: `/work-sessions/${toDelete.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)

    balance = await db.gemBalance.findFirst({ where: { userId: testUserId, projectId: project.id } })
    expect(balance?.totalGems).toBe(0)
    expect(balance?.carrySec).toBe(1800)
    expect(await db.workSession.findUnique({ where: { id: keep.id } })).not.toBeNull()
  })
})
