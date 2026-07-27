import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import websocket from '@fastify/websocket'
import openapiGlue from 'fastify-openapi-glue'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as handlers from './handlers'
import * as security from './plugins/security'
import { registerPresence } from './presence'
import { registerUploads } from './uploads'
import { startScheduler } from './scheduler'
import { registerErrorHandler } from './lib/errorHandler'

const server = Fastify({ logger: true })

server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    ;(req as any).rawBody = body
    done(null, JSON.parse(typeof body === 'string' ? body : body.toString('utf8')))
  } catch (err: any) {
    err.statusCode = 400
    done(err, undefined)
  }
})


const specPath = resolve(__dirname, '../../../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as object

async function main() {
  // CORS — must be first so preflight OPTIONS requests are handled before routing
  // credentials: true required for httpOnly cookie auth across origins
  // In production set CORS_ORIGIN to the deployed frontend URL (e.g. https://yourapp.vercel.app)
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })

  // cookies — must register before glue so request.cookies is populated
  await server.register(cookie)

  // WebSocket support for live presence (see presence.ts) — not part of the
  // OpenAPI-driven REST surface, registered directly.
  await server.register(websocket)

  // live swagger UI at /docs in dev
  await server.register(swagger, { openapi: spec })
  await server.register(swaggerUi, { routePrefix: '/docs' })

  registerErrorHandler(server)

  // spec-driven routing — operationId → handler export, security scheme → handler
  await server.register(openapiGlue, {
    specification: specPath,
    serviceHandlers: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)

  // health check — not in spec, always public
  server.get('/health', async () => ({ status: 'ok' }))

  registerPresence(server)
  await registerUploads(server)
  startScheduler()

  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
