import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { HttpError } from '../lib/errors'

export class AdminService {
  async listTenants(opts: { cursor?: string; limit?: number; q?: string }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const tenants = await db.tenant.findMany({
      where: {
        ...(opts.q ? { name: { contains: opts.q } } : {}),
        ...cursorWhere(cursor),
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(tenants, limit)
  }

  async updateTenant(tenantId: string, data: { plan?: 'FREE' | 'TEAM' | 'ENTERPRISE' }) {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new HttpError(404, 'Tenant not found')
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
        ...cursorWhere(cursor),
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(users, limit)
  }

  async updateUser(userId: string, data: { suspended?: boolean }) {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw new HttpError(404, 'User not found')
    if (data.suspended === undefined) return user
    return db.user.update({
      where: { id: userId },
      data: { suspendedAt: data.suspended ? new Date() : null },
    })
  }
}
