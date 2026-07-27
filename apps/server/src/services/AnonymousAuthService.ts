import { db } from '@timegems/db'
import { randomUUID } from 'crypto'
import { HttpError } from '../lib/errors'
import { provisionPersonalTenant } from '../lib/provisionTenant'
import { generateFunnyName } from '../lib/funnyName'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Anonymous creation has no credential to check -- unlike register/login,
// there's nothing to slow a script down by default. Without *some* limit, a
// crawler hitting the app with no cookie repeatedly would provision an
// unbounded number of tenants. A fixed per-IP window is enough to blunt
// casual/accidental abuse; it isn't meant to stop a determined attacker
// (that would need real infra -- Redis-backed limits, a WAF), same
// "fine at current scale" reasoning as this codebase's other in-memory
// state (see presence.ts).
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const attemptsByIp = new Map<string, { count: number; windowStart: number }>()

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, entry] of attemptsByIp) {
    if (entry.windowStart < cutoff) attemptsByIp.delete(ip)
  }
}, WINDOW_MS).unref()

function checkRateLimit(ip: string) {
  const now = Date.now()
  const entry = attemptsByIp.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: now })
    return
  }
  if (entry.count >= MAX_PER_WINDOW) {
    throw new HttpError(429, 'Too many guest accounts created from this location. Try again later, or sign in to an existing account.')
  }
  entry.count += 1
}

export class AnonymousAuthService {
  async create(ip: string) {
    checkRateLimit(ip)

    const name = generateFunnyName()
    const user = await db.user.create({
      data: { name, isAnonymous: true },
    })
    const tenant = await provisionPersonalTenant(user.id, name)

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
}
