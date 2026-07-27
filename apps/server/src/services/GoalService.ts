import { db, type GoalStatus } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { HttpError } from '../lib/errors'
import { sanitizeRichText } from '../lib/sanitizeHtml'

// Live aggregate, not a stored field -- always in sync with the WorkSessions
// actually tagged with a goal, same "derived, not replicated" reasoning as
// WorkSessionDetail's computed gemsAwarded. Only STOPPED sessions have a
// finalized activeDurationSec (see WorkSessionService), so only those count.
async function loggedSecByGoal(goalIds: string[]) {
  if (goalIds.length === 0) return new Map<string, number>()
  const rows = await db.workSession.groupBy({
    by: ['goalId'],
    where: { goalId: { in: goalIds }, status: 'STOPPED' },
    _sum: { activeDurationSec: true },
  })
  return new Map(rows.map((r) => [r.goalId as string, r._sum.activeDurationSec ?? 0]))
}

function withLoggedSec<T extends { id: string }>(goal: T, loggedSec: Map<string, number>) {
  return { ...goal, loggedSec: loggedSec.get(goal.id) ?? 0 }
}

export class GoalService {
  async list(tenantId: string, opts: { cursor?: string; limit?: number; status?: string; projectId?: string }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const goals = await db.goal.findMany({
      where: {
        tenantId,
        ...(opts.status ? { status: opts.status as any } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...cursorWhere(cursor),
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    const { data, meta } = paginate(goals, limit)
    const loggedSec = await loggedSecByGoal(data.map((g) => g.id))
    return { data: data.map((g) => withLoggedSec(g, loggedSec)), meta }
  }

  private async assertBelongsToTenant(tenantId: string, opts: { teamId?: string | null; projectId?: string | null }) {
    if (opts.teamId) {
      const team = await db.team.findFirst({ where: { id: opts.teamId, tenantId } })
      if (!team) throw new HttpError(404, 'Team not found')
    }
    if (opts.projectId) {
      const project = await db.project.findFirst({ where: { id: opts.projectId, tenantId } })
      if (!project) throw new HttpError(404, 'Project not found')
    }
  }

  // Humans authoring their own goal don't need to approve it -- PROPOSED is
  // reserved for the Steering agent, whose whole point is that it can only
  // propose. This is the other half of that rule: it must be possible for a
  // human to create a goal that's immediately real, not just to react to one.
  async create(
    tenantId: string,
    userId: string,
    input: { title: string; description: string; teamId?: string | null; projectId?: string | null; complexityScore?: number; estimatedHours?: number | null },
  ) {
    await this.assertBelongsToTenant(tenantId, input)
    const goal = await db.goal.create({
      data: {
        tenantId,
        createdByUserId: userId,
        title: input.title,
        description: sanitizeRichText(input.description),
        teamId: input.teamId ?? null,
        projectId: input.projectId ?? null,
        complexityScore: input.complexityScore ?? 3,
        estimatedHours: input.estimatedHours ?? null,
        status: 'ACTIVE',
      },
    })
    return withLoggedSec(goal, await loggedSecByGoal([goal.id]))
  }

  async importProjectGoals(
    tenantId: string,
    userId: string,
    projectId: string,
    goals: {
      title: string
      description: string
      complexityScore?: number
      estimatedHours?: number | null
    }[],
  ) {
    return db.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id: projectId, tenantId }, select: { id: true } })
      if (!project) throw new HttpError(404, 'Project not found')

      const created = await tx.goal.createMany({
        data: goals.map((goal) => ({
          tenantId,
          createdByUserId: userId,
          projectId,
          title: goal.title,
          description: sanitizeRichText(goal.description),
          complexityScore: goal.complexityScore ?? 3,
          estimatedHours: goal.estimatedHours ?? null,
          status: 'ACTIVE',
        })),
      })
      return { imported: created.count }
    })
  }

  async update(
    tenantId: string,
    goalId: string,
    input: {
      title?: string
      description?: string
      projectId?: string | null
      status?: GoalStatus
      progressPercent?: number
      complexityScore?: number
      estimatedHours?: number | null
    },
  ) {
    const goal = await db.goal.findFirst({ where: { id: goalId, tenantId } })
    if (!goal) throw new HttpError(404, 'Goal not found')
    if (input.projectId !== undefined) await this.assertBelongsToTenant(tenantId, { projectId: input.projectId })

    const updated = await db.goal.update({
      where: { id: goalId },
      data: {
        ...input,
        ...(input.description !== undefined ? { description: sanitizeRichText(input.description) } : {}),
      },
    })
    return withLoggedSec(updated, await loggedSecByGoal([updated.id]))
  }
}
