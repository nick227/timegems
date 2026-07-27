import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@timegems/db'
import { buildTestApp, asAuth, testUserId, testOtherUserId, testTenantId } from './helpers'
import * as crypto from 'crypto'

const app = buildTestApp()

function computeSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return `sha256=${hmac.digest('hex')}`
}

describe('GitHub App Integration Foundation', () => {
  let projectA: any
  let projectB: any
  let tenantBId = '00000000-0000-0000-0000-00000000000b'

  beforeEach(async () => {
    // Clean tables related to github
    await db.projectEvent.deleteMany()
    await db.githubBinding.deleteMany()
    await db.githubInstallation.deleteMany()
    await db.githubWebhookDelivery.deleteMany()
    await db.project.deleteMany()
    await db.tenant.deleteMany({ where: { id: tenantBId } })

    // Create test projects for tenant A (testTenantId)
    projectA = await db.project.create({
      data: {
        name: 'Project A',
        tenantId: testTenantId,
      },
    })

    // Create a second tenant B with its own project for cross-tenant isolation testing
    await db.tenant.create({
      data: {
        id: tenantBId,
        name: 'Tenant B',
        slug: 'tenant-b',
      },
    })

    projectB = await db.project.create({
      data: {
        name: 'Project B',
        tenantId: tenantBId,
      },
    })
  })

  describe('Installation Management', () => {
    it('should register a new GitHub App installation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/integrations/github/installations',
        headers: asAuth(testUserId),
        payload: { installationId: 'inst-123' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.installationId).toBe('inst-123')
      expect(body.data.tenantId).toBe(testTenantId)

      const dbRecord = await db.githubInstallation.findUnique({
        where: { installationId: 'inst-123' },
      })
      expect(dbRecord).toBeDefined()
      expect(dbRecord?.tenantId).toBe(testTenantId)
    })

    it('should support installation reuse / re-linking', async () => {
      // First registration by Tenant A
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: 'inst-reuse',
          accountName: 'old-owner',
        },
      })

      // Re-register (relink) to Tenant A again
      const res = await app.inject({
        method: 'POST',
        url: '/integrations/github/installations',
        headers: asAuth(testUserId),
        payload: { installationId: 'inst-reuse' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.installationId).toBe('inst-reuse')
      // Note that in mock flow, it resets the accountName to 'mock-account'
      expect(body.data.accountName).toBe('mock-account')
    })

    it('should allow disconnecting an installation', async () => {
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: 'inst-delete',
          accountName: 'owner',
        },
      })

      const res = await app.inject({
        method: 'DELETE',
        url: '/integrations/github/installations/inst-delete',
        headers: asAuth(testUserId),
      })

      expect(res.statusCode).toBe(204)

      const dbRecord = await db.githubInstallation.findUnique({
        where: { installationId: 'inst-delete' },
      })
      expect(dbRecord).toBeNull()
    })

    it('should list installations for the current tenant', async () => {
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: 'inst-list-1',
          accountName: 'owner-1',
        },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/integrations/github/installations',
        headers: asAuth(testUserId),
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data.length).toBe(1)
      expect(body.data[0].installationId).toBe('inst-list-1')
    })

    it('should list repositories available for an installation', async () => {
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: 'inst-repos',
          accountName: 'test-user',
        },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/integrations/github/installations/inst-repos/repositories',
        headers: asAuth(testUserId),
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data).toBeDefined()
      expect(body.data.length).toBeGreaterThan(0)
      expect(body.data[0].fullName).toContain('test-user/')
    })
  })

  describe('Repository Binding & Authorization', () => {
    beforeEach(async () => {
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: 'inst-binding',
          accountName: 'test-user',
        },
      })
    })

    it('should bind a repository to a project within the same tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/projects/${projectA.id}/github/bindings`,
        headers: asAuth(testUserId),
        payload: {
          installationId: 'inst-binding',
          repoId: '123456',
          repoFullName: 'test-user/my-repo',
        },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.repoId).toBe('123456')
      expect(body.data.linkedProjectId).toBe(projectA.id)

      const bindings = await db.githubBinding.findMany({
        where: { linkedProjectId: projectA.id },
      })
      expect(bindings.length).toBe(1)
      expect(bindings[0]?.repoId).toBe('123456')
    })

    it('should prevent binding if the project does not exist in the tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/projects/${projectB.id}/github/bindings`, // projectB belongs to tenantB, but headers auth as tenant A
        headers: asAuth(testUserId),
        payload: {
          installationId: 'inst-binding',
          repoId: '123456',
          repoFullName: 'test-user/my-repo',
        },
      })

      expect(res.statusCode).toBe(404)
    })

    it('should prevent binding if the installation does not belong to the tenant', async () => {
      // Create installation for tenant B
      await db.githubInstallation.create({
        data: {
          tenantId: tenantBId,
          installationId: 'inst-tenant-b',
          accountName: 'other-user',
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/projects/${projectA.id}/github/bindings`,
        headers: asAuth(testUserId),
        payload: {
          installationId: 'inst-tenant-b',
          repoId: '123456',
          repoFullName: 'other-user/my-repo',
        },
      })

      expect(res.statusCode).toBe(403)
    })

    it('should unbind a repository from a project', async () => {
      const binding = await db.githubBinding.create({
        data: {
          tenantId: testTenantId,
          linkedProjectId: projectA.id,
          repoId: '123456',
          repoFullName: 'test-user/my-repo',
          installationId: 'inst-binding',
        },
      })

      const res = await app.inject({
        method: 'DELETE',
        url: `/projects/${projectA.id}/github/bindings/${binding.id}`,
        headers: asAuth(testUserId),
      })

      expect(res.statusCode).toBe(204)

      const dbBinding = await db.githubBinding.findUnique({
        where: { id: binding.id },
      })
      expect(dbBinding).toBeNull()
    })
  })

  describe('Webhook Signature Validation', () => {
    it('should accept webhooks with a valid signature', async () => {
      const payload = {
        action: 'opened',
        repository: { id: 123456, full_name: 'test-user/repo' },
        installation: { id: 999 },
      }
      const rawPayload = JSON.stringify(payload)
      const secret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-webhook-secret'
      const signature = computeSignature(rawPayload, secret)

      const res = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-delivery': 'del-111',
          'x-github-event': 'issues',
          'x-hub-signature-256': signature,
        },
        payload,
      })

      // Since there is no binding in DB, it returns 200 with status: 'ignored_no_bindings'
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload).status).toBe('ignored_no_bindings')
    })

    it('should reject webhooks with an invalid signature', async () => {
      const payload = { foo: 'bar' }
      const res = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-delivery': 'del-222',
          'x-github-event': 'push',
          'x-hub-signature-256': 'sha256=invalid-signature-value',
        },
        payload,
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('Webhook Deduplication & Idempotency', () => {
    beforeEach(async () => {
      await db.githubInstallation.create({
        data: {
          tenantId: testTenantId,
          installationId: '999',
          accountName: 'test-user',
        },
      })
      await db.githubBinding.create({
        data: {
          tenantId: testTenantId,
          linkedProjectId: projectA.id,
          repoId: '123456',
          repoFullName: 'test-user/repo',
          installationId: '999',
        },
      })
    })

    it('should process a webhook delivery exactly once', async () => {
      const payload = {
        ref: 'refs/heads/main',
        after: 'sha-abcdef123456',
        repository: { id: 123456, full_name: 'test-user/repo' },
        installation: { id: 999 },
        head_commit: {
          id: 'sha-abcdef123456',
          message: 'Feat: something cool',
          timestamp: new Date().toISOString(),
          author: { name: 'Alice' },
        },
        commits: [
          {
            id: 'sha-abcdef123456',
            message: 'Feat: something cool',
            timestamp: new Date().toISOString(),
            author: { name: 'Alice' },
          },
        ],
      }
      const rawPayload = JSON.stringify(payload)
      const secret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-webhook-secret'
      const signature = computeSignature(rawPayload, secret)

      // Post 1
      const res1 = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-delivery': 'del-uniq-1',
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        payload,
      })
      expect(res1.statusCode).toBe(200)
      expect(JSON.parse(res1.payload).status).toBe('processed')

      // Post 2 (same delivery ID)
      const res2 = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-delivery': 'del-uniq-1',
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        payload,
      })
      expect(res2.statusCode).toBe(200)
      expect(JSON.parse(res2.payload).status).toBe('ignored_duplicate')

      // Verify only 1 project event exists
      const events = await db.projectEvent.findMany({
        where: { projectId: projectA.id },
      })
      expect(events.length).toBe(1)
      expect(events[0]?.externalId).toBe('github:del-uniq-1:push:sha-abcdef123456:none')
      expect(events[0]?.source).toBe('GITHUB')
      expect(events[0]?.kind).toBe('GITHUB_PUSH')
    })
  })

  describe('Cross-Tenant Isolation & Event Normalization', () => {
    beforeEach(async () => {
      // Register App installations for Tenant A and Tenant B
      await db.githubInstallation.createMany({
        data: [
          { tenantId: testTenantId, installationId: 'inst-a', accountName: 'tenant-a-org' },
          { tenantId: tenantBId, installationId: 'inst-b', accountName: 'tenant-b-org' },
        ],
      })

      // Create bindings
      await db.githubBinding.createMany({
        data: [
          {
            tenantId: testTenantId,
            linkedProjectId: projectA.id,
            repoId: '100',
            repoFullName: 'tenant-a-org/repo-a',
            installationId: 'inst-a',
          },
          {
            tenantId: tenantBId,
            linkedProjectId: projectB.id,
            repoId: '200',
            repoFullName: 'tenant-b-org/repo-b',
            installationId: 'inst-b',
          },
        ],
      })
    })

    it('should isolate project events to the owning tenant of the repository binding', async () => {
      // Trigger a push event for Repo A (tenant A)
      const payload = {
        ref: 'refs/heads/main',
        after: 'sha-tenant-a',
        repository: { id: 100, full_name: 'tenant-a-org/repo-a' },
        installation: { id: 'inst-a' },
        head_commit: { id: 'sha-tenant-a', message: 'Work on Tenant A' },
      }
      const rawPayload = JSON.stringify(payload)
      const secret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-webhook-secret'
      const signature = computeSignature(rawPayload, secret)

      const res = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-delivery': 'del-tenant-a',
          'x-github-event': 'push',
          'x-hub-signature-256': signature,
        },
        payload,
      })

      expect(res.statusCode).toBe(200)

      // Project Event should be written to Tenant A's project
      const eventsA = await db.projectEvent.findMany({ where: { projectId: projectA.id } })
      expect(eventsA.length).toBe(1)
      expect(eventsA[0]?.tenantId).toBe(testTenantId)
      expect(eventsA[0]?.kind).toBe('GITHUB_PUSH')

      // Project Event should NOT be written to Tenant B
      const eventsB = await db.projectEvent.findMany({ where: { projectId: projectB.id } })
      expect(eventsB.length).toBe(0)
    })
  })
})
