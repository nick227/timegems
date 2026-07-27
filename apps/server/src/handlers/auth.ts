import { GoogleAuthService } from '../services/GoogleAuthService'
import { AnonymousAuthService } from '../services/AnonymousAuthService'
import { EmailAuthService } from '../services/EmailAuthService'
import { ProfileService } from '../services/ProfileService'
import { db } from '@timegems/db'
import { capabilitiesFor, type Capability } from '../lib/authorization'

const googleAuthService = new GoogleAuthService()
const anonymousAuthService = new AnonymousAuthService()
const emailAuthService = new EmailAuthService()
const profileService = new ProfileService()

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

export async function googleAuth(request: any, reply: any) {
  const { user, token } = await googleAuthService.authenticate(request.body.credential)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: user })
}

// Called by the frontend the moment it sees a 401 with no session cookie at
// all -- see AuthGuard.tsx. Deliberately has no request body: there's
// nothing to submit, that's the entire point of "instant, no-click access."
export async function anonymousAuth(request: any, reply: any) {
  const { user, token } = await anonymousAuthService.create(request.ip)
  reply.setCookie('token', token, COOKIE)
  return reply.status(201).send({ data: user })
}

export async function registerWithEmail(request: any, reply: any) {
  const { email, password, name } = request.body
  const { user, token } = await emailAuthService.register(email, password, name)
  reply.setCookie('token', token, COOKIE)
  return reply.status(201).send({ data: user })
}

export async function loginWithEmail(request: any, reply: any) {
  const { email, password } = request.body
  const { user, token } = await emailAuthService.login(email, password)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: user })
}

// Both claim endpoints require an existing session (bearerAuth) -- they
// upgrade request.user's own row in place, never create or merge a second
// User. No tenant context needed since this doesn't touch tenant-scoped data.
export async function claimWithEmail(request: any, reply: any) {
  const { email, password } = request.body
  const user = await emailAuthService.claimWithEmail(request.user.id, email, password)
  return reply.send({ data: user })
}

export async function claimWithGoogle(request: any, reply: any) {
  const user = await googleAuthService.claimWithGoogle(request.user.id, request.body.credential)
  return reply.send({ data: user })
}

export async function logout(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (token) await googleAuthService.logout(token)
  reply.clearCookie('token', { path: '/' })
  return reply.send({ data: null })
}

export async function getCurrentUser(request: any, reply: any) {
  const capabilities: Capability[] = []
  let tenant = null

  // bearerAuth has already revalidated this membership. The response exposes
  // its resulting capabilities so clients never need to duplicate role maps.
  if (request.auth?.tenantId && request.auth.membershipRole) {
    const activeTenant = await db.tenant.findUnique({ where: { id: request.auth.tenantId } })
    if (activeTenant) {
      tenant = { ...activeTenant, role: request.auth.membershipRole }
      capabilities.push(...capabilitiesFor(request.auth))
    }
  }

  const siteAdmin = await db.adminUser.findUnique({ where: { userId: request.user.id } })
  if (siteAdmin) capabilities.push('site:admin')

  return reply.send({
    data: {
      user: request.user,
      tenant,
      capabilities,
    },
  })
}

export async function updateProfile(request: any, reply: any) {
  const user = await profileService.updateName(request.user.id, request.body.name)
  return reply.send({ data: user })
}
