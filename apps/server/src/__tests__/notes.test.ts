// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testOtherUserId, testUserId, testTenantId } from './helpers'
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

  it('cannot add a note to another user’s active session', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'RUNNING' },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/work-sessions/${session.id}/notes`,
      headers: asAuth(testOtherUserId),
      payload: { body: 'Not my session' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('updateNote', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/notes/00000000-0000-0000-0000-000000000001' })
    expect(res.statusCode).toBe(401)
  })

  it('corrects and sanitizes a saved note, marking its session corrected', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const note = await db.note.create({
      data: { workSessionId: session.id, authorId: testUserId, body: '<p>Old note</p>' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${note.id}`,
      headers: asAuth(testUserId),
      payload: { body: '<p>Corrected note</p><script>alert(1)</script>' },
    })

    expect(res.statusCode).toBe(200)
    await validateResponse('updateNote', 200, res.json())
    expect(res.json().data.body).toBe('<p>Corrected note</p>')
    expect((await db.workSession.findUnique({ where: { id: session.id } }))?.correctedAt).not.toBeNull()
  })

  it('allows a session manager to correct another member’s note', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testOtherUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const note = await db.note.create({
      data: { workSessionId: session.id, authorId: testOtherUserId, body: 'Old note' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${note.id}`,
      headers: asAuth(testUserId),
      payload: { body: 'Manager correction' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('does not let a member correct another user’s note', async () => {
    const session = await db.workSession.create({
      data: { tenantId: testTenantId, userId: testUserId, status: 'STOPPED', stoppedAt: new Date() },
    })
    const note = await db.note.create({
      data: { workSessionId: session.id, authorId: testUserId, body: 'Old note' },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${note.id}`,
      headers: asAuth(testOtherUserId),
      payload: { body: 'Unauthorized correction' },
    })
    expect(res.statusCode).toBe(403)
  })
})
