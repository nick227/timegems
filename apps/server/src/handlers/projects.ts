import { ProjectService } from '../services/ProjectService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'
import { requireCapability } from '../lib/authorization'

const projectService = new ProjectService()

export async function listProjects(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await projectService.list(tenantId, request.query)
  return reply.send(result)
}

export async function createProject(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'project:manage')
  const project = await projectService.create(auth.tenantId, request.body)
  return reply.status(201).send({ data: project })
}

export async function getProject(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const project = await projectService.get(tenantId, request.params.projectId)
  return reply.send({ data: project })
}

export async function updateProject(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'project:manage')
  const project = await projectService.update(auth.tenantId, request.params.projectId, request.body)
  return reply.send({ data: project })
}
