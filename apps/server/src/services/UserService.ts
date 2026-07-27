import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'

export class UserService {
  async list(
    tenantId: string,
    opts: { cursor?: string; limit?: number; q?: string; excludeTeamId?: string },
  ) {
    if (opts.excludeTeamId) {
      const team = await db.team.findFirst({ where: { id: opts.excludeTeamId, tenantId }, select: { id: true } })
      if (!team) throw new HttpError(404, 'Team not found')
    }

    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const memberships = await db.membership.findMany({
      where: {
        tenantId,
        user: {
          ...(opts.q
            ? {
                OR: [
                  { name: { contains: opts.q } },
                  { email: { contains: opts.q } },
                ],
              }
            : {}),
          ...(opts.excludeTeamId
            ? { teamMemberships: { none: { teamId: opts.excludeTeamId } } }
            : {}),
        },
        ...cursorWhere(cursor),
      },
      include: { user: true },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    const { data, meta } = paginate(memberships, limit)
    return {
      data: data.map(({ user, role }) => ({ ...user, tenantRole: role })),
      meta,
    }
  }

  // Tenant-scoped: the requester's own tenantId (from their active session)
  // must have a Membership row for the target user too, same check
  // TeamService.addMembers already uses -- this prevents looking up an
  // arbitrary user platform-wide, only someone who shares a tenant with you.
  async get(tenantId: string, userId: string) {
    const membership = await db.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } })
    if (!membership) throw new HttpError(404, 'User not found')

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw new HttpError(404, 'User not found')
    return user
  }
}
