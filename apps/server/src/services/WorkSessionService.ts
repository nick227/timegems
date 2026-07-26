import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

const detailInclude = {
  notes: { orderBy: { createdAt: 'asc' as const } },
  intervals: { orderBy: { startedAt: 'asc' as const } },
  project: true,
  user: true,
}

function sumActiveSeconds(intervals: { kind: string; startedAt: Date; endedAt: Date | null }[], now: Date) {
  let total = 0
  for (const interval of intervals) {
    if (interval.kind !== 'ACTIVE') continue
    const end = interval.endedAt ?? now
    total += Math.max(0, Math.floor((end.getTime() - interval.startedAt.getTime()) / 1000))
  }
  return total
}

export class WorkSessionService {
  async getActive(userId: string) {
    return db.workSession.findFirst({
      where: { userId, status: { not: 'STOPPED' } },
      include: detailInclude,
    })
  }

  async start(tenantId: string, userId: string, projectId?: string | null) {
    const existing = await db.workSession.findFirst({ where: { userId, status: { not: 'STOPPED' } } })
    if (existing) throw { statusCode: 409, message: 'An active session already exists' }

    if (projectId) {
      const project = await db.project.findFirst({ where: { id: projectId, tenantId } })
      if (!project) throw { statusCode: 404, message: 'Project not found' }
    }

    const now = new Date()
    return db.workSession.create({
      data: {
        tenantId,
        userId,
        projectId: projectId ?? null,
        status: 'RUNNING',
        startedAt: now,
        intervals: { create: [{ kind: 'ACTIVE', startedAt: now }] },
      },
      include: detailInclude,
    })
  }

  private async getOwned(userId: string, workSessionId: string) {
    const session = await db.workSession.findUnique({ where: { id: workSessionId }, include: detailInclude })
    if (!session) throw { statusCode: 404, message: 'Work session not found' }
    if (session.userId !== userId) throw { statusCode: 403, message: 'Forbidden' }
    return session
  }

  async pause(userId: string, workSessionId: string) {
    const session = await this.getOwned(userId, workSessionId)
    if (session.status !== 'RUNNING') throw { statusCode: 409, message: 'Session is not running' }

    const now = new Date()
    const openInterval = session.intervals.find((i) => i.endedAt === null)
    await db.$transaction([
      ...(openInterval
        ? [db.workSessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: now } })]
        : []),
      db.workSessionInterval.create({ data: { workSessionId, kind: 'PAUSED', startedAt: now } }),
      db.workSession.update({ where: { id: workSessionId }, data: { status: 'PAUSED' } }),
    ])
    return this.getOwned(userId, workSessionId)
  }

  async resume(userId: string, workSessionId: string) {
    const session = await this.getOwned(userId, workSessionId)
    if (session.status !== 'PAUSED') throw { statusCode: 409, message: 'Session is not paused' }

    const now = new Date()
    const openInterval = session.intervals.find((i) => i.endedAt === null)
    await db.$transaction([
      ...(openInterval
        ? [db.workSessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: now } })]
        : []),
      db.workSessionInterval.create({ data: { workSessionId, kind: 'ACTIVE', startedAt: now } }),
      db.workSession.update({ where: { id: workSessionId }, data: { status: 'RUNNING' } }),
    ])
    return this.getOwned(userId, workSessionId)
  }

  async stop(userId: string, workSessionId: string, note?: string) {
    const session = await this.getOwned(userId, workSessionId)
    if (session.status === 'STOPPED') throw { statusCode: 409, message: 'Session is already stopped' }

    const now = new Date()
    const openInterval = session.intervals.find((i) => i.endedAt === null)
    if (openInterval) {
      await db.workSessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: now } })
    }
    const intervals = session.intervals.map((i) => (i.id === openInterval?.id ? { ...i, endedAt: now } : i))
    const activeDurationSec = sumActiveSeconds(intervals, now)

    await db.workSession.update({
      where: { id: workSessionId },
      data: { status: 'STOPPED', stoppedAt: now, activeDurationSec },
    })
    if (note) {
      await db.note.create({ data: { workSessionId, authorId: userId, body: note, isStopSummary: true } })
    }
    return this.getOwned(userId, workSessionId)
  }

  async update(userId: string, workSessionId: string, data: { projectId?: string | null }) {
    const session = await this.getOwned(userId, workSessionId)
    if (session.status === 'STOPPED') throw { statusCode: 409, message: 'Session is already stopped' }

    if (data.projectId) {
      const project = await db.project.findFirst({ where: { id: data.projectId, tenantId: session.tenantId } })
      if (!project) throw { statusCode: 404, message: 'Project not found' }
    }
    await db.workSession.update({ where: { id: workSessionId }, data: { projectId: data.projectId ?? null } })
    return this.getOwned(userId, workSessionId)
  }

  async get(tenantId: string, workSessionId: string) {
    const session = await db.workSession.findFirst({ where: { id: workSessionId, tenantId }, include: detailInclude })
    if (!session) throw { statusCode: 404, message: 'Work session not found' }
    return session
  }

  async list(
    tenantId: string,
    opts: {
      cursor?: string
      limit?: number
      userId?: string
      projectId?: string
      teamId?: string
      from?: string
      to?: string
    },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const where: any = {
      tenantId,
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.teamId ? { project: { teamId: opts.teamId } } : {}),
      ...(opts.from || opts.to
        ? {
            startedAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to) } : {}),
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    }
    const sessions = await db.workSession.findMany({
      where,
      include: { project: true, user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = sessions.length > limit
    const items = hasMore ? sessions.slice(0, limit) : sessions
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }
}
