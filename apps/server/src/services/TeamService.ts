import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

export class TeamService {
  async list(tenantId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const teams = await db.team.findMany({
      where: {
        tenantId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return this.paginate(teams, limit)
  }

  async create(tenantId: string, data: { name: string }) {
    return db.team.create({ data: { tenantId, name: data.name } })
  }

  async get(tenantId: string, teamId: string) {
    const team = await db.team.findFirst({ where: { id: teamId, tenantId } })
    if (!team) throw { statusCode: 404, message: 'Team not found' }
    return team
  }

  async update(tenantId: string, teamId: string, data: { name?: string }) {
    await this.get(tenantId, teamId)
    return db.team.update({ where: { id: teamId }, data })
  }

  async listMembers(tenantId: string, teamId: string, opts: { cursor?: string; limit?: number }) {
    await this.get(tenantId, teamId)
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const memberships = await db.teamMembership.findMany({
      where: {
        teamId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const { data, meta } = this.paginate(memberships, limit)
    return { data: data.map((m) => m.user), meta }
  }

  async addMember(tenantId: string, teamId: string, userId: string) {
    await this.get(tenantId, teamId)
    const membership = await db.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } })
    if (!membership) throw { statusCode: 400, message: 'User is not a member of this tenant' }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }

    await db.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId },
      update: {},
    })
    return user
  }

  async removeMember(tenantId: string, teamId: string, userId: string) {
    await this.get(tenantId, teamId)
    await db.teamMembership.deleteMany({ where: { teamId, userId } })
  }

  private paginate<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }
}
