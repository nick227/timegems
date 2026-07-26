// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testTenantId } from './helpers'
import { db } from '@timegems/db'

const app = buildTestApp()

describe('listNotes', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/work-sessions/00000000-0000-0000-0000-000000000001/notes' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /work-sessions/{workSessionId}/notes', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'RUNNING' },
    })
    await db.note.create({ data: { workSessionId: session.id, authorId: testUserId, body: 'Working on the API' } })
    const res = await app.inject({
      method: 'GET',
      url: `/work-sessions/${session.id}/notes`,
      headers: asAuth(testUserId),
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('listNotes', 200, res.json())
    expect(res.json().data.length).toBe(1)
  })
})

describe('createNote', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/work-sessions/00000000-0000-0000-0000-000000000001/notes' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /work-sessions/{workSessionId}/notes', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/notes`,
      headers: asAuth(testUserId),
      payload: { body: 'Debugging the payment webhook' },
    })
    expect(res.statusCode).toBe(201)
    await validateResponse('createNote', 201, res.json())
    expect(res.json().data.body).toBe('Debugging the payment webhook')
  })

  it('409s once the session is stopped', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/notes`,
      headers: asAuth(testUserId),
      payload: { body: 'too late' },
    })
    expect(res.statusCode).toBe(409)
  })
})
