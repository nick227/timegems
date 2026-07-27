import { beforeAll, beforeEach, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import openapiGlue from 'fastify-openapi-glue'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { resolve } from 'path'
import { db } from '@timegems/db'
import * as handlers from '../../handlers'
import { HttpError } from '../../lib/errors'
import { registerErrorHandler } from '../../lib/errorHandler'

// Two seeded users available in every test — use testOtherUserId for
// cross-user permission tests (e.g. "user A cannot stop user B's session")
export const testUserId = '00000000-0000-0000-0000-000000000001'
export const testOtherUserId = '00000000-0000-0000-0000-000000000002'

// A single tenant both users belong to, and are scoped to by the test auth
// stub below. Real multi-tenant switching (POST /tenants/{id}/select) is
// exercised through the real session-cookie bearerAuth in production/dev,
// not through this header-based test transport.
export const testTenantId = '00000000-0000-0000-0000-00000000000a'

const specPath = resolve(__dirname, '../../../../../packages/api-spec/openapi.yaml')

let derefSpec: any
async function getSpec() {
  if (!derefSpec) derefSpec = await SwaggerParser.dereference(specPath)
  return derefSpec
}

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

// Seeds minimal user + tenant + membership rows before each test.
// setup.ts deletes them in afterEach — this re-creates them for the next test.
async function seedTestUsers() {
  await db.user.createMany({
    data: [
      { id: testUserId, email: 'alice@test.local', name: 'Alice', googleId: `google-${testUserId}` },
      { id: testOtherUserId, email: 'bob@test.local', name: 'Bob', googleId: `google-${testOtherUserId}` },
    ],
    skipDuplicates: true,
  })
  await db.tenant.createMany({
    data: [{ id: testTenantId, name: 'Test Co', slug: 'test-co' }],
    skipDuplicates: true,
  })
  await db.membership.createMany({
    data: [
      { userId: testUserId, tenantId: testTenantId, role: 'OWNER' },
      { userId: testOtherUserId, tenantId: testTenantId, role: 'MEMBER' },
    ],
    skipDuplicates: true,
  })
  // alice is the site admin in tests
  await db.adminUser.createMany({
    data: [{ userId: testUserId, role: 'SUPERADMIN' }],
    skipDuplicates: true,
  })
}

export function buildTestApp() {
  const app: FastifyInstance = Fastify()

  beforeAll(async () => {
    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET ?? 'test-cookie-secret-at-least-32-characters',
    })
    registerErrorHandler(app)
    await app.register(openapiGlue, {
      specification: specPath,
      serviceHandlers: handlers,
      securityHandlers: {
        // Test auth: accept "Bearer <userId>" directly, scoped to testTenantId.
        // Tests are not testing the auth transport; they're testing business logic.
        async bearerAuth(request: any) {
          const id = request.headers.authorization?.replace('Bearer ', '')
          if (!id) throw new HttpError(401, 'Unauthorized')
          request.user = await db.user.findUniqueOrThrow({ where: { id } })
          const membership = await db.membership.findUnique({
            where: { userId_tenantId: { userId: id, tenantId: testTenantId } },
          })
          request.auth = {
            userId: id,
            sessionId: `test-session-${id}`,
            ...(membership
              ? {
                  tenantId: membership.tenantId,
                  membershipId: membership.id,
                  membershipRole: membership.role,
                }
              : { tenantAccessRevoked: true }),
          }
        },
        async adminAuth(request: any) {
          const id = request.headers.authorization?.replace('Bearer ', '')
          if (!id) throw new HttpError(401, 'Unauthorized')
          request.user = await db.user.findUniqueOrThrow({ where: { id } })
          request.auth = { userId: id, sessionId: `test-session-${id}` }
          const admin = await db.adminUser.findUnique({ where: { userId: id } })
          if (!admin) throw new HttpError(403, 'Forbidden')
        },
      },
      noAdditional: true,
    } as any)
    await app.ready()
  })

  // Seed test users before every test so asAuth() works without per-test setup.
  // Domain data (projects, sessions, etc.) is still seeded per-test.
  beforeEach(async () => {
    await seedTestUsers()
  })

  afterAll(() => app.close())

  return app
}

export function asAuth(userId: string) {
  return { Authorization: `Bearer ${userId}` }
}

export async function validateResponse(operationId: string, status: number, body: unknown) {
  const spec = await getSpec()
  for (const pathItem of Object.values<any>(spec.paths ?? {})) {
    for (const op of Object.values<any>(pathItem)) {
      if (op.operationId !== operationId) continue
      const schema = op.responses?.[status]?.content?.['application/json']?.schema
      if (!schema) return
      const validate = ajv.compile(schema)
      if (!validate(body)) {
        throw new Error(
          `${operationId} ${status} response does not match spec:\n` + JSON.stringify(validate.errors, null, 2),
        )
      }
      return
    }
  }
}
