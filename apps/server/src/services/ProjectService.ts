import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { GemService } from './GemService'
import { HttpError } from '../lib/errors'
import { DEFAULT_GEM } from '../lib/defaultGem'

const gemService = new GemService()

export class ProjectService {
  private async requireTeamInTenant(tenantId: string, teamId: string) {
    const team = await db.team.findFirst({ where: { id: teamId, tenantId }, select: { id: true } })
    if (!team) throw new HttpError(404, 'Team not found')
  }

  // Older projects may predate always-on gems. Creating the default type and
  // recomputing means past stopped sessions start counting the moment the
  // project is touched again — same retroactive rule the old "set gem type"
  // PATCH used to own.
  private async ensureDefaultGemType(project: {
    id: string
    gemType: { id: string } | null
  }) {
    if (project.gemType) return project
    await db.gemType.create({
      data: { projectId: project.id, ...DEFAULT_GEM },
    })
    await gemService.recomputeAllUsersForProject(project.id)
    return db.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { gemType: true },
    })
  }

  async list(
    tenantId: string,
    opts: { cursor?: string; limit?: number; q?: string; teamId?: string; archived?: boolean },
  ) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const archived = opts.archived ?? false
    const projects = await db.project.findMany({
      where: {
        tenantId,
        archivedAt: archived ? { not: null } : null,
        ...(opts.teamId ? { teamId: opts.teamId } : {}),
        ...(opts.q ? { name: { contains: opts.q } } : {}),
        ...cursorWhere(cursor),
      },
      include: { gemType: true },
      orderBy: cursorOrderBy,
      take: limit + 1,
    })
    return paginate(projects, limit)
  }

  async create(tenantId: string, data: { name: string; teamId?: string | null; color?: string | null }) {
    if (data.teamId) await this.requireTeamInTenant(tenantId, data.teamId)

    return db.project.create({
      data: {
        tenantId,
        name: data.name,
        teamId: data.teamId ?? null,
        color: data.color ?? null,
        gemType: { create: { ...DEFAULT_GEM } },
      },
      include: { gemType: true },
    })
  }

  async get(tenantId: string, projectId: string) {
    const project = await db.project.findFirst({ where: { id: projectId, tenantId }, include: { gemType: true } })
    if (!project) throw new HttpError(404, 'Project not found')
    return this.ensureDefaultGemType(project)
  }

  async update(
    tenantId: string,
    projectId: string,
    data: {
      name?: string
      teamId?: string | null
      color?: string | null
      archived?: boolean
    },
  ) {
    await this.get(tenantId, projectId)
    if (data.teamId) await this.requireTeamInTenant(tenantId, data.teamId)

    const { archived, ...rest } = data
    await db.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    })

    return this.get(tenantId, projectId)
  }
}
