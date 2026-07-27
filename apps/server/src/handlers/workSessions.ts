import { WorkSessionService } from '../services/WorkSessionService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'
import { hasCapability } from '../lib/authorization'

const workSessionService = new WorkSessionService()

export async function getActiveWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const sessions = await workSessionService.listActive(auth.tenantId, auth.userId)
  return reply.send({ data: sessions })
}

export async function startWorkSession(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const session = await workSessionService.start(tenantId, request.user.id, request.body?.projectId, request.body?.goalId)
  return reply.status(201).send({ data: session })
}

export async function getWorkSession(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const session = await workSessionService.get(tenantId, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function updateWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const session = await workSessionService.update(
    auth.tenantId,
    auth.userId,
    request.params.workSessionId,
    request.body,
    hasCapability(auth, 'session:manage'),
  )
  return reply.send({ data: session })
}

export async function pauseWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const session = await workSessionService.pause(auth.tenantId, auth.userId, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function resumeWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const session = await workSessionService.resume(auth.tenantId, auth.userId, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function reviewWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const session = await workSessionService.review(auth.tenantId, auth.userId, request.params.workSessionId)
  return reply.send({ data: session })
}

export async function stopWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const session = await workSessionService.stop(auth.tenantId, auth.userId, request.params.workSessionId, request.body?.note)
  return reply.send({ data: session })
}

export async function listWorkSessions(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await workSessionService.list(tenantId, request.query)
  return reply.send(result)
}

export async function deleteWorkSession(request: any, reply: any) {
  const auth = requireTenantContext(request)
  await workSessionService.delete(
    auth.tenantId,
    auth.userId,
    request.params.workSessionId,
    hasCapability(auth, 'session:manage'),
  )
  return reply.send({ data: null })
}
