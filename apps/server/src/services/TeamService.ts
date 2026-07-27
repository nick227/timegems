import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { HttpError } from '../lib/errors'

export class TeamService {
  async list(tenantId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const teams = await db.team.findMany({
      where: { tenantId, ...cursorWhere(cursor) },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(teams, limit)
  }

  async create(tenantId: string, data: { name: string }) {
    return db.team.create({ data: { tenantId, name: data.name } })
  }

  async get(tenantId: string, teamId: string) {
    const team = await db.team.findFirst({ where: { id: teamId, tenantId } })
    if (!team) throw new HttpError(404, 'Team not found')
    return team
  }

  async update(tenantId: string, teamId: string, data: { name?: string }) {
    await this.get(tenantId, teamId)
    return db.team.update({ where: { id: teamId }, data })
  }

  async listMembers(tenantId: string, teamId: string, opts: { cursor?: string; limit?: number; q?: string }) {
    await this.get(tenantId, teamId)
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const memberships = await db.teamMembership.findMany({
      where: {
        teamId,
        user: {
          memberships: { some: { tenantId } },
          ...(opts.q
            ? {
                OR: [
                  { name: { contains: opts.q } },
                  { email: { contains: opts.q } },
                ],
              }
            : {}),
        },
        ...cursorWhere(cursor),
      },
      include: {
        user: {
          include: {
            memberships: {
              where: { tenantId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    const { data, meta } = paginate(memberships, limit)
    return {
      data: data.map((membership) => {
        const { memberships, ...user } = membership.user
        return { ...user, tenantRole: memberships[0]!.role }
      }),
      meta,
    }
  }

  async addMembers(tenantId: string, teamId: string, userIds: string[]) {
    await this.get(tenantId, teamId)
    const memberships = await db.membership.findMany({
      where: { tenantId, userId: { in: userIds } },
      include: { user: true },
    })
    if (memberships.length !== userIds.length) {
      throw new HttpError(400, 'Every selected user must be a member of this tenant')
    }

    await db.teamMembership.createMany({
      data: userIds.map((userId) => ({ teamId, userId })),
      skipDuplicates: true,
    })
    const byUserId = new Map(memberships.map((membership) => [membership.userId, membership]))
    return userIds.map((userId) => {
      const membership = byUserId.get(userId)!
      return { ...membership.user, tenantRole: membership.role }
    })
  }

  async removeMember(tenantId: string, teamId: string, userId: string) {
    await this.get(tenantId, teamId)
    await db.teamMembership.deleteMany({ where: { teamId, userId } })
  }
}
