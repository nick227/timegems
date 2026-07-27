import { describe, it, expect, vi, afterEach } from 'vitest'
import * as crypto from 'crypto'
import { db } from '@timegems/db'
import { buildTestApp, asAuth, testUserId, testTenantId } from './helpers'
import { GithubService } from '../services/GithubService'
import { ProjectUpdateJobService } from '../services/ProjectUpdateJobService'
import * as presence from '../presence'
import { githubExternalId } from '../services/ProjectEventService'

const app = buildTestApp()
const githubService = new GithubService()
const jobService = new ProjectUpdateJobService()

function sign(payload: object) {
  const raw = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET ?? 'test-webhook-secret')
  hmac.update(raw)
  return { raw, signature: `sha256=${hmac.digest('hex')}` }
}

/**
 * Integration DoD for Agent 1 + Agent 2 reconciliation:
 * one signed push → 1 delivery → ProjectEvent(s) → 1 job → 1 ProjectUpdate
 * → feed insertion → authorized WebSocket broadcast.
 */
describe('project activity pipeline reconciliation (e2e)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('one signed push produces delivery → event → job → update → feed → WS broadcast', async () => {
    const broadcastSpy = vi.spyOn(presence, 'broadcastProjectActivity')

    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Reconcile' } })
    await db.githubInstallation.create({
      data: { tenantId: testTenantId, installationId: '99', accountName: 'acme' },
    })
    await db.githubBinding.create({
      data: {
        tenantId: testTenantId,
        installationId: '99',
        repoId: '4242',
        repoFullName: 'acme/reconcile',
        linkedProjectId: project.id,
      },
    })

    // Multi-repo cardinality: a second repo on the same project must be allowed.
    await db.githubBinding.create({
      data: {
        tenantId: testTenantId,
        installationId: '99',
        repoId: '4243',
        repoFullName: 'acme/reconcile-docs',
        linkedProjectId: project.id,
      },
    })
    const bindings = await db.githubBinding.findMany({ where: { linkedProjectId: project.id } })
    expect(bindings).toHaveLength(2)

    const pushPayload = {
      installation: { id: 99 },
      repository: { id: 4242, full_name: 'acme/reconcile' },
      ref: 'refs/heads/main',
      after: 'abcdef0123456789abcdef0123456789abcdef01',
      head_commit: {
        id: 'abcdef0123456789abcdef0123456789abcdef01',
        message: 'Wire project activity feed',
        timestamp: new Date().toISOString(),
      },
      commits: [
        {
          id: 'abcdef0123456789abcdef0123456789abcdef01',
          message: 'Wire project activity feed',
          url: 'https://github.com/acme/reconcile/commit/abcdef0123456789abcdef0123456789abcdef01',
          added: ['apps/server/src/services/ProjectEventService.ts'],
          modified: [],
          removed: [],
        },
      ],
    }

    const deliveryId = 'e2e-delivery-reconcile-1'
    const { raw, signature } = sign(pushPayload)
    const result = await githubService.handleWebhook(deliveryId, 'push', signature, raw, pushPayload)
    expect(result.status).toBe('processed')
    expect(result.eventsCreated).toBe(1)

    // 1 raw webhook delivery
    const deliveries = await db.githubWebhookDelivery.findMany({ where: { githubDeliveryId: deliveryId } })
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.processed).toBe(true)

    // Duplicate delivery is ignored — still exactly one row
    await githubService.handleWebhook(deliveryId, 'push', signature, raw, pushPayload)
    expect(await db.githubWebhookDelivery.count({ where: { githubDeliveryId: deliveryId } })).toBe(1)

    // Normalized ProjectEvent with stable externalId (not bare SHA)
    const events = await db.projectEvent.findMany({ where: { projectId: project.id } })
    expect(events).toHaveLength(1)
    const expectedExternalId = githubExternalId(
      deliveryId,
      'push',
      'abcdef0123456789abcdef0123456789abcdef01',
      null,
    )
    expect(events[0]?.externalId).toBe(expectedExternalId)
    expect(events[0]?.source).toBe('GITHUB')
    expect(events[0]?.kind).toBe('GITHUB_PUSH')

    // 1 grouped ProjectUpdateJob
    const jobs = await db.projectUpdateJob.findMany({ where: { projectId: project.id } })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.status).toBe('PENDING')
    expect(jobs[0]?.sourceEventIds).toEqual([events[0]!.id])

    // Event broadcast happened once via ProjectEventService.record
    expect(broadcastSpy.mock.calls.some((call) => call[1] === project.id && call[2].kind === 'GITHUB_PUSH')).toBe(
      true,
    )

    // Process the job immediately (bypass batch window)
    await db.projectUpdateJob.update({
      where: { id: jobs[0]!.id },
      data: { scheduledAt: new Date(0) },
    })
    await jobService.processJob(jobs[0]!.id, 'e2e-worker')

    // 1 generated ProjectUpdate
    const updates = await db.projectUpdate.findMany({ where: { projectId: project.id } })
    expect(updates).toHaveLength(1)
    expect(updates[0]?.sourceEventIds).toEqual([events[0]!.id])
    expect(updates[0]?.modelName).toBeTruthy()
    expect(updates[0]?.confidence).toBeGreaterThan(0)

    const completedJob = await db.projectUpdateJob.findUniqueOrThrow({ where: { id: jobs[0]!.id } })
    expect(completedJob.status).toBe('COMPLETED')
    expect(completedJob.projectUpdateId).toBe(updates[0]!.id)

    // Feed insertion — AI update appears alongside the GitHub event
    const feed = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}/feed`,
      headers: asAuth(testUserId),
    })
    expect(feed.statusCode).toBe(200)
    const items = feed.json().data as Array<{ id: string; provenance: string; kind: string }>
    expect(items.some((i) => i.id === events[0]!.id && i.provenance === 'github')).toBe(true)
    expect(items.some((i) => i.id === updates[0]!.id && i.provenance === 'ai' && i.kind === 'PROJECT_UPDATE')).toBe(
      true,
    )

    // Update broadcast after job completion
    expect(
      broadcastSpy.mock.calls.some((call) => call[1] === project.id && call[2].kind === 'PROJECT_UPDATE'),
    ).toBe(true)
  })
})
