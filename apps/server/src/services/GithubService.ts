import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'
import * as crypto from 'crypto'
import { ProjectEventKinds, type ProjectEventPayload } from '../lib/projectActivity'
import { githubExternalId, ProjectEventService } from './ProjectEventService'

const projectEventService = new ProjectEventService()

export class GithubService {
  private getAppConfig() {
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_PRIVATE_KEY
      ? process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-webhook-secret'
    
    return {
      appId,
      privateKey,
      webhookSecret,
      isConfigured: !!(appId && privateKey),
    }
  }

  // Generates a RS256 JWT signed with the GitHub App's private key
  private generateAppJwt(): string {
    const { appId, privateKey, isConfigured } = this.getAppConfig()
    if (!isConfigured || !appId || !privateKey) {
      throw new HttpError(500, 'GitHub App is not fully configured (missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY)')
    }

    const header = { alg: 'RS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now - 60, // 60 seconds clock skew leeway
      exp: now + 600, // 10 minutes maximum
      iss: appId,
    }

    const base64UrlHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const base64UrlPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const tokenInput = `${base64UrlHeader}.${base64UrlPayload}`

    const signer = crypto.createSign('RSA-SHA256')
    signer.update(tokenInput)
    const signature = signer.sign(privateKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '') // Base64URL encode

    return `${tokenInput}.${signature}`
  }

  // Fetches a temporary installation access token from GitHub
  private async getInstallationAccessToken(installationId: string): Promise<string> {
    const jwt = this.generateAppJwt()
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'TimeGems-App',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new HttpError(response.status, `Failed to retrieve GitHub installation token: ${errText}`)
    }

    const data = (await response.json()) as { token: string }
    return data.token
  }

  // Verifies the webhook HMAC signature
  verifyWebhookSignature(signatureHeader: string | undefined, rawBody: string): boolean {
    if (!signatureHeader) return false
    const { webhookSecret } = this.getAppConfig()
    
    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(rawBody)
    const expected = `sha256=${hmac.digest('hex')}`

    const bufExpected = Buffer.from(expected)
    const bufActual = Buffer.from(signatureHeader)
    if (bufExpected.length !== bufActual.length) return false

    return crypto.timingSafeEqual(bufExpected, bufActual)
  }

  // Lists installations for the current tenant
  async listInstallations(tenantId: string) {
    return db.githubInstallation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Registers a new installation (or updates/re-uses an existing one)
  async registerInstallation(tenantId: string, installationId: string) {
    const { isConfigured } = this.getAppConfig()

    let accountName = 'mock-account'
    let accountAvatarUrl = 'https://github.com/identicons/mock.png'

    if (isConfigured) {
      try {
        const jwt = this.generateAppJwt()
        const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'TimeGems-App',
          },
        })

        if (!response.ok) {
          throw new Error(`GitHub API returned status ${response.status}`)
        }

        const data = (await response.json()) as any
        accountName = data.account.login
        accountAvatarUrl = data.account.avatar_url
      } catch (err: any) {
        console.error('Error fetching installation from GitHub:', err)
        // In local development we fallback to mock if API fails, but in prod we throw
        if (process.env.NODE_ENV === 'production') {
          throw new HttpError(400, `Failed to verify installationId ${installationId}: ${err.message}`)
        }
      }
    }

    // Upsert the installation to support "installation reuse" / re-linking
    return db.githubInstallation.upsert({
      where: { installationId },
      update: {
        tenantId, // Re-bind to current tenant if it was previously bound to another (or same)
        accountName,
        accountAvatarUrl,
      },
      create: {
        tenantId,
        installationId,
        accountName,
        accountAvatarUrl,
      },
    })
  }

  // Disconnects an installation and cleans up all its bindings
  async disconnectInstallation(tenantId: string, installationId: string) {
    const installation = await db.githubInstallation.findFirst({
      where: { installationId, tenantId },
    })
    if (!installation) {
      throw new HttpError(404, 'Installation not found')
    }

    // Deleting installation will cascade delete GithubBindings due to onDelete: Cascade
    await db.githubInstallation.delete({
      where: { installationId },
    })
  }

  // Lists repositories authorized for the installation
  async listRepositories(tenantId: string, installationId: string) {
    // Enforce authorization: verify the installation belongs to this tenant
    const installation = await db.githubInstallation.findFirst({
      where: { installationId, tenantId },
    })
    if (!installation) {
      throw new HttpError(404, 'Installation not found')
    }

    const { isConfigured } = this.getAppConfig()
    if (!isConfigured) {
      // Mock repositories for local testing/development
      return [
        {
          id: 'mock-repo-1',
          name: 'timegems-docs',
          fullName: `${installation.accountName}/timegems-docs`,
          private: false,
          htmlUrl: `https://github.com/${installation.accountName}/timegems-docs`,
        },
        {
          id: 'mock-repo-2',
          name: 'timegems-core',
          fullName: `${installation.accountName}/timegems-core`,
          private: true,
          htmlUrl: `https://github.com/${installation.accountName}/timegems-core`,
        },
      ]
    }

    try {
      const token = await this.getInstallationAccessToken(installationId)
      const response = await fetch('https://api.github.com/installation/repositories', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'TimeGems-App',
        },
      })

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`)
      }

      const data = (await response.json()) as { repositories: any[] }
      return data.repositories.map((repo) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        htmlUrl: repo.html_url,
      }))
    } catch (err: any) {
      console.error('Error listing repositories from GitHub:', err)
      throw new HttpError(500, `Failed to retrieve repositories: ${err.message}`)
    }
  }

  // Lists bindings for a project
  async listProjectBindings(tenantId: string, projectId: string) {
    // Verify project belongs to tenant
    const project = await db.project.findFirst({
      where: { id: projectId, tenantId },
    })
    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    return db.githubBinding.findMany({
      where: { tenantId, linkedProjectId: projectId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Binds a repository to a project
  async bindRepository(
    tenantId: string,
    projectId: string,
    body: { installationId: string; repoId: string; repoFullName: string },
  ) {
    // 1. Verify project exists in tenant
    const project = await db.project.findFirst({
      where: { id: projectId, tenantId },
    })
    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    // 2. Verify installation belongs to tenant
    const installation = await db.githubInstallation.findFirst({
      where: { installationId: body.installationId, tenantId },
    })
    if (!installation) {
      throw new HttpError(403, 'GitHub App installation does not belong to this tenant')
    }

    // 3. Create or update binding
    return db.githubBinding.upsert({
      where: {
        tenantId_linkedProjectId_repoId: {
          tenantId,
          linkedProjectId: projectId,
          repoId: body.repoId,
        },
      },
      update: {
        repoFullName: body.repoFullName,
        installationId: body.installationId,
      },
      create: {
        tenantId,
        linkedProjectId: projectId,
        repoId: body.repoId,
        repoFullName: body.repoFullName,
        installationId: body.installationId,
      },
    })
  }

  // Unbinds a repository
  async unbindRepository(tenantId: string, projectId: string, bindingId: string) {
    const binding = await db.githubBinding.findFirst({
      where: { id: bindingId, tenantId, linkedProjectId: projectId },
    })
    if (!binding) {
      throw new HttpError(404, 'Binding not found')
    }

    await db.githubBinding.delete({
      where: { id: bindingId },
    })
  }

  // Handles GitHub webhooks: signature → raw delivery persist → normalize →
  // ProjectEventService.record (persist + broadcast + job schedule).
  async handleWebhook(
    githubDeliveryId: string,
    event: string,
    signatureHeader: string | undefined,
    rawBody: string,
    parsedBody: any,
  ) {
    if (!this.verifyWebhookSignature(signatureHeader, rawBody)) {
      throw new HttpError(401, 'Invalid GitHub webhook signature')
    }

    let delivery
    try {
      delivery = await db.githubWebhookDelivery.create({
        data: {
          githubDeliveryId,
          event,
          payload: parsedBody,
        },
      })
    } catch (err: any) {
      if (err.code === 'P2002') {
        return { status: 'ignored_duplicate' }
      }
      throw err
    }

    const repository = parsedBody.repository
    if (!repository || !repository.id) {
      await db.githubWebhookDelivery.update({
        where: { id: delivery.id },
        data: { processed: true, error: 'No repository details found in payload' },
      })
      return { status: 'ignored_no_repo' }
    }

    const repoId = repository.id.toString()
    const installation = parsedBody.installation
    if (!installation || !installation.id) {
      await db.githubWebhookDelivery.update({
        where: { id: delivery.id },
        data: { processed: true, error: 'No installation details found in payload' },
      })
      return { status: 'ignored_no_installation' }
    }

    const installationId = installation.id.toString()
    const bindings = await db.githubBinding.findMany({
      where: { repoId, installationId },
      include: { tenant: true },
    })

    if (bindings.length === 0) {
      await db.githubWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          processed: true,
          error: `No active bindings for repoId ${repoId} under installation ${installationId}`,
        },
      })
      return { status: 'ignored_no_bindings' }
    }

    const normalized = this.normalizePayload(event, parsedBody)
    if (!normalized) {
      await db.githubWebhookDelivery.update({
        where: { id: delivery.id },
        data: { processed: true, error: `Unsupported or ignored event type: ${event}` },
      })
      return { status: 'ignored_unsupported_event' }
    }

    let processedCount = 0
    const errors: string[] = []
    const externalId = githubExternalId(githubDeliveryId, event, normalized.entityId, normalized.action)
    const feedPayload = this.toProjectEventPayload(normalized.eventType, normalized.payload, githubDeliveryId)
    const kind = this.toProjectEventKind(normalized.eventType)
    const title = this.eventTitle(normalized.eventType, normalized.payload)

    for (const binding of bindings) {
      try {
        const batchKey = `${binding.linkedProjectId}:${feedPayload.repoFullName ?? 'repo'}:${this.batchSuffix(normalized.eventType, feedPayload)}`
        await projectEventService.record({
          tenantId: binding.tenantId,
          projectId: binding.linkedProjectId,
          source: 'GITHUB',
          kind,
          externalId,
          title,
          body: null,
          payload: feedPayload,
          occurredAt: normalized.occurredAt,
          batchKey,
        })
        processedCount++
      } catch (err: any) {
        errors.push(`Project ${binding.linkedProjectId}: ${err.message}`)
      }
    }

    await db.githubWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        processed: true,
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    })

    return {
      status: 'processed',
      eventsCreated: processedCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  private normalizePayload(
    event: string,
    body: any,
  ): { eventType: string; entityId: string; action: string | null; payload: any; occurredAt: Date } | null {
    const action = body.action || null
    const repository = body.repository
    const sender = body.sender
      ? {
          id: body.sender.id.toString(),
          login: body.sender.login,
          avatarUrl: body.sender.avatar_url,
        }
      : null

    const envelopeBase = {
      repoId: repository.id.toString(),
      repoName: repository.full_name,
      sender,
      action,
    }

    switch (event) {
      case 'push': {
        const entityId = body.head_commit?.id || body.after
        if (!entityId || entityId === '0000000000000000000000000000000000000000') return null
        const commits = (body.commits || []).map((c: any) => ({
          id: c.id,
          message: c.message,
          author: c.author?.name || c.committer?.name || 'unknown',
          url: c.url,
          added: c.added,
          modified: c.modified,
          removed: c.removed,
        }))
        return {
          eventType: 'PUSH',
          entityId,
          action,
          occurredAt: body.head_commit?.timestamp ? new Date(body.head_commit.timestamp) : new Date(),
          payload: {
            ...envelopeBase,
            details: {
              ref: body.ref,
              before: body.before,
              after: body.after,
              commits,
              compare: body.compare,
            },
          },
        }
      }
      case 'pull_request': {
        const pr = body.pull_request
        if (!pr) return null
        return {
          eventType: 'PULL_REQUEST',
          entityId: pr.id.toString(),
          action,
          occurredAt: pr.updated_at ? new Date(pr.updated_at) : new Date(pr.created_at),
          payload: {
            ...envelopeBase,
            details: {
              number: pr.number,
              title: pr.title,
              state: pr.state,
              merged: pr.merged || false,
              url: pr.html_url,
              body: pr.body,
            },
          },
        }
      }
      case 'pull_request_review': {
        const review = body.review
        const pr = body.pull_request
        if (!review || !pr) return null
        return {
          eventType: 'PULL_REQUEST_REVIEW',
          entityId: review.id.toString(),
          action,
          occurredAt: review.submitted_at ? new Date(review.submitted_at) : new Date(),
          payload: {
            ...envelopeBase,
            details: {
              reviewId: review.id.toString(),
              pullRequestNumber: pr.number,
              pullRequestTitle: pr.title,
              state: action,
              reviewState: review.state,
              url: review.html_url,
              body: review.body,
            },
          },
        }
      }
      case 'issues': {
        const issue = body.issue
        if (!issue) return null
        return {
          eventType: 'ISSUE',
          entityId: issue.id.toString(),
          action,
          occurredAt: issue.updated_at ? new Date(issue.updated_at) : new Date(issue.created_at),
          payload: {
            ...envelopeBase,
            details: {
              number: issue.number,
              title: issue.title,
              state: issue.state,
              url: issue.html_url,
              body: issue.body,
            },
          },
        }
      }
      case 'issue_comment': {
        const comment = body.comment
        const issue = body.issue
        if (!comment || !issue) return null
        return {
          eventType: 'ISSUE_COMMENT',
          entityId: comment.id.toString(),
          action,
          occurredAt: comment.updated_at ? new Date(comment.updated_at) : new Date(comment.created_at),
          payload: {
            ...envelopeBase,
            details: {
              commentId: comment.id.toString(),
              parentType: issue.pull_request ? 'pull_request' : 'issue',
              parentNumber: issue.number,
              parentTitle: issue.title,
              body: comment.body,
              url: comment.html_url,
            },
          },
        }
      }
      case 'workflow_run': {
        const run = body.workflow_run
        if (!run) return null
        return {
          eventType: 'WORKFLOW_RUN',
          entityId: run.id.toString(),
          action,
          occurredAt: run.updated_at ? new Date(run.updated_at) : new Date(),
          payload: {
            ...envelopeBase,
            details: {
              runId: run.id.toString(),
              workflowName: run.name,
              status: run.status,
              conclusion: run.conclusion,
              url: run.html_url,
              commitSha: run.head_sha,
            },
          },
        }
      }
      case 'check_run': {
        const check = body.check_run
        if (!check) return null
        return {
          eventType: 'CHECK_RUN',
          entityId: check.id.toString(),
          action,
          occurredAt: check.completed_at ? new Date(check.completed_at) : new Date(),
          payload: {
            ...envelopeBase,
            details: {
              checkRunId: check.id.toString(),
              name: check.name,
              conclusion: check.conclusion,
              url: check.html_url,
            },
          },
        }
      }
      case 'release': {
        const release = body.release
        if (!release) return null
        return {
          eventType: 'RELEASE',
          entityId: release.id.toString(),
          action,
          occurredAt: release.published_at ? new Date(release.published_at) : new Date(),
          payload: {
            ...envelopeBase,
            details: {
              releaseId: release.id.toString(),
              tagName: release.tag_name,
              name: release.name,
              url: release.html_url,
              body: release.body,
            },
          },
        }
      }
      default:
        return null
    }
  }

  private toProjectEventKind(eventType: string): string {
    if (eventType === 'PUSH') return ProjectEventKinds.GITHUB_PUSH
    if (eventType === 'PULL_REQUEST' || eventType === 'PULL_REQUEST_REVIEW') {
      return ProjectEventKinds.GITHUB_PULL_REQUEST
    }
    if (eventType === 'WORKFLOW_RUN' || eventType === 'CHECK_RUN') {
      return ProjectEventKinds.GITHUB_CHECK_RUN
    }
    return eventType
  }

  private toProjectEventPayload(
    eventType: string,
    payload: any,
    githubDeliveryId: string,
  ): ProjectEventPayload {
    const details = payload?.details ?? {}
    const base: ProjectEventPayload = {
      repoFullName: payload?.repoName,
      githubDeliveryId,
    }

    if (eventType === 'PUSH') {
      const filesChanged = new Set<string>()
      for (const c of details.commits ?? []) {
        for (const f of [...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? [])]) {
          filesChanged.add(f)
        }
      }
      return {
        ...base,
        ref: details.ref,
        commits: (details.commits ?? []).map((c: { id: string; message: string; url?: string }) => ({
          id: c.id,
          message: c.message,
          url: c.url,
        })),
        filesChanged: [...filesChanged],
      }
    }

    if (eventType === 'PULL_REQUEST' || eventType === 'PULL_REQUEST_REVIEW') {
      return {
        ...base,
        pullRequest: {
          number: details.number ?? details.pullRequestNumber,
          title: details.title ?? details.pullRequestTitle ?? 'Pull request',
          url: details.url,
          state: details.merged ? 'merged' : details.state ?? details.reviewState,
        },
      }
    }

    if (eventType === 'WORKFLOW_RUN' || eventType === 'CHECK_RUN') {
      return {
        ...base,
        checkRun: {
          id: Number(details.runId ?? details.checkRunId ?? 0),
          name: details.workflowName ?? details.name ?? 'Check',
          conclusion: details.conclusion ?? null,
          url: details.url,
        },
      }
    }

    return base
  }

  private eventTitle(eventType: string, payload: any): string | null {
    const details = payload?.details ?? {}
    if (eventType === 'PUSH') return `Push to ${details.ref ?? 'branch'}`
    if (eventType === 'PULL_REQUEST') return `PR #${details.number}`
    if (eventType === 'WORKFLOW_RUN') return details.workflowName ?? 'Workflow run'
    if (eventType === 'CHECK_RUN') return details.name ?? 'Check run'
    return eventType
  }

  private batchSuffix(eventType: string, payload: ProjectEventPayload): string {
    if (eventType === 'PUSH') return payload.ref ?? 'push'
    if (payload.pullRequest) return `pr:${payload.pullRequest.number}`
    return 'checks'
  }
}
