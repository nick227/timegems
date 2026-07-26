import { db } from '@timegems/db'

type Period = 'day' | 'month' | 'year'

function periodRange(period: Period, date: string) {
  const d = new Date(date)
  let start: Date
  let end: Date
  if (period === 'day') {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
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
    opts: { period: Period; date: string; scope: 'individual' | 'team'; teamId?: string },
  ) {
    const { start, end } = periodRange(opts.period, opts.date)

    let userIds: string[]
    if (opts.scope === 'individual') {
      userIds = [requesterId]
    } else {
      if (!opts.teamId) throw { statusCode: 400, message: 'teamId is required when scope=team' }
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

    const byKey = new Map<
      string,
      { projectId: string | null; projectName: string | null; userId: string; durationSec: number }
    >()
    let totalDurationSec = 0
    for (const session of sessions) {
      const key = `${session.userId}:${session.projectId ?? 'none'}`
      totalDurationSec += session.activeDurationSec
      const existing = byKey.get(key)
      if (existing) {
        existing.durationSec += session.activeDurationSec
      } else {
        byKey.set(key, {
          projectId: session.projectId,
          projectName: session.project?.name ?? null,
          userId: session.userId,
          durationSec: session.activeDurationSec,
        })
      }
    }

    return {
      period: opts.period,
      date: opts.date,
      scope: opts.scope,
      teamId: opts.teamId ?? null,
      totalDurationSec,
      entries: [...byKey.values()],
    }
  }
}
