// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

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
        userId: testUserId,
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
  })
})
