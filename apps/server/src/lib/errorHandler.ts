import type { FastifyInstance } from 'fastify'

/**
 * Keep production and injected test apps on the same error contract.
 * Domain HttpErrors retain their specific message; Prisma errors are mapped
 * to stable public responses; unexpected errors are logged and concealed.
 */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation })
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message })
    }
    if ((error as any).code === 'P2025') {
      return reply.status(404).send({ error: 'Not found' })
    }
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'Already exists' })
    }
    app.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })
}
