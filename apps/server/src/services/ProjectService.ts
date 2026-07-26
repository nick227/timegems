import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

export class ProjectService {
  async list(
    tenantId: string,
    opts: { cursor?: string; limit?: number; q?: string; teamId?: string; archived?: boolean },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const archived = opts.archived ?? false
    const where: any = {
      tenantId,
      archivedAt: archived ? { not: null } : null,
      ...(opts.teamId ? { teamId: opts.teamId } : {}),
      ...(opts.q ? { name: { contains: opts.q } } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    }
    const projects = await db.project.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = projects.length > limit
    const items = hasMore ? projects.slice(0, limit) : projects
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }

  async create(tenantId: string, data: { name: string; teamId?: string | null; color?: string | null }) {
    return db.project.create({
      data: { tenantId, name: data.name, teamId: data.teamId ?? null, color: data.color ?? null },
    })
  }

  async get(tenantId: string, projectId: string) {
    const project = await db.project.findFirst({ where: { id: projectId, tenantId } })
    if (!project) throw { statusCode: 404, message: 'Project not found' }
    return project
  }

  async update(
    tenantId: string,
    projectId: string,
    data: { name?: string; teamId?: string | null; color?: string | null; archived?: boolean },
  ) {
    await this.get(tenantId, projectId)
    const { archived, ...rest } = data
    return db.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    })
  }
}
