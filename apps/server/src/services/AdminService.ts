import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

function paginate<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
  return { data: items, meta: { hasMore, nextCursor } }
}

export class AdminService {
  async listTenants(opts: { cursor?: string; limit?: number; q?: string }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const tenants = await db.tenant.findMany({
      where: {
        ...(opts.q ? { name: { contains: opts.q } } : {}),
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
    return paginate(tenants, limit)
  }

  async updateTenant(tenantId: string, data: { plan?: 'FREE' | 'TEAM' | 'ENTERPRISE' }) {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw { statusCode: 404, message: 'Tenant not found' }
    return db.tenant.update({
      where: { id: tenantId },
      data: { ...(data.plan ? { plan: data.plan } : {}) },
    })
  }

  async listUsers(opts: { cursor?: string; limit?: number; q?: string }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const users = await db.user.findMany({
      where: {
        ...(opts.q ? { OR: [{ name: { contains: opts.q } }, { email: { contains: opts.q } }] } : {}),
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
    return paginate(users, limit)
  }

  async updateUser(userId: string, data: { suspended?: boolean }) {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }
    if (data.suspended === undefined) return user
    return db.user.update({
      where: { id: userId },
      data: { suspendedAt: data.suspended ? new Date() : null },
    })
  }
}
