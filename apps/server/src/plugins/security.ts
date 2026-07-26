import { db } from '@timegems/db'

export async function bearerAuth(request: any, _reply: any, _params: any) {
  // cookie-first (web); Bearer header fallback (native apps)
  const token =
    request.cookies?.token ??
    request.headers.authorization?.replace('Bearer ', '')

  if (!token) throw { statusCode: 401, message: 'Unauthorized' }

  const session = await db.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) {
    throw { statusCode: 401, message: 'Session expired' }
  }

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) throw { statusCode: 401, message: 'Session expired' }
  if (user.suspendedAt) throw { statusCode: 403, message: 'Account suspended' }

  request.user = user
  // Which tenant this request is scoped to -- set by POST /tenants/{id}/select.
  // Handlers for tenant-scoped routes call requireTenantId(request), which
  // throws 400 if this is null (no active tenant chosen yet).
  request.tenantId = session.activeTenantId ?? null
}

// Site admin -- a platform-level capability (AdminUser), not a tenant role.
export async function adminAuth(request: any, reply: any, params: any) {
  await bearerAuth(request, reply, params)
  const admin = await db.adminUser.findUnique({ where: { userId: request.user.id } })
  if (!admin) throw { statusCode: 403, message: 'Forbidden' }
  request.admin = admin
}
