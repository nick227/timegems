import { db, type Prisma } from '@timegems/db'
import type { ProjectEvent, ProjectEventSource, ProjectUpdate, User } from '@prisma/client'
import { decodeCursor, normalizeLimit } from '../lib/pagination'
import { HttpError } from '../lib/errors'
import {
  type ProjectEventPayload,
  type ProjectFeedItem,
  type ProjectFeedLink,
  sourceToProvenance,
  updateProvenanceLabel,
} from '../lib/projectActivity'
import { broadcastProjectActivity } from '../presence'

type NoteWithAuthor = {
  id: string
  body: string
  workSessionId: string
  createdAt: Date
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>
}

export type RecordProjectEventInput = {
  tenantId: string
  projectId: string
  source: ProjectEventSource
  kind: string
  externalId: string
  title?: string | null
  body?: string | null
  payload: ProjectEventPayload
  actorUserId?: string | null
  occurredAt: Date
  /** When set, schedules a durable ProjectUpdateJob for this event (GitHub path). */
  batchKey?: string
}

export class ProjectEventService {
  /**
   * Single ownership point for project activity: persist (idempotent on
   * projectId+source+externalId), broadcast to the project room, and optionally
   * schedule an AI update job. Callers (GithubService, NoteService) must not
   * broadcast or schedule themselves.
   */
  async record(input: RecordProjectEventInput): Promise<ProjectEvent> {
    const event = await this.upsertEvent(input)

    let actor: Pick<User, 'id' | 'name' | 'avatarUrl'> | null = null
    if (input.actorUserId) {
      actor = await db.user.findUnique({
        where: { id: input.actorUserId },
        select: { id: true, name: true, avatarUrl: true },
      })
    }

    this.broadcastFeedItem(input.tenantId, input.projectId, this.eventToFeedItem(event, actor))

    if (input.batchKey) {
      // Lazy import avoids a circular dep with ProjectUpdateJobService.
      const { ProjectUpdateJobService } = await import('./ProjectUpdateJobService')
      await new ProjectUpdateJobService().scheduleForGithubEvent(
        input.tenantId,
        input.projectId,
        event,
        input.batchKey,
      )
    }

    return event
  }

  async recordHumanNote(
    tenantId: string,
    projectId: string,
    note: NoteWithAuthor,
  ): Promise<ProjectEvent> {
    return this.record({
      tenantId,
      projectId,
      source: 'HUMAN',
      kind: 'NOTE_CREATED',
      externalId: `note:${note.id}`,
      title: null,
      body: note.body,
      payload: { noteId: note.id, workSessionId: note.workSessionId },
      actorUserId: note.author.id,
      occurredAt: note.createdAt,
    })
  }

  async upsertEvent(input: RecordProjectEventInput): Promise<ProjectEvent> {
    const project = await db.project.findFirst({
      where: { id: input.projectId, tenantId: input.tenantId },
      select: { id: true },
    })
    if (!project) throw new HttpError(404, 'Project not found')

    return db.projectEvent.upsert({
      where: {
        projectId_source_externalId: {
          projectId: input.projectId,
          source: input.source,
          externalId: input.externalId,
        },
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        source: input.source,
        kind: input.kind,
        externalId: input.externalId,
        title: input.title ?? null,
        body: input.body ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        actorUserId: input.actorUserId ?? null,
        occurredAt: input.occurredAt,
      },
      update: {},
    })
  }

  async listFeed(
    tenantId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    await this.requireProject(tenantId, projectId)
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const fetchSize = limit + 1

    const [events, updates] = await Promise.all([
      db.projectEvent.findMany({
        where: { tenantId, projectId },
        include: { actor: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: fetchSize * 2,
      }),
      db.projectUpdate.findMany({
        where: { tenantId, projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: fetchSize * 2,
      }),
    ])

    let items = [
      ...events.map((event) => this.eventToFeedItem(event, event.actor)),
      ...updates.map((update) => this.updateToFeedItem(update)),
    ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

    if (cursor) {
      const cursorTime = Date.parse(cursor.createdAt)
      items = items.filter((item) => {
        const t = Date.parse(item.occurredAt)
        if (t < cursorTime) return true
        if (t > cursorTime) return false
        return item.id < cursor.id
      })
    }

    const hasMore = items.length > limit
    const page = items.slice(0, limit)
    const last = page[page.length - 1]
    return {
      data: page,
      meta: {
        hasMore,
        nextCursor:
          hasMore && last
            ? Buffer.from(JSON.stringify({ createdAt: last.occurredAt, id: last.id })).toString('base64url')
            : null,
      },
    }
  }

  async getUpdate(tenantId: string, projectId: string, updateId: string) {
    await this.requireProject(tenantId, projectId)
    const update = await db.projectUpdate.findFirst({
      where: { id: updateId, tenantId, projectId },
    })
    if (!update) throw new HttpError(404, 'Project update not found')
    return this.updateToFeedItem(update)
  }

  broadcastFeedItem(tenantId: string, projectId: string, item: ProjectFeedItem) {
    broadcastProjectActivity(tenantId, projectId, item)
  }

  private async requireProject(tenantId: string, projectId: string) {
    const project = await db.project.findFirst({ where: { id: projectId, tenantId }, select: { id: true } })
    if (!project) throw new HttpError(404, 'Project not found')
  }

  eventToFeedItem(
    event: ProjectEvent,
    actor: Pick<User, 'id' | 'name' | 'avatarUrl'> | null,
  ): ProjectFeedItem {
    const payload = event.payload as ProjectEventPayload
    return {
      id: event.id,
      projectId: event.projectId,
      provenance: sourceToProvenance(event.source),
      kind: event.kind,
      title: event.title,
      body: event.body,
      occurredAt: event.occurredAt.toISOString(),
      actor: actor
        ? { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl }
        : null,
      workSessionId: payload.workSessionId ?? null,
      noteId: payload.noteId ?? null,
      evidence: this.payloadToEvidence(payload),
      links: this.payloadToEvidence(payload)?.links ?? [],
    }
  }

  updateToFeedItem(update: ProjectUpdate): ProjectFeedItem {
    const evidence = update.evidence as unknown as ProjectFeedItem['evidence']
    const sourceEventIds = update.sourceEventIds as string[]
    return {
      id: update.id,
      projectId: update.projectId,
      provenance: 'ai',
      kind: 'PROJECT_UPDATE',
      title: updateProvenanceLabel(update.provenance),
      body: update.body,
      occurredAt: update.createdAt.toISOString(),
      actor: null,
      sourceEventIds,
      confidence: update.confidence,
      modelName: update.modelName,
      modelVersion: update.modelVersion,
      evidence,
      links: evidence?.links ?? [],
    }
  }

  private payloadToEvidence(payload: ProjectEventPayload): ProjectFeedItem['evidence'] | undefined {
    const links: ProjectFeedLink[] = []
    const evidence: NonNullable<ProjectFeedItem['evidence']> = { links }

    if (payload.commits?.length) {
      evidence.commits = payload.commits.map((c) => ({
        sha: c.id,
        message: c.message,
        url: c.url,
      }))
      for (const commit of payload.commits) {
        if (commit.url) links.push({ label: commit.id.slice(0, 7), url: commit.url })
      }
    }
    if (payload.filesChanged?.length) evidence.filesChanged = payload.filesChanged
    if (payload.pullRequest) {
      evidence.pullRequest = payload.pullRequest
      links.push({ label: `PR #${payload.pullRequest.number}`, url: payload.pullRequest.url })
    }
    if (payload.checkRun) {
      evidence.checkRun = {
        name: payload.checkRun.name,
        conclusion: payload.checkRun.conclusion,
        url: payload.checkRun.url,
      }
      if (payload.checkRun.url) links.push({ label: payload.checkRun.name, url: payload.checkRun.url })
    }

    if (!evidence.commits?.length && !evidence.filesChanged?.length && !evidence.pullRequest && !evidence.checkRun) {
      return undefined
    }
    return evidence
  }
}

/** Stable GitHub ProjectEvent.externalId — never a bare commit SHA. */
export function githubExternalId(
  githubDeliveryId: string,
  event: string,
  entityId: string,
  action: string | null | undefined,
): string {
  return `github:${githubDeliveryId}:${event}:${entityId}:${action ?? 'none'}`
}
