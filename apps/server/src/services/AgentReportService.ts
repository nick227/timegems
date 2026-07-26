import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

export class AgentReportService {
  async list(
    tenantId: string,
    opts: { cursor?: string; limit?: number; teamId?: string; projectId?: string; type?: string },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const where: any = {
      tenantId,
      ...(opts.teamId ? { teamId: opts.teamId } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    }
    const reports = await db.agentReport.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = reports.length > limit
    const items = hasMore ? reports.slice(0, limit) : reports
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }

  async get(tenantId: string, agentReportId: string) {
    const report = await db.agentReport.findFirst({ where: { id: agentReportId, tenantId } })
    if (!report) throw { statusCode: 404, message: 'Agent report not found' }
    return report
  }
}
