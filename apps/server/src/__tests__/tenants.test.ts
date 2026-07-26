// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId, testTenantId } from './helpers'

const app = buildTestApp()

describe('listMyTenants', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/tenants' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /tenants', async () => {
    // testUserId is already a member of testTenantId via seedTestUsers()
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listMyTenants', 200, res.json())
    expect(res.json().data.some((t: any) => t.id === testTenantId && t.role === 'OWNER')).toBe(true)
  })
})

describe('createTenant', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/tenants' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /tenants', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: asAuth(testUserId),
      payload: { name: 'New Co', slug: 'new-co' },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createTenant', 201, res.json())
    expect(res.json().data.role).toBe('OWNER')
  })
})

describe('selectActiveTenant', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/tenants/00000000-0000-0000-0000-000000000001/select' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /tenants/{tenantId}/select', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${testTenantId}/select`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('selectActiveTenant', 200, res.json())
  })

  it('403s for a tenant the caller does not belong to', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants/00000000-0000-0000-0000-000000000099/select',
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(403)
  })
})
