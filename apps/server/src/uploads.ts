import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, unlink } from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { bearerAuth } from './plugins/security'
import { HttpError } from './lib/errors'

// A third deliberate exception to "everything goes through the OpenAPI/glue
// pipeline", alongside presence.ts and scheduler.ts: multipart binary
// request bodies don't fit AJV/OpenAPI schema validation well, so this is
// registered directly on the Fastify instance instead of fighting the
// spec-driven framework for a shape it wasn't designed to describe.
//
// Storage is local disk under apps/server/uploads/, served back via
// @fastify/static at the same path. No Upload DB model -- a stateless file
// store; orphaned files (e.g. from an abandoned draft) are a known,
// deliberately-unsolved limitation for this pass.
const UPLOAD_DIR = path.resolve(__dirname, '../uploads')
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/']

export async function registerUploads(server: FastifyInstance) {
  await mkdir(UPLOAD_DIR, { recursive: true })

  await server.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } })
  await server.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/', decorateReply: false })

  server.post('/uploads', { preHandler: bearerAuth }, async (request, reply) => {
    const file = await (request as any).file()
    if (!file) throw new HttpError(400, 'No file provided')

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix))) {
      throw new HttpError(400, 'Only image, video, and audio uploads are allowed')
    }

    // A random name, not the original filename -- avoids path traversal
    // and filename collisions; the extension is kept so served files get
    // a sensible content-type from @fastify/static's mime lookup.
    const ext = path.extname(file.filename || '').slice(0, 10)
    const storedName = `${randomUUID()}${ext}`
    const dest = path.join(UPLOAD_DIR, storedName)
    await pipeline(file.file, createWriteStream(dest))

    if (file.file.truncated) {
      // The stream was cut off mid-write once the size limit was hit --
      // don't leave the partial file behind.
      await unlink(dest).catch(() => {})
      throw new HttpError(400, `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
    }

    return reply.status(201).send({ url: `/uploads/${storedName}` })
  })
}
