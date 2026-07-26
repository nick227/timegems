import { AdminService } from '../services/AdminService'
import { AgentEmployeeService } from '../services/AgentEmployeeService'

const adminService = new AdminService()
const agentEmployeeService = new AgentEmployeeService()

export async function adminListTenants(request: any, reply: any) {
  const result = await adminService.listTenants(request.query)
  return reply.send(result)
}

export async function adminUpdateTenant(request: any, reply: any) {
  const tenant = await adminService.updateTenant(request.params.tenantId, request.body)
  return reply.send({ data: tenant })
}

export async function adminListUsers(request: any, reply: any) {
  const result = await adminService.listUsers(request.query)
  return reply.send(result)
}

export async function adminUpdateUser(request: any, reply: any) {
  const user = await adminService.updateUser(request.params.userId, request.body)
  return reply.send({ data: user })
}

export async function adminListAgentEmployees(request: any, reply: any) {
  const result = await agentEmployeeService.list(request.query)
  return reply.send(result)
}

export async function adminRunAgentEmployee(request: any, reply: any) {
  const report = await agentEmployeeService.run(request.params.agentEmployeeId)
  return reply.status(201).send({ data: report })
}
