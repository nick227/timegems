import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

export class NoteService {
  async list(tenantId: string, workSessionId: string, opts: { cursor?: string; limit?: number }) {
    const session = await db.workSession.findFirst({ where: { id: workSessionId, tenantId } })
    if (!session) throw { statusCode: 404, message: 'Work session not found' }

    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const notes = await db.note.findMany({
      where: {
        workSessionId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { author: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = notes.length > limit
    const items = hasMore ? notes.slice(0, limit) : notes
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }

  async create(userId: string, workSessionId: string, body: string) {
    const session = await db.workSession.findUnique({ where: { id: workSessionId } })
    if (!session) throw { statusCode: 404, message: 'Work session not found' }
    if (session.status === 'STOPPED') throw { statusCode: 409, message: 'Session is already stopped' }

    return db.note.create({
      data: { workSessionId, authorId: userId, body },
      include: { author: true },
    })
  }
}
