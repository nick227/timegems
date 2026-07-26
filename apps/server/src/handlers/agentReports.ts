import { AgentReportService } from '../services/AgentReportService'
import { requireTenantId } from '../lib/tenant'

const agentReportService = new AgentReportService()

export async function listAgentReports(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await agentReportService.list(tenantId, request.query)
  return reply.send(result)
}

export async function getAgentReport(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const report = await agentReportService.get(tenantId, request.params.agentReportId)
  return reply.send({ data: report })
}
