import { db } from '@timegems/db'

// login/register/googleAuth all declare `security: []` (no bearerAuth) --
// there's no user to authenticate yet, that's the whole point of these
// endpoints. But the incoming request may still carry a cookie/token from
// an *existing* session (almost always true: AuthGuard auto-provisions a
// guest for anyone unauthenticated, so a first-time visitor hitting /login
// already holds one). This mirrors bearerAuth's own token resolution
// (plugins/security.ts) but never throws -- absent/expired/invalid just
// means "no current session," not an error, since having one is optional
// context here, not a requirement.
export async function currentAnonymousUserId(request: any): Promise<string | null> {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (!token) return null

  const session = await db.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) return null

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user || !user.isAnonymous || user.deletedAt) return null
  return user.id
}
