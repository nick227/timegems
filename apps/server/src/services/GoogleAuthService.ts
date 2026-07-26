import { OAuth2Client } from 'google-auth-library'
import { db } from '@timegems/db'
import { randomUUID } from 'crypto'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class GoogleAuthService {
  async authenticate(credential: string) {
    if (!credential) throw { statusCode: 400, message: 'Missing credential' }

    let ticket
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
    } catch {
      throw { statusCode: 400, message: 'Invalid Google credential' }
    }

    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw { statusCode: 400, message: 'Invalid Google credential' }
    }

    const { sub: googleId, email, name, picture } = payload

    let user = await db.user.findUnique({ where: { googleId } })
    if (!user) {
      user = await db.user.create({
        data: {
          googleId,
          email,
          name: name ?? email.split('@')[0] ?? email,
          avatarUrl: picture ?? null,
        },
      })
    }

    if (user.suspendedAt) throw { statusCode: 403, message: 'Account suspended' }

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    return { user, token: session.token }
  }

  async logout(token: string) {
    await db.session.deleteMany({ where: { token } })
  }
}
