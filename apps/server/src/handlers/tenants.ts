import { TenantService } from '../services/TenantService'

const tenantService = new TenantService()

export async function listMyTenants(request: any, reply: any) {
  const tenants = await tenantService.listMine(request.user.id)
  return reply.send({ data: tenants })
}

export async function createTenant(request: any, reply: any) {
  const tenant = await tenantService.create(request.user.id, request.body)
  return reply.status(201).send({ data: tenant })
}

export async function selectActiveTenant(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  const tenant = await tenantService.selectActive(request.user.id, token, request.params.tenantId)
  return reply.send({ data: tenant })
}
