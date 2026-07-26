import { ReportService } from '../services/ReportService'
import { requireTenantId } from '../lib/tenant'

const reportService = new ReportService()

export async function getTimeSummary(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const summary = await reportService.timeSummary(tenantId, request.user.id, request.query)
  return reply.send({ data: summary })
}
