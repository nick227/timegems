// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'
import { GemService } from '../services/GemService'

const app = buildTestApp()

describe('listGemBalances', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/gem-balances' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /gem-balances', async () => {
    const project = await db.project.create({
      data: { tenantId: testTenantId, name: 'Gem Project', gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } } },
    })
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
      url: '/gem-balances',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listGemBalances', 200, res.json())
    expect(res.json().data).toEqual([
      expect.objectContaining({ projectId: project.id, totalGems: 1, carrySec: 0 }),
    ])
  })

  it('an empty bank returns an empty list, not an error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/gem-balances',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })
})

describe('atomic gem accounting', () => {
  it('serializes concurrent settlement and preserves canonical carry order', async () => {
    const project = await db.project.create({
      data: {
        tenantId: testTenantId,
        name: 'Concurrent Gem Project',
        gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } },
      },
    })
    const first = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        stoppedAt: new Date('2026-01-01T10:50:00.000Z'),
        activeDurationSec: 3000,
      },
    })
    const second = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        startedAt: new Date('2026-01-01T11:00:00.000Z'),
        stoppedAt: new Date('2026-01-01T11:20:00.000Z'),
        activeDurationSec: 1200,
      },
    })
    const service = new GemService()
    const settle = (session: typeof first) =>
      db.$transaction((tx) => service.settleStoppedSession(tx, { ...session, projectId: project.id }), {
        maxWait: 5_000,
        timeout: 30_000,
      })

    await Promise.all([settle(second), settle(first)])

    const entries = await db.gemLedgerEntry.findMany({
      where: { userId: testUserId, projectId: project.id },
      orderBy: [{ workSession: { startedAt: 'asc' } }],
    })
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      workSessionId: first.id,
      carryInSec: 0,
      carryOutSec: 3000,
      gemsAwarded: 0,
    })
    expect(entries[1]).toMatchObject({
      workSessionId: second.id,
      carryInSec: 3000,
      carryOutSec: 600,
      gemsAwarded: 1,
    })
    expect(
      await db.gemBalance.findFirst({
        where: { userId: testUserId, projectId: project.id },
      }),
    ).toMatchObject({ totalGems: 1, carrySec: 600 })
  })

  it('settles the same session idempotently under concurrent retries', async () => {
    const project = await db.project.create({
      data: {
        tenantId: testTenantId,
        name: 'Idempotent Gem Project',
        gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } },
      },
    })
    const session = await db.workSession.create({
      data: {
        tenantId: testTenantId,
        userId: testUserId, name: 'Test session',
        projectId: project.id,
        status: 'STOPPED',
        stoppedAt: new Date(),
        activeDurationSec: 3600,
      },
    })
    const service = new GemService()
    await Promise.all([
      db.$transaction((tx) => service.settleStoppedSession(tx, { ...session, projectId: project.id })),
      db.$transaction((tx) => service.settleStoppedSession(tx, { ...session, projectId: project.id })),
    ])

    expect(await db.gemLedgerEntry.count({ where: { workSessionId: session.id } })).toBe(1)
    expect(
      await db.gemBalance.findFirst({
        where: { userId: testUserId, projectId: project.id },
      }),
    ).toMatchObject({ totalGems: 1, carrySec: 0 })
  })

  it('rolls back a failed replay without exposing partial ledger state', async () => {
    const project = await db.project.create({
      data: {
        tenantId: testTenantId,
        name: 'Replay Rollback Project',
        gemType: { create: { name: 'Ruby', icon: 'gem', color: '#f00' } },
      },
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
    const service = new GemService()
    await service.recompute(testUserId, project.id)

    await expect(
      db.$transaction(async (tx) => {
        await tx.workSession.update({
          where: { id: session.id },
          data: { activeDurationSec: 3600 },
        })
        await service.recomputeInTransaction(tx, testUserId, project.id)
        throw new Error('force rollback')
      }),
    ).rejects.toThrow('force rollback')

    expect((await db.workSession.findUniqueOrThrow({ where: { id: session.id } })).activeDurationSec).toBe(1800)
    expect(
      await db.gemBalance.findFirst({
        where: { userId: testUserId, projectId: project.id },
      }),
    ).toMatchObject({ totalGems: 0, carrySec: 1800 })
    expect(
      await db.gemLedgerEntry.findUnique({
        where: { workSessionId: session.id },
      }),
    ).toMatchObject({ activeDurationSec: 1800, carryOutSec: 1800 })
  })
})
