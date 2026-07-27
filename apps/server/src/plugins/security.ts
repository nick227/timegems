import { db } from '@timegems/db'
import { HttpError } from '../lib/errors'

export async function bearerAuth(request: any, _reply: any, _params: any) {
  // cookie-first (web); Bearer header fallback (native apps)
  const token =
    request.cookies?.token ??
    request.headers.authorization?.replace('Bearer ', '')

  if (!token) throw new HttpError(401, 'Unauthorized')

  const session = await db.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) {
    throw new HttpError(401, 'Session expired')
  }

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) throw new HttpError(401, 'Session expired')
  if (user.suspendedAt) throw new HttpError(403, 'Account suspended')

  request.user = user
  request.auth = {
    userId: user.id,
    sessionId: session.id,
  }

  // The session remembers a preferred tenant, but membership remains the
  // authority. Revalidate it on every request so revocation takes effect
  // immediately even if clearing old session rows fails or is delayed.
  if (session.activeTenantId) {
    const membership = await db.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: session.activeTenantId,
        },
      },
    })
    if (!membership) {
      request.auth.tenantAccessRevoked = true
    } else {
      Object.assign(request.auth, {
        tenantId: membership.tenantId,
        membershipId: membership.id,
        membershipRole: membership.role,
      })
    }
  }
}

// Site admin -- a platform-level capability (AdminUser), not a tenant role.
export async function adminAuth(request: any, reply: any, params: any) {
  await bearerAuth(request, reply, params)
  const admin = await db.adminUser.findUnique({ where: { userId: request.user.id } })
  if (!admin) throw new HttpError(403, 'Forbidden')
  request.admin = admin
}
