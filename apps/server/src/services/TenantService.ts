import { db } from '@timegems/db'

export class TenantService {
  async listMine(userId: string) {
    const memberships = await db.membership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    })
    return memberships.map((m) => ({ ...m.tenant, role: m.role }))
  }

  async create(userId: string, data: { name: string; slug: string }) {
    const existing = await db.tenant.findUnique({ where: { slug: data.slug } })
    if (existing) throw { statusCode: 409, message: 'Slug already taken' }

    const tenant = await db.tenant.create({ data: { name: data.name, slug: data.slug } })
    await db.membership.create({ data: { userId, tenantId: tenant.id, role: 'OWNER' } })
    return { ...tenant, role: 'OWNER' as const }
  }

  async selectActive(userId: string, token: string | undefined, tenantId: string) {
    const membership = await db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    })
    if (!membership) throw { statusCode: 403, message: 'Not a member of this tenant' }

    if (token) {
      await db.session.updateMany({ where: { token }, data: { activeTenantId: tenantId } })
    }
    return { ...membership.tenant, role: membership.role }
  }
}
