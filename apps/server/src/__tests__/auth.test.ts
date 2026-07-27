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

describe('guest activity merges into the account signed into', () => {
  // GuestMergeService is triggered from login/register/googleAuth whenever
  // the caller's *current* cookie session belongs to an anonymous user --
  // real cookie-based auth, not the asAuth() Bearer-header test stub (which
  // bypasses the exact session-token lookup this feature depends on).
  it('merges a stopped, gem-earning session (with its note) into an existing account on login', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'target1@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'target1@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.1' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value
    const guestMembership = await db.membership.findFirstOrThrow({ where: { userId: guestId } })
    const guestTenantId = guestMembership.tenantId

    const project = await db.project.create({ data: { tenantId: guestTenantId, name: 'Guest Project' } })
    const startedAt = new Date(Date.now() - 3600_000)
    const stoppedAt = new Date()
    const session = await db.workSession.create({
      data: {
        tenantId: guestTenantId,
        userId: guestId,
        projectId: project.id,
        name: 'Test Session',
        status: 'STOPPED',
        startedAt,
        stoppedAt,
        activeDurationSec: 3600,
        intervals: { create: [{ kind: 'ACTIVE', startedAt, endedAt: stoppedAt }] },
      },
    })
    await db.note.create({ data: { workSessionId: session.id, authorId: guestId, body: '<p>Did the thing</p>' } })
    const gemType = await db.gemType.create({ data: { projectId: project.id, name: 'Gem', icon: '💎', color: '#000' } })
    await db.gemLedgerEntry.create({
      data: {
        tenantId: guestTenantId,
        userId: guestId,
        projectId: project.id,
        workSessionId: session.id,
        gemTypeId: gemType.id,
        activeDurationSec: 3600,
        carryInSec: 0,
        carryOutSec: 0,
        gemsAwarded: 1,
      },
    })
    await db.gemBalance.create({
      data: { userId: guestId, projectId: project.id, gemTypeId: gemType.id, totalGems: 1, carrySec: 0 },
    })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'target1@example.com', password: 'correct-horse' },
    })
    expect(loginRes.statusCode).toBe(200)
    expect(loginRes.json().data.id).toBe(target.id)

    const movedSession = await db.workSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(movedSession.userId).toBe(target.id)
    expect(movedSession.status).toBe('STOPPED')

    const note = await db.note.findFirstOrThrow({ where: { workSessionId: session.id } })
    expect(note.authorId).toBe(target.id)

    const balance = await db.gemBalance.findFirstOrThrow({ where: { projectId: project.id, userId: target.id } })
    expect(balance.totalGems).toBe(1)
    const staleGuestBalance = await db.gemBalance.findFirst({ where: { projectId: project.id, userId: guestId } })
    expect(staleGuestBalance).toBeNull()

    // The guest's personal tenant isn't deleted or folded into another
    // tenant -- the target simply gains membership in it, with everything
    // still intact and correctly attributed inside it.
    const membership = await db.membership.findFirstOrThrow({ where: { tenantId: guestTenantId, userId: target.id } })
    expect(membership.role).toBe('OWNER')

    // The guest row is retired -- soft-deleted, no sessions left to sign
    // back into it with.
    const guestUser = await db.user.findUniqueOrThrow({ where: { id: guestId } })
    expect(guestUser.deletedAt).not.toBeNull()
    const guestSessions = await db.session.findMany({ where: { userId: guestId } })
    expect(guestSessions).toHaveLength(0)
  })

  it('force-finalizes a still-running session instead of losing it', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'target2@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'target2@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.2' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value
    const guestMembership = await db.membership.findFirstOrThrow({ where: { userId: guestId } })

    const startedAt = new Date(Date.now() - 600_000)
    const session = await db.workSession.create({
      data: {
        tenantId: guestMembership.tenantId,
        userId: guestId,
        name: 'Still Running',
        status: 'RUNNING',
        startedAt,
        intervals: { create: [{ kind: 'ACTIVE', startedAt }] },
      },
    })
    await db.userActiveSession.create({
      data: { userId: guestId, projectId: '__unassigned__', workSessionId: session.id },
    })

    await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'target2@example.com', password: 'correct-horse' },
    })

    const finalized = await db.workSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(finalized.status).toBe('STOPPED')
    expect(finalized.userId).toBe(target.id)
    expect(finalized.activeDurationSec).toBeGreaterThan(0)
    expect(finalized.stoppedAt).not.toBeNull()

    const activeGuard = await db.userActiveSession.findFirst({ where: { workSessionId: session.id } })
    expect(activeGuard).toBeNull()
  })

  it('does not merge when the current session is already a real (non-guest) account', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'same@example.com', password: 'correct-horse' },
    })
    const token = registerRes.cookies.find((c: any) => c.name === 'token')!.value
    const userId = registerRes.json().data.id as string

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token },
      payload: { email: 'same@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(200)
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.deletedAt).toBeNull()
  })

  it('writes one GuestMerge audit record with the source tenant and finalized-session ids', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'audit@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'audit@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.3' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value
    const guestMembership = await db.membership.findFirstOrThrow({ where: { userId: guestId } })

    const startedAt = new Date(Date.now() - 60_000)
    const runningSession = await db.workSession.create({
      data: {
        tenantId: guestMembership.tenantId,
        userId: guestId,
        name: 'Still Running',
        status: 'RUNNING',
        startedAt,
        intervals: { create: [{ kind: 'ACTIVE', startedAt }] },
      },
    })

    await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'audit@example.com', password: 'correct-horse' },
    })

    const record = await db.guestMerge.findUniqueOrThrow({ where: { guestUserId: guestId } })
    expect(record.targetUserId).toBe(target.id)
    expect(record.sourceTenantId).toBe(guestMembership.tenantId)
    expect(record.finalizedSessionIds).toEqual([runningSession.id])
  })

  it('is idempotent under concurrent duplicate login requests -- merges exactly once, gems not double-awarded', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'concurrent@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'concurrent@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.4' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value
    const guestMembership = await db.membership.findFirstOrThrow({ where: { userId: guestId } })

    const project = await db.project.create({ data: { tenantId: guestMembership.tenantId, name: 'Concurrent Project' } })
    const startedAt = new Date(Date.now() - 3600_000)
    const stoppedAt = new Date()
    await db.workSession.create({
      data: {
        tenantId: guestMembership.tenantId,
        userId: guestId,
        projectId: project.id,
        name: 'Concurrent Session',
        status: 'STOPPED',
        startedAt,
        stoppedAt,
        activeDurationSec: 3600,
        intervals: { create: [{ kind: 'ACTIVE', startedAt, endedAt: stoppedAt }] },
      },
    })

    const payload = { email: 'concurrent@example.com', password: 'correct-horse' }
    const [res1, res2] = await Promise.all([
      app.inject({ method: 'POST', url: '/auth/login', cookies: { token: guestToken }, payload }),
      app.inject({ method: 'POST', url: '/auth/login', cookies: { token: guestToken }, payload }),
    ])
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)

    const mergeRecords = await db.guestMerge.findMany({ where: { guestUserId: guestId } })
    expect(mergeRecords).toHaveLength(1)

    const balance = await db.gemBalance.findFirstOrThrow({ where: { projectId: project.id, userId: target.id } })
    expect(balance.totalGems).toBe(1)
  })

  it('upgrades the target membership role when the guest outranks it (never left behind at a weaker role)', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'upgrade@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'upgrade@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.5' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value

    // Simulate both users already belonging to the same shared tenant --
    // not reachable through any flow that exists today, but the collision
    // policy needs to hold regardless of how such a state could arise.
    const sharedTenant = await db.tenant.create({ data: { name: 'Shared Co', slug: `shared-${guestId}` } })
    await db.membership.create({ data: { userId: target.id, tenantId: sharedTenant.id, role: 'MEMBER' } })
    await db.membership.create({ data: { userId: guestId, tenantId: sharedTenant.id, role: 'OWNER' } })

    await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'upgrade@example.com', password: 'correct-horse' },
    })

    const memberships = await db.membership.findMany({ where: { tenantId: sharedTenant.id } })
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.userId).toBe(target.id)
    expect(memberships[0]!.role).toBe('OWNER')
  })

  it('does not downgrade an existing stronger target role when the guest role is weaker', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'nodowngrade@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'nodowngrade@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.6' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value

    const sharedTenant = await db.tenant.create({ data: { name: 'Shared Co 2', slug: `shared2-${guestId}` } })
    await db.membership.create({ data: { userId: target.id, tenantId: sharedTenant.id, role: 'OWNER' } })
    await db.membership.create({ data: { userId: guestId, tenantId: sharedTenant.id, role: 'MEMBER' } })

    await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'nodowngrade@example.com', password: 'correct-horse' },
    })

    const memberships = await db.membership.findMany({ where: { tenantId: sharedTenant.id } })
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.userId).toBe(target.id)
    expect(memberships[0]!.role).toBe('OWNER')
  })

  it('de-duplicates a shared team membership rather than erroring on the unique constraint', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'teamdedupe@example.com', password: 'correct-horse' },
    })
    const target = await db.user.findUniqueOrThrow({ where: { email: 'teamdedupe@example.com' } })

    const guestRes = await app.inject({ method: 'POST', url: '/auth/anonymous', remoteAddress: '10.0.0.7' })
    const guestId = guestRes.json().data.id as string
    const guestToken = guestRes.cookies.find((c: any) => c.name === 'token')!.value
    const guestMembership = await db.membership.findFirstOrThrow({ where: { userId: guestId } })

    const team = await db.team.create({ data: { tenantId: guestMembership.tenantId, name: 'Shared Team' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: guestId } })
    // Give the target a membership in the guest's tenant too, purely so a
    // team membership there is a coherent state to simulate.
    await db.membership.create({ data: { userId: target.id, tenantId: guestMembership.tenantId, role: 'MEMBER' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: target.id } })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      cookies: { token: guestToken },
      payload: { email: 'teamdedupe@example.com', password: 'correct-horse' },
    })
    expect(res.statusCode).toBe(200)

    const teamMemberships = await db.teamMembership.findMany({ where: { teamId: team.id } })
    expect(teamMemberships).toHaveLength(1)
    expect(teamMemberships[0]!.userId).toBe(target.id)
  })
})
