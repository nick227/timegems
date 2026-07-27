import { NoteService } from '../services/NoteService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'
import { hasCapability } from '../lib/authorization'

const noteService = new NoteService()

export async function listNotes(request: any, reply: any) {
  const result = await noteService.list(request.user.id, request.params.workSessionId, request.query)
  return reply.send(result)
}

export async function createNote(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const note = await noteService.create(tenantId, request.user.id, request.params.workSessionId, request.body.body)
  return reply.status(201).send({ data: note })
}

export async function updateNote(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const note = await noteService.update(
    auth.tenantId,
    auth.userId,
    request.params.noteId,
    request.body.body,
    hasCapability(auth, 'session:manage'),
  )
  return reply.send({ data: note })
}
