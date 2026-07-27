import { db } from '@timegems/db'
import { HttpError } from './errors'

async function requireTenantMembership(userId: string, tenantId: string, notFoundMessage: string) {
  const membership = await db.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  })
  if (!membership) throw new HttpError(404, notFoundMessage)
}

// Shared-session reads are keyed by workSessionId, not the caller's active
// tenant. A teammate opening /work/:id may still have a different workspace
// selected (or only belong to the session's tenant without it being active).
// Membership on the session's tenant is the gate; return 404 for non-members so
// we don't leak whether a UUID exists elsewhere.
export async function requireReadableWorkSession(userId: string, workSessionId: string) {
  const session = await db.workSession.findFirst({ where: { id: workSessionId } })
  if (!session) throw new HttpError(404, 'Work session not found')
  await requireTenantMembership(userId, session.tenantId, 'Work session not found')
  return session
}

export async function requireReadableProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId }, select: { id: true, tenantId: true } })
  if (!project) throw new HttpError(404, 'Project not found')
  await requireTenantMembership(userId, project.tenantId, 'Project not found')
  return project
}

export async function requireWorkSessionTenantAccess(userId: string, tenantId: string) {
  await requireTenantMembership(userId, tenantId, 'Work session not found')
}
