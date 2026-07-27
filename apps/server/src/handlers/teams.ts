import { TeamService } from '../services/TeamService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'
import { requireCapability } from '../lib/authorization'

const teamService = new TeamService()

export async function listTeams(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await teamService.list(tenantId, request.query)
  return reply.send(result)
}

export async function createTeam(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'team:manage')
  const team = await teamService.create(auth.tenantId, request.body)
  return reply.status(201).send({ data: team })
}

export async function getTeam(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const team = await teamService.get(tenantId, request.params.teamId)
  return reply.send({ data: team })
}

export async function updateTeam(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'team:manage')
  const team = await teamService.update(auth.tenantId, request.params.teamId, request.body)
  return reply.send({ data: team })
}

export async function listTeamMembers(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await teamService.listMembers(tenantId, request.params.teamId, request.query)
  return reply.send(result)
}

export async function addTeamMember(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'team:manage')
  const users = await teamService.addMembers(auth.tenantId, request.params.teamId, request.body.userIds)
  return reply.status(201).send({ data: users })
}

export async function removeTeamMember(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'team:manage')
  await teamService.removeMember(auth.tenantId, request.params.teamId, request.params.userId)
  return reply.send({ data: null })
}
