import { UserService } from '../services/UserService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'
import { requireCapability } from '../lib/authorization'

const userService = new UserService()

export async function listTenantMembers(request: any, reply: any) {
  const auth = requireTenantContext(request)
  requireCapability(auth, 'team:manage')
  const result = await userService.list(auth.tenantId, request.query)
  return reply.send(result)
}

export async function getUser(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const user = await userService.get(tenantId, request.params.userId)
  return reply.send({ data: user })
}
