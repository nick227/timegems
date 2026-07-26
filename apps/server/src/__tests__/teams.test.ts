// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('listTeams', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /teams', async () => {
    await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    const res = await app.inject({
      method: 'GET',
      url: '/teams',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listTeams', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})

describe('createTeam', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/teams' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /teams', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: asAuth(testUserId),
      payload: { name: 'Engineering' },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createTeam', 201, res.json())
  })
})

describe('getTeam', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /teams/{teamId}', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${team.id}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('getTeam', 200, res.json())
  })

  it('404s for a team in another tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/teams/00000000-0000-0000-0000-000000000001',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('updateTeam', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/teams/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /teams/{teamId}', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    const res = await app.inject({
      method: 'PATCH',
      url: `/teams/${team.id}`,
      headers: asAuth(testUserId),
      payload: { name: 'Platform' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('updateTeam', 200, res.json())
    expect(res.json().data.name).toBe('Platform')
  })
})

describe('listTeamMembers', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/teams/00000000-0000-0000-0000-000000000001/members' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /teams/{teamId}/members', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: testUserId } })
    const res = await app.inject({
      method: 'GET',
      url: `/teams/${team.id}/members`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listTeamMembers', 200, res.json())
    expect(res.json().data.some((u: any) => u.id === testUserId)).toBe(true)
  })
})

describe('addTeamMember', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/teams/00000000-0000-0000-0000-000000000001/members' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /teams/{teamId}/members', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    const res = await app.inject({
      method: 'POST',
      url: `/teams/${team.id}/members`,
      headers: asAuth(testUserId),
      payload: { userId: testUserId },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('addTeamMember', 201, res.json())
  })
})

describe('removeTeamMember', () => {
  it('requires auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/teams/00000000-0000-0000-0000-000000000001/members/00000000-0000-0000-0000-000000000001',
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /teams/{teamId}/members/{userId}', async () => {
    const team = await db.team.create({ data: { tenantId: testTenantId, name: 'Engineering' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: testUserId } })
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/${team.id}/members/${testUserId}`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('removeTeamMember', 200, res.json())
  })
})
