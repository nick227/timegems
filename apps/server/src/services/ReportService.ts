import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'

type Period = 'day' | 'week' | 'month' | 'year'

function periodRange(period: Period, date: string) {
  const d = new Date(date)
  let start: Date
  let end: Date
  if (period === 'day') {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
  } else if (period === 'week') {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const mondayOffset = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - mondayOffset)
    end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
  } else if (period === 'month') {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
  } else {
    start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    end = new Date(start)
    end.setUTCFullYear(end.getUTCFullYear() + 1)
  }
  return { start, end }
}

export class ReportService {
  async timeSummary(
    tenantId: string,
    requesterId: string,
    opts: { period: Period; date: string; scope: 'individual' | 'team'; teamId?: string; from?: string; to?: string },
  ) {
    if (!!opts.from !== !!opts.to) throw new HttpError(400, 'from and to must be supplied together')
    const fallbackRange = periodRange(opts.period, opts.date)
    const start = opts.from ? new Date(opts.from) : fallbackRange.start
    const end = opts.to ? new Date(opts.to) : fallbackRange.end
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new HttpError(400, 'Invalid reporting range')
    }

    let userIds: string[]
    if (opts.scope === 'individual') {
      userIds = [requesterId]
    } else {
      if (!opts.teamId) throw new HttpError(400, 'teamId is required when scope=team')
      const team = await db.team.findFirst({
        where: { id: opts.teamId, tenantId },
        select: { id: true },
      })
      if (!team) throw new HttpError(404, 'Team not found')
      const memberships = await db.teamMembership.findMany({ where: { teamId: opts.teamId }, select: { userId: true } })
      userIds = memberships.map((m) => m.userId)
    }

    const sessions = await db.workSession.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        status: 'STOPPED',
        startedAt: { gte: start, lt: end },
      },
      include: { project: true },
    })

    const ledgerEntries = await db.gemLedgerEntry.findMany({
      where: { workSessionId: { in: sessions.map((s) => s.id) } },
      select: { workSessionId: true, gemsAwarded: true },
    })
    const gemsBySessionId = new Map(ledgerEntries.map((e) => [e.workSessionId, e.gemsAwarded]))

    const byKey = new Map<
      string,
      { projectId: string | null; projectName: string | null; userId: string; durationSec: number; gemsEarned: number }
    >()
    let totalDurationSec = 0
    let totalGemsEarned = 0
    for (const session of sessions) {
      const key = `${session.userId}:${session.projectId ?? 'none'}`
      const gems = gemsBySessionId.get(session.id) ?? 0
      totalDurationSec += session.activeDurationSec
      totalGemsEarned += gems
      const existing = byKey.get(key)
      if (existing) {
        existing.durationSec += session.activeDurationSec
        existing.gemsEarned += gems
      } else {
        byKey.set(key, {
          projectId: session.projectId,
          projectName: session.project?.name ?? null,
          userId: session.userId,
          durationSec: session.activeDurationSec,
          gemsEarned: gems,
        })
      }
    }

    return {
      period: opts.period,
      date: opts.date,
      scope: opts.scope,
      teamId: opts.teamId ?? null,
      totalDurationSec,
      totalGemsEarned,
      sessionCount: sessions.length,
      projectsWorked: new Set(sessions.flatMap((session) => session.projectId ? [session.projectId] : [])).size,
      goalsAdvanced: new Set(sessions.flatMap((session) => session.goalId ? [session.goalId] : [])).size,
      entries: [...byKey.values()],
    }
  }
}
