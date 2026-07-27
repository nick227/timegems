// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('listTenantMembers', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users' })
    expect(res.statusCode).toBe(401)
  })

  it('searches by name or email, includes tenant role, and excludes existing team members', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: testUserId } })

    const res = await app.inject({
      method: 'GET',
      url: `/users?q=bob%40test.local&excludeTeamId=${team.id}`,
      headers: asAuth(testUserId),
    })

    expect(res.statusCode).toBe(200)
    await validateResponse('listTenantMembers', 200, res.json())
    expect(res.json().data).toEqual([
      expect.objectContaining({ id: testOtherUserId, email: 'bob@test.local', tenantRole: 'MEMBER' }),
    ])
  })

  it('does not expose the tenant directory to ordinary members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: asAuth(testOtherUserId),
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('getUser', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /users/{userId} — returns a teammate sharing the current tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/users/${testOtherUserId}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getUser', 200, res.json())
    expect(res.json().data.id).toBe(testOtherUserId)
  })

  it('404s for a user with no membership in the current tenant', async () => {
    const outsider = await db.user.create({
      data: { email: 'outsider@test.local', name: 'Outsider', googleId: 'google-outsider' },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/users/${outsider.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(404)
  })
})
