import { ProjectEventService } from '../services/ProjectEventService'

const projectEventService = new ProjectEventService()

export async function listProjectFeed(request: any, reply: any) {
  const result = await projectEventService.listFeed(request.user.id, request.params.projectId, request.query)
  return reply.send(result)
}

export async function getProjectUpdate(request: any, reply: any) {
  const item = await projectEventService.getUpdate(request.user.id, request.params.projectId, request.params.updateId)
  return reply.send({ data: item })
}
