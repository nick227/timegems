import { db } from '@timegems/db'
import { randomUUID } from 'crypto'
import { HttpError } from '../lib/errors'
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/password'
import { provisionPersonalTenant } from '../lib/provisionTenant'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export class EmailAuthService {
  private validate(email: string, password: string) {
    const normalized = normalizeEmail(email)
    if (!EMAIL_PATTERN.test(normalized)) throw new HttpError(400, 'Enter a valid email address')
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
    return normalized
  }

  async register(email: string, password: string, name?: string) {
    const normalized = this.validate(email, password)

    // Case-insensitive collision check -- the unique index is on the
    // normalized value we're about to store, so this doubles as the
    // pre-check that turns a DB constraint violation into a clean 409.
    const existing = await db.user.findUnique({ where: { email: normalized } })
    if (existing) throw new HttpError(409, 'An account with this email already exists')

    const passwordHash = await hashPassword(password)
    const displayName = name?.trim() || normalized.split('@')[0]!
    const user = await db.user.create({
      data: { email: normalized, passwordHash, name: displayName },
    })
    const tenant = await provisionPersonalTenant(user.id, displayName)

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        activeTenantId: tenant.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
    return { user, token: session.token }
  }

  async login(email: string, password: string) {
    const normalized = normalizeEmail(email)
    const user = await db.user.findUnique({ where: { email: normalized } })

    // Always run a real bcrypt compare, even with no user/hash to check --
    // against DUMMY_PASSWORD_HASH if need be -- so "no such email" and
    // "wrong password" take the same amount of time. See password.ts.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!user || !user.passwordHash || !valid) {
      throw new HttpError(401, 'Invalid email or password')
    }
    if (user.suspendedAt) throw new HttpError(403, 'Account suspended')

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
    return { user, token: session.token }
  }

  // Adds email+password to the *current* user in place -- same "upgrade,
  // never merge" rule as GoogleAuthService.claimWithGoogle. Works whether
  // that user is anonymous (the intended case) or already has other
  // credentials (e.g. adding a password alongside an existing Google login);
  // isAnonymous only ever needs setting false here, never a no-op guard.
  async claimWithEmail(userId: string, email: string, password: string) {
    const normalized = this.validate(email, password)

    const existing = await db.user.findUnique({ where: { email: normalized } })
    if (existing && existing.id !== userId) throw new HttpError(409, 'An account with this email already exists')

    const passwordHash = await hashPassword(password)
    return db.user.update({
      where: { id: userId },
      data: { email: normalized, passwordHash, isAnonymous: false },
    })
  }
}
