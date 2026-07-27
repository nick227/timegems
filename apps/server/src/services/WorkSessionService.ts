import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { GemService } from './GemService'
import { AgentEmployeeService } from './AgentEmployeeService'
import { HttpError } from '../lib/errors'
import { requireWorkSessionTenantAccess } from '../lib/workSessionAccess'
import { sanitizeRichText } from '../lib/sanitizeHtml'
import { generateSessionName } from '../lib/sessionName'

const gemService = new GemService()
const agentEmployeeService = new AgentEmployeeService()

// UserActiveSession's guard row stores this instead of a literal null for
// an unassigned session's projectId. MySQL's unique index treats every NULL
// as distinct, so two real nulls would never collide -- which is exactly
// wrong here, since "no project" should still only allow one concurrent
// session per user, same as any real project would. A non-null sentinel
// makes @@unique([userId, projectId]) actually enforce that bucket too.
const UNASSIGNED_PROJECT_GUARD = '__unassigned__'

const detailInclude = {
  notes: { orderBy: { createdAt: 'asc' as const } },
  intervals: { orderBy: { startedAt: 'asc' as const } },
  project: { include: { gemType: true } },
  goal: true,
  user: true,
  gemLedgerEntry: true,
}

// A goal scoped to a project can only be tagged onto a session for that same
// project -- otherwise a goal's loggedSec/progress would silently mix time
// from work it wasn't scoped to. A goal with no projectId (team/tenant-wide)
// has no such constraint.
async function validateGoalForSession(tenantId: string, goalId: string, projectId: string | null | undefined) {
  const goal = await db.goal.findFirst({ where: { id: goalId, tenantId } })
  if (!goal) throw new HttpError(404, 'Goal not found')
  if (goal.projectId && goal.projectId !== projectId) {
    throw new HttpError(409, "Goal belongs to a different project than this session's")
  }
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

// WorkSessionDetail (the OpenAPI schema) has a flat `gemsAwarded` field, not
// the raw ledger relation -- strip the relation, surface just the number.
function toDetail<T extends { gemLedgerEntry: { gemsAwarded: number } | null }>(session: T) {
  const { gemLedgerEntry, ...rest } = session
  return { ...rest, gemsAwarded: gemLedgerEntry?.gemsAwarded ?? null }
}

export class WorkSessionService {
  // A user can have several concurrent active sessions -- one per project
  // (or one unassigned one; see UserActiveSession's schema comment) -- so
  // this is a list, not a single nullable session.
  async listActive(tenantId: string, userId: string) {
    const sessions = await db.workSession.findMany({
      where: { tenantId, userId, status: { not: 'STOPPED' } },
      include: detailInclude,
      orderBy: cursorOrderBy,
    })
    return sessions.map(toDetail)
  }

  async start(tenantId: string, userId: string, projectId?: string | null, goalId?: string | null) {
    if (projectId) {
      const project = await db.project.findFirst({ where: { id: projectId, tenantId } })
      if (!project) throw new HttpError(404, 'Project not found')
    }
    if (goalId) await validateGoalForSession(tenantId, goalId, projectId ?? null)

    try {
      return await db.$transaction(async (tx) => {
        const now = new Date()
        const session = await tx.workSession.create({
          data: {
            tenantId,
            userId,
            projectId: projectId ?? null,
            goalId: goalId ?? null,
            name: generateSessionName(),
            status: 'RUNNING',
            startedAt: now,
            intervals: { create: [{ kind: 'ACTIVE', startedAt: now }] },
          },
          include: detailInclude,
        })

        // @@unique([userId, projectId]) is the actual guard. Concurrent
        // starts *for the same project* (or two unassigned starts, via the
        // sentinel) may both create their WorkSession, but only one guard
        // insert can commit; the losing transaction rolls its newly-created
        // session back. Starts for two different real projects don't
        // contend at all.
        await tx.userActiveSession.create({
          data: { userId, projectId: projectId ?? UNASSIGNED_PROJECT_GUARD, workSessionId: session.id, createdAt: now },
        })
        return toDetail(session)
      })
    } catch (error) {
      if ((error as any)?.code === 'P2002') {
        throw new HttpError(409, projectId ? 'An active session already exists for this project' : 'An active unassigned session already exists')
      }
      throw error
    }
  }

  private async getOwned(tenantId: string, userId: string, workSessionId: string) {
    const session = await db.workSession.findFirst({
      where: { id: workSessionId, tenantId },
      include: detailInclude,
    })
    if (!session) throw new HttpError(404, 'Work session not found')
    if (session.userId !== userId) throw new HttpError(403, 'Forbidden')
    return session
  }

  async pause(tenantId: string, userId: string, workSessionId: string) {
    return db.$transaction(async (tx) => {
      const session = await tx.workSession.findFirst({
        where: { id: workSessionId, tenantId },
        select: { userId: true },
      })
      if (!session) throw new HttpError(404, 'Work session not found')
      if (session.userId !== userId) throw new HttpError(403, 'Forbidden')

      const transitioned = await tx.workSession.updateMany({
        where: { id: workSessionId, status: 'RUNNING' },
        data: { status: 'PAUSED' },
      })
      if (transitioned.count !== 1) throw new HttpError(409, 'Session is not running')

      const now = new Date()
      await tx.workSessionInterval.updateMany({
        where: { workSessionId, endedAt: null },
        data: { endedAt: now },
      })
      await tx.workSessionInterval.create({
        data: { workSessionId, kind: 'PAUSED', startedAt: now },
      })

      const updated = await tx.workSession.findUniqueOrThrow({
        where: { id: workSessionId },
        include: detailInclude,
      })
      return toDetail(updated)
    })
  }

  async resume(tenantId: string, userId: string, workSessionId: string) {
    return db.$transaction(async (tx) => {
      const session = await tx.workSession.findFirst({
        where: { id: workSessionId, tenantId },
        select: { userId: true },
      })
      if (!session) throw new HttpError(404, 'Work session not found')
      if (session.userId !== userId) throw new HttpError(403, 'Forbidden')

      const transitioned = await tx.workSession.updateMany({
        where: { id: workSessionId, status: { in: ['PAUSED', 'REVIEWING'] } },
        data: { status: 'RUNNING' },
      })
      if (transitioned.count !== 1) throw new HttpError(409, 'Session cannot be resumed')

      const now = new Date()
      await tx.workSessionInterval.updateMany({
        where: { workSessionId, endedAt: null },
        data: { endedAt: now },
      })
      await tx.workSessionInterval.create({
        data: { workSessionId, kind: 'ACTIVE', startedAt: now },
      })

      const updated = await tx.workSession.findUniqueOrThrow({
        where: { id: workSessionId },
        include: detailInclude,
      })
      return toDetail(updated)
    })
  }

  async review(tenantId: string, userId: string, workSessionId: string) {
    return db.$transaction(async (tx) => {
      const session = await tx.workSession.findFirst({
        where: { id: workSessionId, tenantId },
        select: { userId: true },
      })
      if (!session) throw new HttpError(404, 'Work session not found')
      if (session.userId !== userId) throw new HttpError(403, 'Forbidden')

      const transitioned = await tx.workSession.updateMany({
        where: { id: workSessionId, status: { in: ['RUNNING', 'PAUSED'] } },
        data: { status: 'REVIEWING' },
      })
      if (transitioned.count !== 1) throw new HttpError(409, 'Session cannot enter review')

      // REVIEWING deliberately has no open interval: the user's Stop action
      // must stop authoritative server-side timing before review begins.
      await tx.workSessionInterval.updateMany({
        where: { workSessionId, endedAt: null },
        data: { endedAt: new Date() },
      })

      const updated = await tx.workSession.findUniqueOrThrow({
        where: { id: workSessionId },
        include: detailInclude,
      })
      return toDetail(updated)
    })
  }

  async stop(tenantId: string, userId: string, workSessionId: string, note?: string) {
    const stopped = await db.$transaction(
      async (tx) => {
        const session = await tx.workSession.findFirst({
          where: { id: workSessionId, tenantId },
          include: { intervals: true },
        })
        if (!session) throw new HttpError(404, 'Work session not found')
        if (session.userId !== userId) throw new HttpError(403, 'Forbidden')

        const now = new Date()
        const transitioned = await tx.workSession.updateMany({
          where: { id: workSessionId, status: 'REVIEWING' },
          data: { status: 'STOPPED', stoppedAt: now },
        })
        if (transitioned.count !== 1) throw new HttpError(409, 'Session is not awaiting review')

        await tx.workSessionInterval.updateMany({
          where: { workSessionId, endedAt: null },
          data: { endedAt: now },
        })
        const intervals = session.intervals.map((interval) =>
          interval.endedAt === null ? { ...interval, endedAt: now } : interval,
        )
        const activeDurationSec = sumActiveSeconds(intervals, now)

        await tx.workSession.update({
          where: { id: workSessionId },
          data: { activeDurationSec },
        })
        if (note) {
          await tx.note.create({
            data: {
              workSessionId,
              authorId: userId,
              body: sanitizeRichText(note),
              isStopSummary: true,
            },
          })
        }
        if (session.projectId) {
          await gemService.settleStoppedSession(tx, {
            id: session.id,
            tenantId: session.tenantId,
            userId,
            projectId: session.projectId,
            activeDurationSec,
          })
        }
        await tx.userActiveSession.deleteMany({
          where: { userId, workSessionId },
        })

        return tx.workSession.findUniqueOrThrow({
          where: { id: workSessionId },
          include: detailInclude,
        })
      },
      { maxWait: 5_000, timeout: 30_000 },
    )

    // Fire-and-forget -- a stopped session is "new activity" for on-change
    // agent employees. Never awaited: a slow/failing agent run must not
    // delay or break the response to the person who was just working.
    void agentEmployeeService.runOnChangeForTenant(stopped.tenantId)

    return toDetail(stopped)
  }

  async update(
    tenantId: string,
    userId: string,
    workSessionId: string,
    data: { projectId?: string | null; goalId?: string | null; activeDurationSec?: number },
    canManageSessions = false,
  ) {
    const session = await db.workSession.findFirst({
      where: { id: workSessionId, tenantId },
      include: detailInclude,
    })
    if (!session) throw new HttpError(404, 'Work session not found')
    const isOwner = session.userId === userId
    if (!isOwner && !(canManageSessions && session.status === 'STOPPED')) {
      throw new HttpError(403, 'Forbidden')
    }

    if (data.activeDurationSec !== undefined && session.status !== 'STOPPED') {
      throw new HttpError(409, 'Can only correct the duration of a stopped session')
    }
    if (data.projectId) {
      const project = await db.project.findFirst({ where: { id: data.projectId, tenantId } })
      if (!project) throw new HttpError(404, 'Project not found')
    }
    const effectiveProjectId = data.projectId !== undefined ? data.projectId : session.projectId
    const effectiveGoalId = data.goalId !== undefined ? data.goalId : session.goalId
    if (effectiveGoalId) await validateGoalForSession(tenantId, effectiveGoalId, effectiveProjectId)

    const hasChanges =
      data.projectId !== undefined ||
      data.goalId !== undefined ||
      data.activeDurationSec !== undefined
    if (!hasChanges) return toDetail(session)

    if (session.status !== 'STOPPED') {
      const updated = await db.workSession.update({
        where: { id: workSessionId },
        data,
        include: detailInclude,
      })
      return toDetail(updated)
    }

    const updated = await db.$transaction(
      async (tx) => {
        await tx.workSession.update({
          where: { id: workSessionId },
          data: { ...data, correctedAt: new Date() },
        })

        // Moving a finalized session affects both ledgers. Acquire accounts
        // in stable project-id order so concurrent cross-project corrections
        // cannot deadlock by locking the same two accounts in reverse order.
        const affectedProjectIds = [...new Set([session.projectId, effectiveProjectId].filter((id): id is string => !!id))].sort()
        for (const projectId of affectedProjectIds) {
          await gemService.recomputeInTransaction(tx, session.userId, projectId)
        }

        return tx.workSession.findUniqueOrThrow({
          where: { id: workSessionId },
          include: detailInclude,
        })
      },
      { maxWait: 5_000, timeout: 30_000 },
    )

    return toDetail(updated)
  }

  async delete(tenantId: string, userId: string, workSessionId: string, canManageSessions = false) {
    const session = await db.workSession.findFirst({
      where: { id: workSessionId, tenantId },
      include: detailInclude,
    })
    if (!session) throw new HttpError(404, 'Work session not found')
    if (session.userId !== userId && !canManageSessions) throw new HttpError(403, 'Forbidden')
    if (session.status !== 'STOPPED') {
      throw new HttpError(409, 'Only a stopped session can be deleted')
    }
    const { projectId } = session

    await db.$transaction(
      async (tx) => {
        // FK order matters: coordination and ledger rows reference the session.
        await tx.userActiveSession.deleteMany({ where: { workSessionId } })
        await tx.gemLedgerEntry.deleteMany({ where: { workSessionId } })
        await tx.note.deleteMany({ where: { workSessionId } })
        await tx.workSessionInterval.deleteMany({ where: { workSessionId } })
        await tx.workSession.delete({ where: { id: workSessionId } })
        if (projectId) {
          await gemService.recomputeInTransaction(tx, session.userId, projectId)
        }
      },
      { maxWait: 5_000, timeout: 30_000 },
    )
  }

  async get(userId: string, workSessionId: string) {
    const session = await db.workSession.findFirst({ where: { id: workSessionId }, include: detailInclude })
    if (!session) throw new HttpError(404, 'Work session not found')
    await requireWorkSessionTenantAccess(userId, session.tenantId)
    return toDetail(session)
  }

  async list(
    tenantId: string,
    opts: {
      cursor?: string
      limit?: number
      userId?: string
      projectId?: string
      goalId?: string
      teamId?: string
      status?: 'RUNNING' | 'PAUSED' | 'REVIEWING' | 'STOPPED'
      from?: string
      to?: string
    },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const sessions = await db.workSession.findMany({
      where: {
        tenantId,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.goalId ? { goalId: opts.goalId } : {}),
        ...(opts.teamId ? { project: { teamId: opts.teamId } } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.from || opts.to
          ? {
              startedAt: {
                ...(opts.from ? { gte: new Date(opts.from) } : {}),
                ...(opts.to ? { lt: new Date(opts.to) } : {}),
              },
            }
          : {}),
        ...cursorWhere(cursor),
      },
      include: {
        project: { include: { gemType: true } },
        goal: true,
        user: true,
        notes: { orderBy: { createdAt: 'asc' } },
        gemLedgerEntry: true,
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    const page = paginate(sessions, limit)
    return { ...page, data: page.data.map(toDetail) }
  }
}
