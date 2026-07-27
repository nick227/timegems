import { db, Prisma } from '@timegems/db'
import { GemService } from './GemService'
import { sumActiveSeconds } from '../lib/workSessionTime'

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 }
const ROLE_RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 }

const gemService = new GemService()

// Called whenever a currently-anonymous guest authenticates as a *different*
// user -- via login, Google sign-in, or registering a brand-new account
// while a guest session is active (see currentAnonymousUserId and its three
// call sites in EmailAuthService/GoogleAuthService). Claiming (POST
// /auth/claim, /auth/claim/google) never needs this: that path upgrades the
// *same* row in place. This path authenticates as a genuinely different
// User row, so whatever the guest logged has to move somewhere or it's
// gone -- there's no credential to ever sign back into a guest identity
// specifically. See schema.prisma's User comment for the Claim-vs-Merge
// distinction this rests on.
//
// The whole thing is one atomic transaction: finalize the guest's open
// session(s) -> reassign owned rows -> resolve membership/team-membership
// collisions -> recompute gem ledgers -> write the GuestMerge audit record
// -> retire the guest. A failure anywhere in that sequence rolls the entire
// merge back, never leaving split ownership (some rows moved, some not).
// "Update the new session's active tenant" is the one step that happens
// *outside* this transaction, by necessity -- that session doesn't exist
// until the caller (EmailAuthService/GoogleAuthService) creates it with the
// tenant id this method returns, after merge() has already committed.
//
// Idempotency: `tx.$queryRaw(... FOR UPDATE)` locks the guest's User row
// first, so two concurrent requests racing on the same guest's cookie
// serialize instead of both attempting the transfer -- the second one
// blocks until the first commits, then sees `deletedAt` already set and
// returns null having done nothing. GuestMerge.guestUserId is additionally
// `@unique`, so even a bug in that locking would still fail loudly (a
// unique-constraint error) rather than silently double-crediting gems or
// re-parenting an already-moved WorkSession.
//
// Collision policy, one line per User-FK model (see schema.prisma's full
// inventory) -- explicit on purpose rather than left to whatever a blind
// updateMany happens to do when it hits a unique constraint:
//   WorkSession, Note, Goal.createdByUserId, ProjectEvent.actorUserId
//     -- no unique constraint on the user field; always reassigned.
//   Membership (userId, tenantId)
//     -- if the target already belongs to that tenant, keep ONE row: the
//        stronger of the two roles (OWNER > ADMIN > MEMBER). Never lets a
//        guest's row silently downgrade a target who's already an OWNER.
//   TeamMembership (teamId, userId)
//     -- no role to compare; if the target is already on that team, keep
//        the target's row and drop the guest's (plain de-dupe).
//   UserActiveSession (userId, projectId)
//     -- never reassigned. Finalizing every guest session first means the
//        guest has none of these left; a defensive sweep deletes any that
//        somehow remain rather than risk colliding with a target's own.
//   GemBalance / GemLedgerEntry (keyed by (userId, projectId, ...))
//     -- not reassigned row-by-row. The guest's stale rows for every
//        affected project are deleted, then GemService.recomputeInTransaction
//        rebuilds them for the target from the (now target-owned) STOPPED
//        sessions -- the same authoritative replay every correction/
//        deletion path already uses. Collision-proof by construction: if
//        the target already had STOPPED sessions on that exact project
//        (only possible if they already shared the guest's tenant), the
//        replay sums *all* of them in chronological order, same as it
//        always does.
//   GemAccount (userId, projectId) composite PK, no real data of its own
//     -- guest's rows dropped; the target's is created on demand by
//        GemService's own lock-acquire-on-first-use.
//   AdminUser (userId) 1:1
//     -- guests can never hold this (nothing in the app makes a guest a
//        site admin), so there's structurally nothing to collide. Not
//        reassigned.
//   GithubInstallation / GithubBinding / GithubWebhookDelivery
//     -- tenant-scoped, not user-scoped (no userId/actorId column as of
//        this writing) -- nothing to reassign. If a user-scoped GitHub
//        identity is ever added, it needs a policy here too.
//   Any future User-FK model: add its policy to this list *and* to
//     mergeUser() below in the same change -- don't let a new table go
//     through this service by accident, uncovered.
export class GuestMergeService {
  // Returns the guest's own personal tenant id (the one their merged
  // projects/sessions actually live in), or null if there was nothing to
  // merge -- callers use this to make that tenant the new session's active
  // one. Without that, the merge is real but invisible: the target user
  // would land back in whatever tenant they were already in, with the
  // content they just signed in to bring over sitting one manual tenant
  // switch away, which reads as "it didn't work" (caught by a live test,
  // not a code review -- see the session this shipped in).
  async merge(guestUserId: string, targetUserId: string): Promise<string | null> {
    if (guestUserId === targetUserId) return null

    return db.$transaction(async (tx) => {
      // Row-locks the guest for the rest of this transaction -- see the
      // idempotency note above. Plain `findUnique` doesn't lock; this has
      // to be raw SQL to get FOR UPDATE.
      const locked = await tx.$queryRaw<{ id: string; isAnonymous: boolean; deletedAt: Date | null }[]>(
        Prisma.sql`SELECT id, isAnonymous, deletedAt FROM User WHERE id = ${guestUserId} FOR UPDATE`,
      )
      const guest = locked[0]
      // Already merged/claimed by a concurrent request, or the caller's
      // "current guest" read was stale by the time we got here -- either
      // way, nothing left to move.
      if (!guest || !guest.isAnonymous || guest.deletedAt) return null

      const guestMembership = await tx.membership.findFirst({
        where: { userId: guestUserId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
      })

      const finalizedSessionIds = await this.finalizeOpenSessions(tx, guestUserId)

      const affected = await tx.workSession.findMany({
        where: { userId: guestUserId, status: 'STOPPED', projectId: { not: null } },
        distinct: ['projectId'],
        select: { projectId: true },
      })
      // Stable order -- recomputeInTransaction locks per-project, and
      // touching several projects for the same target user in a fixed order
      // is what avoids a lock-order deadlock against a concurrent operation
      // doing the same (see WorkSessionService.update's identical reasoning).
      const affectedProjectIds = [...new Set(affected.map((s) => s.projectId!))].sort()

      if (affectedProjectIds.length > 0) {
        await tx.gemLedgerEntry.deleteMany({
          where: { userId: guestUserId, projectId: { in: affectedProjectIds } },
        })
        await tx.gemBalance.deleteMany({
          where: { userId: guestUserId, projectId: { in: affectedProjectIds } },
        })
      }

      await tx.workSession.updateMany({ where: { userId: guestUserId }, data: { userId: targetUserId } })
      await tx.note.updateMany({ where: { authorId: guestUserId }, data: { authorId: targetUserId } })
      await tx.goal.updateMany({ where: { createdByUserId: guestUserId }, data: { createdByUserId: targetUserId } })
      await tx.projectEvent.updateMany({ where: { actorUserId: guestUserId }, data: { actorUserId: targetUserId } })

      await this.reassignMemberships(tx, guestUserId, targetUserId)
      await this.reassignTeamMemberships(tx, guestUserId, targetUserId)

      for (const projectId of affectedProjectIds) {
        await gemService.recomputeInTransaction(tx, targetUserId, projectId)
      }

      // Cleanup: finalizing every session above already released the
      // guest's own UserActiveSession guard rows (same as a normal stop()),
      // this is just a defensive sweep. GemAccount rows are lock handles
      // with no real data of their own, safe to drop. Session rows are the
      // guest's login tokens -- deleting them means there's no way back into
      // this identity even if someone still had one open elsewhere.
      await tx.userActiveSession.deleteMany({ where: { userId: guestUserId } })
      await tx.gemAccount.deleteMany({ where: { userId: guestUserId } })
      await tx.session.deleteMany({ where: { userId: guestUserId } })

      await tx.guestMerge.create({
        data: {
          guestUserId,
          targetUserId,
          sourceTenantId: guestMembership?.tenantId ?? null,
          finalizedSessionIds: finalizedSessionIds.length > 0 ? finalizedSessionIds : undefined,
        },
      })

      await tx.user.update({ where: { id: guestUserId }, data: { deletedAt: new Date() } })

      return guestMembership?.tenantId ?? null
    }, TRANSACTION_OPTIONS)
  }

  // Returns the ids of any sessions that had to be force-finalized (were
  // still RUNNING/PAUSED/REVIEWING) -- recorded on the audit row so support
  // can distinguish "stopped normally" from "stopped because a sign-in
  // happened mid-session."
  private async finalizeOpenSessions(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const openSessions = await tx.workSession.findMany({
      where: { userId, status: { not: 'STOPPED' } },
      include: { intervals: true },
    })
    if (openSessions.length === 0) return []

    const now = new Date()
    for (const session of openSessions) {
      await tx.workSessionInterval.updateMany({
        where: { workSessionId: session.id, endedAt: null },
        data: { endedAt: now },
      })
      const intervals = session.intervals.map((interval) =>
        interval.endedAt === null ? { ...interval, endedAt: now } : interval,
      )
      const activeDurationSec = sumActiveSeconds(intervals, now)
      await tx.workSession.update({
        where: { id: session.id },
        data: { status: 'STOPPED', stoppedAt: now, activeDurationSec },
      })
    }
    return openSessions.map((s) => s.id)
  }

  // Collision policy: keep exactly one Membership per (target, tenant),
  // preferring whichever role -- the target's existing one or the guest's
  // -- ranks higher (OWNER > ADMIN > MEMBER). A guest is virtually always
  // OWNER of their own solo tenant and virtually never already a member of
  // anywhere the target also belongs, so in practice this almost always
  // just reassigns the guest's row untouched -- but a target who happens to
  // already outrank the incoming row is never silently downgraded, and a
  // target who doesn't is correctly upgraded rather than left behind.
  private async reassignMemberships(tx: Prisma.TransactionClient, guestUserId: string, targetUserId: string) {
    const memberships = await tx.membership.findMany({ where: { userId: guestUserId } })
    for (const membership of memberships) {
      const existing = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: targetUserId, tenantId: membership.tenantId } },
      })
      if (!existing) {
        await tx.membership.update({ where: { id: membership.id }, data: { userId: targetUserId } })
        continue
      }
      const guestOutranks = (ROLE_RANK[membership.role] ?? 0) > (ROLE_RANK[existing.role] ?? 0)
      await tx.membership.delete({ where: { id: membership.id } })
      if (guestOutranks) {
        await tx.membership.update({ where: { id: existing.id }, data: { role: membership.role } })
      }
    }
  }

  // No role to compare here (team membership is just presence/absence) --
  // if the target is already on that team, keep their row and drop the
  // guest's; otherwise reassign.
  private async reassignTeamMemberships(tx: Prisma.TransactionClient, guestUserId: string, targetUserId: string) {
    const teamMemberships = await tx.teamMembership.findMany({ where: { userId: guestUserId } })
    for (const teamMembership of teamMemberships) {
      const existing = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId: teamMembership.teamId, userId: targetUserId } },
      })
      if (existing) {
        await tx.teamMembership.delete({ where: { id: teamMembership.id } })
      } else {
        await tx.teamMembership.update({ where: { id: teamMembership.id }, data: { userId: targetUserId } })
      }
    }
  }
}
