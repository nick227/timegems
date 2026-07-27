import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { HttpError } from '../lib/errors'
import { sanitizeRichText } from '../lib/sanitizeHtml'
import { broadcastProjectNote } from '../presence'
import { ProjectEventService } from './ProjectEventService'

const projectEventService = new ProjectEventService()

export class NoteService {
  async list(tenantId: string, workSessionId: string, opts: { cursor?: string; limit?: number }) {
    const session = await db.workSession.findFirst({ where: { id: workSessionId, tenantId } })
    if (!session) throw new HttpError(404, 'Work session not found')

    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const notes = await db.note.findMany({
      where: { workSessionId, ...cursorWhere(cursor) },
      include: { author: true },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(notes, limit)
  }

  async create(tenantId: string, userId: string, workSessionId: string, body: string) {
    const session = await db.workSession.findFirst({ where: { id: workSessionId, tenantId } })
    if (!session) throw new HttpError(404, 'Work session not found')
    if (session.userId !== userId) throw new HttpError(403, 'Forbidden')
    if (session.status === 'STOPPED') throw new HttpError(409, 'Session is already stopped')

    const note = await db.note.create({
      data: { workSessionId, authorId: userId, body: sanitizeRichText(body) },
      include: { author: true },
    })

    // Only sessions tagged to a project have a room -- an unassigned
    // session's notes have no other member to broadcast to.
    if (session.projectId) {
      broadcastProjectNote(tenantId, session.projectId, {
        workSessionId,
        note: {
          id: note.id,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          author: { id: note.author.id, name: note.author.name, avatarUrl: note.author.avatarUrl },
        },
      })

      await projectEventService.recordHumanNote(tenantId, session.projectId, {
        id: note.id,
        body: note.body,
        workSessionId,
        createdAt: note.createdAt,
        author: note.author,
      })
    }

    return note
  }

  async update(tenantId: string, userId: string, noteId: string, body: string, canManageSessions = false) {
    const note = await db.note.findFirst({
      where: { id: noteId, workSession: { tenantId } },
      include: { workSession: true },
    })
    if (!note) throw new HttpError(404, 'Note not found')
    if (
      note.workSession.userId !== userId &&
      !(canManageSessions && note.workSession.status === 'STOPPED')
    ) {
      throw new HttpError(403, 'Forbidden')
    }

    return db.$transaction(async (tx) => {
      const correctedAt = new Date()
      const updated = await tx.note.update({
        where: { id: noteId },
        data: { body: sanitizeRichText(body) },
        include: { author: true },
      })
      await tx.workSession.update({
        where: { id: note.workSessionId },
        data: { correctedAt },
      })
      return updated
    })
  }
}
