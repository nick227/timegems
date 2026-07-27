import { OAuth2Client } from 'google-auth-library'
import { db } from '@timegems/db'
import { randomUUID } from 'crypto'
import { HttpError } from '../lib/errors'
import { provisionPersonalTenant } from '../lib/provisionTenant'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class GoogleAuthService {
  // Shared by authenticate() (sign in/register) and claimWithGoogle()
  // (link to an already-logged-in, e.g. anonymous, user) -- both need the
  // exact same verify-and-extract-payload step.
  private async verifyCredential(credential: string) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new HttpError(503, 'Google sign-in is not configured')
    }
    if (!credential) throw new HttpError(400, 'Missing credential')

    let ticket
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
    } catch {
      throw new HttpError(400, 'Invalid Google credential')
    }

    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new HttpError(400, 'Invalid Google credential')
    }
    return payload
  }

  async authenticate(credential: string) {
    const payload = await this.verifyCredential(credential)
    const { sub: googleId, email, name, picture } = payload

    let user = await db.user.findUnique({ where: { googleId } })
    let newTenantId: string | undefined

    if (!user) {
      const displayName = name ?? email!.split('@')[0] ?? email!
      user = await db.user.create({
        data: {
          googleId,
          email,
          name: displayName,
          avatarUrl: picture ?? null,
        },
      })
      // First-ever sign-in: give them somewhere to land immediately rather
      // than a working account with zero tenants to act in.
      const tenant = await provisionPersonalTenant(user.id, displayName)
      newTenantId = tenant.id
    }

    if (user.suspendedAt) throw new HttpError(403, 'Account suspended')

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        activeTenantId: newTenantId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    return { user, token: session.token }
  }

  // Links a Google identity to the *current* (e.g. anonymous) user in place
  // -- never creates a second User row. If that Google identity already
  // belongs to someone else, this is a conflict, not a merge: sign out and
  // sign into the other account instead.
  async claimWithGoogle(userId: string, credential: string) {
    const payload = await this.verifyCredential(credential)
    const { sub: googleId, email, name, picture } = payload

    const existing = await db.user.findUnique({ where: { googleId } })
    if (existing && existing.id !== userId) {
      throw new HttpError(409, 'This Google account is already linked to a different user')
    }

    const current = await db.user.findUnique({ where: { id: userId } })
    if (!current) throw new HttpError(404, 'User not found')

    return db.user.update({
      where: { id: userId },
      data: {
        googleId,
        isAnonymous: false,
        // Don't clobber a name/email/avatar the user already set themselves.
        email: current.email ?? email,
        name: current.isAnonymous ? (name ?? current.name) : current.name,
        avatarUrl: current.avatarUrl ?? picture ?? null,
      },
    })
  }

  async logout(token: string) {
    await db.session.deleteMany({ where: { token } })
  }
}
