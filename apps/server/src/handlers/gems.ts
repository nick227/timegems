import { GemService } from '../services/GemService'
import { requireTenantId } from '../lib/tenant'

const gemService = new GemService()

export async function listGemBalances(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const balances = await gemService.listBalances(request.user.id, tenantId)
  return reply.send({ data: balances })
}
