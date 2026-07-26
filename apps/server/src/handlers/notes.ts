import { NoteService } from '../services/NoteService'
import { requireTenantId } from '../lib/tenant'

const noteService = new NoteService()

export async function listNotes(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await noteService.list(tenantId, request.params.workSessionId, request.query)
  return reply.send(result)
}

export async function createNote(request: any, reply: any) {
  const note = await noteService.create(request.user.id, request.params.workSessionId, request.body.body)
  return reply.status(201).send({ data: note })
}
