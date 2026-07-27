import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as crypto from 'crypto'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'
import { GithubService } from '../services/GithubService'
import { ProjectUpdateJobService } from '../services/ProjectUpdateJobService'
import { ProjectUpdateWriterService } from '../services/ProjectUpdateWriterService'
import { broadcastProjectActivity } from '../presence'
import { PUSH_BATCH_WINDOW_MS } from '../lib/projectActivity'

const app = buildTestApp()
const githubService = new GithubService()
const jobService = new ProjectUpdateJobService()
const writerService = new ProjectUpdateWriterService()

function sign(payload: object) {
  const raw = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', 'test-webhook-secret')
  hmac.update(raw)
  return { raw, signature: `sha256=${hmac.digest('hex')}` }
}

async function seedProjectWithGithubBinding() {
  const project = await db.project.create({ data: { tenantId: testTenantId, name: 'API' } })
  await db.githubInstallation.create({
    data: { tenantId: testTenantId, installationId: '1', accountName: 'acme' },
  })
  await db.githubBinding.create({
    data: {
      tenantId: testTenantId,
      installationId: '1',
      repoId: '99',
      repoFullName: 'acme/api',
      linkedProjectId: project.id,
    },
  })
  return project
}

const pushPayload = {
  installation: { id: 1 },
  repository: { id: 99, full_name: 'acme/api' },
  ref: 'refs/heads/main',
  head_commit: { id: 'abc1234567890', message: 'Fix webhook batching', timestamp: new Date().toISOString() },
  commits: [
    {
      id: 'abc1234567890',
      message: 'Fix webhook batching',
      url: 'https://github.com/acme/api/commit/abc1234567890',
      added: ['src/batch.ts'],
      modified: ['README.md'],
      removed: [],
    },
  ],
}

describe('listProjectFeed', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/p1/feed' })
    expect(res.statusCode).toBe(401)
  })

  it('returns human note activity for a project', async () => {
    const project = await db.project.create({ data: { tenantId: testTenantId, name: 'Website' } })
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, projectId: project.id, name: 'Session', status: 'RUNNING' },
    })
    await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/notes`,
      headers: asAuth(testUserId),
      payload: { body: 'Shipped the feed endpoint' },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}/feed`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listProjectFeed', 200, res.json())
    const item = res.json().data[0]
    expect(item.provenance).toBe('human')
    expect(item.body).toContain('Shipped the feed endpoint')
  })

  it('scopes feed to tenant', async () => {
    const otherTenant = await db.tenant.create({ data: { name: 'Other', slug: 'other-co' } })
    const foreignProject = await db.project.create({ data: { tenantId: otherTenant.id, name: 'Foreign' } })
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${foreignProject.id}/feed`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('github webhook pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dedupes deliveries and events', async () => {
    const project = await seedProjectWithGithubBinding()
    const { raw, signature } = sign(pushPayload)
    await githubService.handleWebhook('delivery-1', 'push', signature, raw, pushPayload)
    await githubService.handleWebhook('delivery-1', 'push', signature, raw, pushPayload)

    const events = await db.projectEvent.findMany({ where: { projectId: project.id } })
    expect(events).toHaveLength(1)
    const deliveries = await db.githubWebhookDelivery.findMany({ where: { githubDeliveryId: 'delivery-1' } })
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.processed).toBe(true)
  })

  it('batches related push events into one job', async () => {
    const project = await seedProjectWithGithubBinding()
    const first = sign(pushPayload)
    await githubService.handleWebhook('delivery-2', 'push', first.signature, first.raw, pushPayload)
    const secondPayload = {
      ...pushPayload,
      head_commit: { id: 'def4567890abc', message: 'Second push', timestamp: new Date().toISOString() },
      commits: [{ id: 'def4567890abc', message: 'Second push', added: ['src/other.ts'], modified: [], removed: [] }],
    }
    const second = sign(secondPayload)
    await githubService.handleWebhook('delivery-3', 'push', second.signature, second.raw, secondPayload)

    const jobs = await db.projectUpdateJob.findMany({ where: { projectId: project.id } })
    expect(jobs).toHaveLength(1)
    expect((jobs[0]?.sourceEventIds as string[]).length).toBe(2)
  })

  it('retries failed jobs and marks dead after max attempts', async () => {
    const project = await seedProjectWithGithubBinding()
    const { raw, signature } = sign(pushPayload)
    await githubService.handleWebhook('delivery-4', 'push', signature, raw, pushPayload)
    const job = await db.projectUpdateJob.findFirstOrThrow({ where: { projectId: project.id } })

    const spy = vi.spyOn(ProjectUpdateWriterService.prototype, 'write').mockImplementation(() => {
      throw new Error('writer blew up')
    })

    for (let i = 0; i < 3; i++) {
      await db.projectUpdateJob.update({
        where: { id: job.id },
        data: { scheduledAt: new Date(0), status: 'PENDING', attemptCount: i },
      })
      try {
        await jobService.processJob(job.id, `worker-${i}`)
      } catch {
        // expected while the writer is mocked to fail
      }
    }

    const dead = await db.projectUpdateJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(dead.status).toBe('DEAD')
    spy.mockRestore()
  })

  it('writes an evidence-grounded update without claiming success on failed CI', async () => {
    const project = await seedProjectWithGithubBinding()
    const push = sign(pushPayload)
    await githubService.handleWebhook('delivery-5', 'push', push.signature, push.raw, pushPayload)
    const checkPayload = {
      installation: { id: 1 },
      repository: { id: 99, full_name: 'acme/api' },
      workflow_run: {
        id: 42,
        name: 'CI',
        conclusion: 'failure',
        status: 'completed',
        html_url: 'https://github.com/acme/api/actions/runs/1',
        updated_at: new Date().toISOString(),
      },
    }
    const check = sign(checkPayload)
    await githubService.handleWebhook('delivery-6', 'workflow_run', check.signature, check.raw, checkPayload)

    const job = await db.projectUpdateJob.findFirstOrThrow({
      where: { projectId: project.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })
    await db.projectUpdateJob.update({ where: { id: job.id }, data: { scheduledAt: new Date(0) } })
    await jobService.processJob(job.id, 'worker-test')

    const update = await db.projectUpdate.findFirstOrThrow({ where: { projectId: project.id } })
    expect(update.body).toContain('failed')
    expect(update.body).not.toMatch(/successfully completed|shipped|merged/i)
    expect(update.confidence).toBeLessThan(0.9)
  })
})

describe('getProjectUpdate', () => {
  it('returns persisted update metadata', async () => {
    const project = await seedProjectWithGithubBinding()
    const event = await db.projectEvent.create({
      data: {
        tenantId: testTenantId,
        projectId: project.id,
        source: 'GITHUB',
        kind: 'GITHUB_PUSH',
        externalId: 'x',
        payload: pushPayload,
        occurredAt: new Date(),
      },
    })
    const update = await db.projectUpdate.create({
      data: {
        tenantId: testTenantId,
        projectId: project.id,
        body: 'Test update',
        confidence: 0.7,
        modelName: 'timegems-update-writer',
        sourceEventIds: [event.id],
        evidence: { links: [] },
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}/updates/${update.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getProjectUpdate', 200, res.json())
    expect(res.json().data.id).toBe(update.id)
    expect(res.json().data.provenance).toBe('ai')
  })
})

describe('writer guardrails', () => {
  it('does not claim merge completion without merged PR evidence', () => {
    const draft = writerService.write(
      [
        {
          id: 'e1',
          tenantId: testTenantId,
          projectId: 'p1',
          source: 'GITHUB',
          kind: 'GITHUB_PULL_REQUEST',
          externalId: '1',
          title: 'PR',
          body: null,
          payload: {
            pullRequest: { number: 9, title: 'Add feed', url: 'https://github.com/acme/api/pull/9', state: 'open' },
          },
          actorUserId: null,
          occurredAt: new Date(),
          createdAt: new Date(),
        },
      ],
      [],
    )
    expect(draft.body).toContain('open')
    expect(draft.evidence.limitations?.some((l) => l.includes('No merge'))).toBe(true)
  })
})

describe('websocket broadcast helper', () => {
  it('does not throw when no subscribers are present', () => {
    expect(() =>
      broadcastProjectActivity('missing-tenant', 'proj-1', {
        id: 'item-1',
        projectId: 'proj-1',
        provenance: 'github',
        kind: 'GITHUB_PUSH',
        title: 'Push',
        body: null,
        occurredAt: new Date().toISOString(),
        actor: null,
      }),
    ).not.toThrow()
  })
})

describe('job scheduling window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it(`defers processing until the ${PUSH_BATCH_WINDOW_MS}ms batch window`, async () => {
    const project = await seedProjectWithGithubBinding()
    const { raw, signature } = sign(pushPayload)
    await githubService.handleWebhook('delivery-window', 'push', signature, raw, pushPayload)
    const job = await db.projectUpdateJob.findFirstOrThrow({ where: { projectId: project.id } })
    expect(job.scheduledAt.getTime()).toBeGreaterThan(Date.now())
  })
})
