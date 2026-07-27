import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'

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
    if (existing) throw new HttpError(409, 'Slug already taken')

    const tenant = await db.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        memberships: { create: { userId, role: 'OWNER' } },
      },
    })
    return { ...tenant, role: 'OWNER' as const }
  }

  async selectActive(userId: string, token: string | undefined, tenantId: string) {
    const membership = await db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    })
    if (!membership) throw new HttpError(403, 'Not a member of this tenant')

    // Work sessions are globally single-active per user. Switching tenant
    // context mid-session would hide the controls for the existing session
    // while still preventing a new one from starting.
    const activeSession = await db.workSession.findFirst({
      where: { userId, status: { not: 'STOPPED' } },
      select: { tenantId: true },
    })
    if (activeSession && activeSession.tenantId !== tenantId) {
      throw new HttpError(409, 'Stop active work before switching tenants')
    }

    if (token) {
      await db.session.updateMany({ where: { token }, data: { activeTenantId: tenantId } })
    }
    return { ...membership.tenant, role: membership.role }
  }
}
