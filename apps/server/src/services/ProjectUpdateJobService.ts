import { db, type Prisma } from '@timegems/db'
import type { ProjectEvent } from '@prisma/client'
import { randomUUID } from 'crypto'
import { HttpError } from '../lib/errors'
import {
  JOB_LOCK_TTL_MS,
  PROJECT_UPDATE_MODEL,
  PROJECT_UPDATE_MODEL_VERSION,
  PUSH_BATCH_WINDOW_MS,
  type ProjectFeedEvidence,
} from '../lib/projectActivity'
import { ProjectEventService } from './ProjectEventService'
import { ProjectUpdateWriterService } from './ProjectUpdateWriterService'

const eventService = new ProjectEventService()
const writerService = new ProjectUpdateWriterService()

export class ProjectUpdateJobService {
  async scheduleForGithubEvent(
    tenantId: string,
    projectId: string,
    event: ProjectEvent,
    batchKey: string,
  ) {
    const dedupeKey = `batch:${batchKey}`
    const scheduledAt = new Date(Date.now() + PUSH_BATCH_WINDOW_MS)
    const existing = await db.projectUpdateJob.findUnique({ where: { dedupeKey } })

    if (existing && (existing.status === 'PENDING' || existing.status === 'FAILED')) {
      const ids = new Set(existing.sourceEventIds as string[])
      ids.add(event.id)
      await db.projectUpdateJob.update({
        where: { id: existing.id },
        data: {
          sourceEventIds: [...ids],
          scheduledAt,
          status: 'PENDING',
        },
      })
      return existing.id
    }

    if (existing?.status === 'COMPLETED' || existing?.status === 'PROCESSING') {
      const followUpKey = `${dedupeKey}:${event.id}`
      return this.createJob(tenantId, projectId, [event.id], followUpKey, batchKey, scheduledAt)
    }

    return this.createJob(tenantId, projectId, [event.id], dedupeKey, batchKey, scheduledAt)
  }

  private async createJob(
    tenantId: string,
    projectId: string,
    sourceEventIds: string[],
    dedupeKey: string,
    batchKey: string,
    scheduledAt: Date,
  ) {
    const job = await db.projectUpdateJob.create({
      data: {
        tenantId,
        projectId,
        batchKey,
        dedupeKey,
        sourceEventIds,
        scheduledAt,
      },
    })
    return job.id
  }

  async sweepDueJobs(workerId = randomUUID()) {
    const now = new Date()
    const staleLockBefore = new Date(now.getTime() - JOB_LOCK_TTL_MS)

    const jobs = await db.projectUpdateJob.findMany({
      where: {
        OR: [
          { status: 'PENDING', scheduledAt: { lte: now } },
          { status: 'PROCESSING', lockedAt: { lt: staleLockBefore } },
          { status: 'FAILED', scheduledAt: { lte: now } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    })

    for (const job of jobs) {
      try {
        await this.processJob(job.id, workerId)
      } catch (err) {
        console.error(`[project-update-jobs] job ${job.id} failed`, err)
      }
    }
  }

  async processJob(jobId: string, workerId: string) {
    const claimed = await db.projectUpdateJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: 'PENDING' },
          { status: 'FAILED' },
          { status: 'PROCESSING', lockedAt: { lt: new Date(Date.now() - JOB_LOCK_TTL_MS) } },
        ],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        lockedBy: workerId,
        attemptCount: { increment: 1 },
      },
    })
    if (claimed.count === 0) return

    const job = await db.projectUpdateJob.findUniqueOrThrow({ where: { id: jobId } })
    if (job.attemptCount > job.maxAttempts) {
      await db.projectUpdateJob.update({
        where: { id: jobId },
        data: { status: 'DEAD', lastError: 'Max attempts exceeded' },
      })
      return
    }

    try {
      const eventIds = job.sourceEventIds as string[]
      const events = await db.projectEvent.findMany({
        where: { id: { in: eventIds }, tenantId: job.tenantId, projectId: job.projectId },
        orderBy: { occurredAt: 'asc' },
      })
      if (events.length === 0) throw new HttpError(404, 'Source events not found')

      const recentActivity = await db.projectEvent.findMany({
        where: { tenantId: job.tenantId, projectId: job.projectId },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      })

      const draft = writerService.write(events, recentActivity)
      const update = await db.projectUpdate.create({
        data: {
          tenantId: job.tenantId,
          projectId: job.projectId,
          body: draft.body,
          confidence: draft.confidence,
          modelName: PROJECT_UPDATE_MODEL,
          modelVersion: PROJECT_UPDATE_MODEL_VERSION,
          sourceEventIds: events.map((e) => e.id),
          evidence: draft.evidence as unknown as Prisma.InputJsonValue,
        },
      })

      await db.projectUpdateJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          projectUpdateId: update.id,
          lastError: null,
        },
      })

      const feedItem = eventService.updateToFeedItem(update)
      eventService.broadcastFeedItem(job.tenantId, job.projectId, feedItem)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown job error'
      const retryAt = new Date(Date.now() + PUSH_BATCH_WINDOW_MS)
      const nextStatus = job.attemptCount >= job.maxAttempts ? 'DEAD' : 'FAILED'
      await db.projectUpdateJob.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          lastError: message,
          scheduledAt: retryAt,
          lockedAt: null,
          lockedBy: null,
        },
      })
      throw err
    }
  }
}

export type WriterDraft = {
  body: string
  confidence: number
  evidence: import('../lib/projectActivity').ProjectFeedEvidence
}