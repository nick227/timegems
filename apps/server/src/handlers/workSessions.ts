import { WorkSessionService } from '../services/WorkSessionService'
import { requireTenantId } from '../lib/tenant'

const workSessionService = new WorkSessionService()

export async function getActiveWorkSession(request: any, reply: any) {
  const session = await workSessionService.getActive(request.user.id)
  return reply.send({ data: session ?? null })
}

export async function startWorkSession(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const session = await workSessionService.start(tenantId, request.user.id, request.body?.projectId)
  return reply.status(201).send({ data: session })
}

export async function getWorkSession(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const session = await workSessionService.get(tenantId, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function updateWorkSession(request: any, reply: any) {
  const session = await workSessionService.update(request.user.id, request.params.workSessionId, request.body)
  return reply.send({ data: session })
}

export async function pauseWorkSession(request: any, reply: any) {
  const session = await workSessionService.pause(request.user.id, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function resumeWorkSession(request: any, reply: any) {
  const session = await workSessionService.resume(request.user.id, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function stopWorkSession(request: any, reply: any) {
  const session = await workSessionService.stop(request.user.id, request.params.workSessionId, request.body?.note)
  return reply.send({ data: session })
}

export async function listWorkSessions(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await workSessionService.list(tenantId, request.query)
  return reply.send(result)
}
