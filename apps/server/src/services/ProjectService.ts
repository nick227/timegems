import { db } from '@timegems/db'
import { cursorOrderBy, cursorWhere, decodeCursor, normalizeLimit, paginate } from '../lib/pagination'
import { GemService } from './GemService'
import { HttpError } from '../lib/errors'
import { sanitizeRichText } from '../lib/sanitizeHtml'

const gemService = new GemService()

type GemTypeInput = { name: string; icon: string; color: string; description?: string }
type UpdateGemTypeInput = { name?: string; icon?: string; color?: string; description?: string | null }

export class ProjectService {
  private async requireTeamInTenant(tenantId: string, teamId: string) {
    const team = await db.team.findFirst({ where: { id: teamId, tenantId }, select: { id: true } })
    if (!team) throw new HttpError(404, 'Team not found')
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

  async create(tenantId: string, data: { name: string; teamId?: string | null; color?: string | null; gemType?: GemTypeInput }) {
    if (data.teamId) await this.requireTeamInTenant(tenantId, data.teamId)

    return db.project.create({
      data: {
        tenantId,
        name: data.name,
        teamId: data.teamId ?? null,
        color: data.color ?? null,
        ...(data.gemType
          ? {
              gemType: {
                create: {
                  ...data.gemType,
                  description: data.gemType.description ? sanitizeRichText(data.gemType.description) : data.gemType.description,
                },
              },
            }
          : {}),
      },
      include: { gemType: true },
    })
  }

  async get(tenantId: string, projectId: string) {
    const project = await db.project.findFirst({ where: { id: projectId, tenantId }, include: { gemType: true } })
    if (!project) throw new HttpError(404, 'Project not found')
    return project
  }

  async update(
    tenantId: string,
    projectId: string,
    data: {
      name?: string
      teamId?: string | null
      color?: string | null
      archived?: boolean
      gemType?: UpdateGemTypeInput
    },
  ) {
    const existing = await this.get(tenantId, projectId)
    const { archived, gemType, ...rest } = data
    if (rest.teamId) await this.requireTeamInTenant(tenantId, rest.teamId)

    await db.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    })

    if (gemType) {
      const description = gemType.description ? sanitizeRichText(gemType.description) : gemType.description
      if (existing.gemType) {
        await db.gemType.update({ where: { projectId }, data: { ...gemType, description } })
      } else if (gemType.name && gemType.icon && gemType.color) {
        await db.gemType.create({
          data: { projectId, name: gemType.name, icon: gemType.icon, color: gemType.color, description },
        })
      } else {
        throw new HttpError(400, 'name, icon, and color are required to create a gem type')
      }
      // Retroactive: past sessions on this project now count toward gems too.
      await gemService.recomputeAllUsersForProject(projectId)
    }

    return this.get(tenantId, projectId)
  }
}
