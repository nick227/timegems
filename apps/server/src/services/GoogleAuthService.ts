import { OAuth2Client } from 'google-auth-library'
import { db } from '@timegems/db'
import { randomUUID } from 'crypto'
import { HttpError } from '../lib/errors'
import { provisionPersonalTenant, syncPersonalTenantName } from '../lib/provisionTenant'
import { GuestMergeService } from './GuestMergeService'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const guestMergeService = new GuestMergeService()

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

  // `guestUserId` is the caller's current session's user, if any, and only
  // when still anonymous (see currentAnonymousUserId) -- this is genuinely
  // authenticating as a *different* User row than that guest (whether an
  // existing Google account or a brand-new one just created above), so
  // whatever the guest had logged gets merged in rather than stranded. Same
  // reasoning as EmailAuthService's register()/login().
  async authenticate(credential: string, guestUserId?: string | null) {
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

    // Whether newTenantId is set (brand-new Google user) or not (existing
    // one), the guest's tenant -- if there was a guest to merge -- is where
    // the content they just brought over actually lives, so it takes
    // priority over either.
    if (guestUserId && guestUserId !== user.id) {
      const mergedTenantId = await guestMergeService.merge(guestUserId, user.id)
      if (mergedTenantId) newTenantId = mergedTenantId
    }

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

    const nextName = current.isAnonymous ? (name ?? current.name) : current.name
    const user = await db.user.update({
      where: { id: userId },
      data: {
        googleId,
        isAnonymous: false,
        // Don't clobber a name/email/avatar the user already set themselves.
        email: current.email ?? email,
        name: nextName,
        avatarUrl: current.avatarUrl ?? picture ?? null,
      },
    })

    await syncPersonalTenantName(userId, current.name, nextName)
    return user
  }

  async logout(token: string) {
    await db.session.deleteMany({ where: { token } })
  }
}
