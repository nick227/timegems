import { ProjectEventService } from '../services/ProjectEventService'
import { requireTenantId } from '../lib/tenant'

const projectEventService = new ProjectEventService()

export async function listProjectFeed(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await projectEventService.listFeed(tenantId, request.params.projectId, request.query)
  return reply.send(result)
}

export async function getProjectUpdate(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const item = await projectEventService.getUpdate(tenantId, request.params.projectId, request.params.updateId)
  return reply.send({ data: item })
}
