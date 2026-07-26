import { TeamService } from '../services/TeamService'
import { requireTenantId } from '../lib/tenant'

const teamService = new TeamService()

export async function listTeams(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await teamService.list(tenantId, request.query)
  return reply.send(result)
}

export async function createTeam(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const team = await teamService.create(tenantId, request.body)
  return reply.status(201).send({ data: team })
}

export async function getTeam(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const team = await teamService.get(tenantId, request.params.teamId)
  return reply.send({ data: team })
}

export async function updateTeam(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const team = await teamService.update(tenantId, request.params.teamId, request.body)
  return reply.send({ data: team })
}

export async function listTeamMembers(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await teamService.listMembers(tenantId, request.params.teamId, request.query)
  return reply.send(result)
}

export async function addTeamMember(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const user = await teamService.addMember(tenantId, request.params.teamId, request.body.userId)
  return reply.status(201).send({ data: user })
}

export async function removeTeamMember(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  await teamService.removeMember(tenantId, request.params.teamId, request.params.userId)
  return reply.send({ data: null })
}
