// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'
import { GemService } from '../services/GemService'

const app = buildTestApp()

describe('getTimeSummary', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/reports/time-summary?period=day&date=2026-01-01&scope=individual' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /reports/time-summary — individual scope', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website Redesign' } })
    const today = new Date().toISOString().slice(0, 10)
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
      method: 'GET',
      url: `/reports/time-summary?period=day&date=${today}&scope=individual`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getTimeSummary', 200, res.json())
    expect(res.json().data.totalDurationSec).toBe(3600)
    expect(res.json().data.totalGemsEarned).toBe(0) // no gem type on this project
  })

  it('includes gems earned when the project has a gem type', async () => {
    const project = await db.project.create({
      data: { tenantId: testTenantId, name: 'Gem Project', gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } } },
    })
    const today = new Date().toISOString().slice(0, 10)
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
    await new GemService().recompute(testUserId, project.id)

    const res = await app.inject({
      method: 'GET',
      url: `/reports/time-summary?period=day&date=${today}&scope=individual`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.totalGemsEarned).toBe(1)
    expect(res.json().data.entries[0].gemsEarned).toBe(1)
  })

  it('uses exact client period boundaries and returns completion metrics', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Local Day Project' } })
    const goal = await db.goal.create({
      data: {
        tenantId: testTenantId,
        projectId: project.id,
        title: 'Ship it',
        description: 'Complete the local-day reporting work',
        status: 'ACTIVE',
      },
    })
    await db.workSession.createMany({
      data: [
        {
          tenantId: testTenantId,
          userId: testUserId, name: 'Test session',
          projectId: project.id,
          goalId: goal.id,
          status: 'STOPPED',
          startedAt: new Date('2026-07-01T04:30:00.000Z'),
          activeDurationSec: 600,
        },
        {
          tenantId: testTenantId,
          userId: testUserId, name: 'Test session',
          projectId: project.id,
          goalId: goal.id,
          status: 'STOPPED',
          startedAt: new Date('2026-07-01T06:00:00.000Z'),
          activeDurationSec: 1200,
        },
      ],
    })

    const from = '2026-07-01T05:00:00.000Z'
    const to = '2026-07-02T05:00:00.000Z'
    const res = await app.inject({
      method: 'GET',
      url: `/reports/time-summary?period=day&date=2026-07-01&scope=individual&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: asAuth(testUserId),
    })

    expect(res.statusCode).toBe(200)
    await validateResponse('getTimeSummary', 200, res.json())
    expect(res.json().data).toMatchObject({
      totalDurationSec: 1200,
      sessionCount: 1,
      projectsWorked: 1,
      goalsAdvanced: 1,
    })
  })

  it('rejects a partial explicit reporting range', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/reports/time-summary?period=day&date=2026-07-01&scope=individual&from=${encodeURIComponent('2026-07-01T05:00:00.000Z')}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(400)
  })
})
