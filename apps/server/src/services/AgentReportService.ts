import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { HttpError } from '../lib/errors'

export class AgentReportService {
  async list(
    tenantId: string,
    opts: { cursor?: string; limit?: number; teamId?: string; projectId?: string; type?: string },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const reports = await db.agentReport.findMany({
      where: {
        tenantId,
        ...(opts.teamId ? { teamId: opts.teamId } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.type ? { type: opts.type as any } : {}),
        ...cursorWhere(cursor),
      },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(reports, limit)
  }

  async get(tenantId: string, agentReportId: string) {
    const report = await db.agentReport.findFirst({ where: { id: agentReportId, tenantId } })
    if (!report) throw new HttpError(404, 'Agent report not found')
    return report
  }
}
