// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { db } from '@timegems/db'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId, testTenantId } from './helpers'
import { bearerAuth } from '../plugins/security'
import { requireTenantContext } from '../lib/tenant'

const app = buildTestApp()

describe('googleAuth', () => {
  // Requires a real Google-issued ID token -- verified manually via the browser
  // (see templates/plugins/google-auth/README.md Verification steps).
  it.skip('POST /auth/google — requires real Google token', async () => {})

  it('rejects a malformed credential', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { credential: 'not-a-real-jwt' },
      })
      expect(res.statusCode).toBe(400)
    } finally {
      if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
      else process.env.GOOGLE_CLIENT_ID = originalClientId
    }
  })

  it('reports missing Google configuration explicitly', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_ID
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { credential: 'credential-cannot-be-verified-without-configuration' },
      })
      expect(res.statusCode).toBe(503)
      await validateResponse('googleAuth', 503, res.json())
      expect(res.json().error).toBe('Google sign-in is not configured')
    } finally {
      if (originalClientId !== undefined) process.env.GOOGLE_CLIENT_ID = originalClientId
    }
  })
})

describe('logout', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /auth/logout', async () => {
    // TODO: seed domain data (test users are pre-seeded by buildTestApp)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: asAuth(testUserId),
      // payload: {},
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('logout', 200, res.json())
  })
})

describe('getCurrentUser', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /auth/me', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getCurrentUser', 200, res.json())
    expect(res.json().data.user.id).toBe(testUserId)
    expect(res.json().data.tenant).toMatchObject({ id: testTenantId, role: 'OWNER' })
    expect(res.json().data.capabilities).toEqual(
      expect.arrayContaining(['project:manage', 'team:manage', 'session:manage', 'site:admin']),
    )
  })

  it('returns server-derived member capabilities without duplicating role policy in the client', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: asAuth(testOtherUserId),
    })

    expect(res.statusCode).toBe(200)
    await validateResponse('getCurrentUser', 200, res.json())
    expect(res.json().data.user.id).toBe(testOtherUserId)
    expect(res.json().data.tenant).toMatchObject({ id: testTenantId, role: 'MEMBER' })
    expect(res.json().data.capabilities).toEqual([])
  })
})

describe('verified tenant authentication context', () => {
  it('revalidates membership and rejects tenant access immediately after revocation', async () => {
    const token = 'revoked-membership-session-token'
    await db.session.create({
      data: {
        userId: testUserId,
        token,
        activeTenantId: testTenantId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    await db.membership.delete({
      where: { userId_tenantId: { userId: testUserId, tenantId: testTenantId } },
    })

    const request: any = { cookies: { token }, headers: {} }
    await bearerAuth(request, null, null)

    expect(request.auth).toMatchObject({
      userId: testUserId,
      tenantAccessRevoked: true,
    })
    expect(() => requireTenantContext(request)).toThrowError('Tenant access revoked')
  })
})

describe('anonymousAuth', () => {
  it('POST /auth/anonymous creates a guest user with a personal tenant, no click/credential needed', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/anonymous' })
    expect(res.statusCode).toBe(201)
    await validateResponse('anonymousAuth', 201, res.json())

    const user = res.json().data
    expect(user.isAnonymous).toBe(true)
    expect(user.email).toBeNull()
    expect(user.name).toMatch(/^\w+ \w+ \d+$/) // e.g. "Clever Otter 47"
    expect(res.cookies.some((c: any) => c.name === 'token')).toBe(true)

    const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    const membership = await db.membership.findFirst({ where: { userId: user.id } })
    expect(membership?.role).toBe('OWNER')
    const tenant = await db.tenant.findUnique({ where: { id: membership!.tenantId } })
    expect(tenant?.name).toContain(dbUser.name)

    // The session it just set is immediately usable, with an active tenant
    // already selected -- no separate "pick a tenant" step for a guest.
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } })
    expect(session.activeTenantId).toBe(membership!.tenantId)
  })
})

describe('registerWithEmail', () => {
  it('POST /auth/register creates a real account with its own tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new.user@example.com', password: 'correct-horse', name: 'New User' },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('registerWithEmail', 201, res.json())

    const user = res.json().data
    expect(user.email).toBe('new.user@example.com')
    expect(user.isAnonymous).toBe(false)
    expect(res.cookies.some((c: any) => c.name === 'token')).toBe(true)

    const membership = await db.membership.findFirst({ where: { userId: user.id } })
    expect(membership?.role).toBe('OWNER')
  })

  it('normalizes email case for the uniqueness check', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'Case@Example.com', password: 'correct-horse' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'case@example.com', password: 'another-password' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('rejects a password below the minimum length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'short@example.com', password: 'short' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('loginWithEmail', () => {
  it('POST /auth/login succeeds with the right password', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'login.user@example.com', password: 'correct-horse' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login.user@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('loginWithEmail', 200, res.json())
    expect(res.json().data.email).toBe('login.user@example.com')
  })

  it('gives the same error for a wrong password and a nonexistent email', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'exists@example.com', password: 'correct-horse' },
    })
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'exists@example.com', password: 'incorrect-horse' },
    })
    const noSuchEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever-password' },
    })
    expect(wrongPassword.statusCode).toBe(401)
    expect(noSuchEmail.statusCode).toBe(401)
    expect(wrongPassword.json().error).toBe(noSuchEmail.json().error)
  })
})

describe('claimWithEmail', () => {
  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/claim',
      payload: { email: 'claim@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('upgrades an anonymous user in place -- same row, not a new account', async () => {
    const guest = await db.user.create({ data: { name: 'Clever Otter 12', isAnonymous: true } })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/claim',
      headers: asAuth(guest.id),
      payload: { email: 'claimed@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('claimWithEmail', 200, res.json())

    const updated = res.json().data
    expect(updated.id).toBe(guest.id)
    expect(updated.isAnonymous).toBe(false)
    expect(updated.email).toBe('claimed@example.com')
    // The funny name survives the upgrade -- claiming adds credentials, it
    // doesn't reset anything the guest already had.
    expect(updated.name).toBe('Clever Otter 12')
  })

  it('rejects an email already used by a different user', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'taken@example.com', password: 'correct-horse' },
    })
    const guest = await db.user.create({ data: { name: 'Guest', isAnonymous: true } })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/claim',
      headers: asAuth(guest.id),
      payload: { email: 'taken@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('updateProfile', () => {
  it('requires auth', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      payload: { name: 'Alex' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /auth/me renames the user and syncs the default personal workspace name', async () => {
    const guest = await app.inject({ method: 'POST', url: '/auth/anonymous' })
    const userId = guest.json().data.id as string
    const oldName = guest.json().data.name as string
    const membership = await db.membership.findFirstOrThrow({
      where: { userId },
      include: { tenant: true },
    })
    expect(membership.tenant.name).toBe(`${oldName}'s workspace`)

    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: asAuth(userId),
      payload: { name: '  Alex Rivera  ' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('updateProfile', 200, res.json())
    expect(res.json().data.name).toBe('Alex Rivera')

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: membership.tenantId } })
    expect(tenant.name).toBe("Alex Rivera's workspace")
  })

  it('leaves a manually renamed workspace alone', async () => {
    const guest = await app.inject({ method: 'POST', url: '/auth/anonymous' })
    const userId = guest.json().data.id as string
    const membership = await db.membership.findFirstOrThrow({ where: { userId } })
    await db.tenant.update({
      where: { id: membership.tenantId },
      data: { name: 'Acme Corp' },
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: asAuth(userId),
      payload: { name: 'Alex' },
    })
    expect(res.statusCode).toBe(200)

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: membership.tenantId } })
    expect(tenant.name).toBe('Acme Corp')
  })
})

describe('claimWithGoogle', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/claim/google', payload: { credential: 'x' } })
    expect(res.statusCode).toBe(401)
  })

  // Verifying a real Google credential end-to-end is covered manually, same
  // as googleAuth above -- this exercises the same "not configured"/"can't
  // verify" guards through the claim entry point specifically.
  it('reports missing Google configuration explicitly', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_ID
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/claim/google',
        headers: asAuth(testUserId),
        payload: { credential: 'credential-cannot-be-verified-without-configuration' },
      })
      expect(res.statusCode).toBe(503)
    } finally {
      if (originalClientId !== undefined) process.env.GOOGLE_CLIENT_ID = originalClientId
    }
  })
})
