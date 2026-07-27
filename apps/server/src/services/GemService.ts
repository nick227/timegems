import { db, Prisma } from '@timegems/db'
import { DEFAULT_GEM } from '../lib/defaultGem'

const SECONDS_PER_GEM = 3600
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 }

type TransactionClient = Prisma.TransactionClient
type StoppedSession = {
  id: string
  tenantId: string
  userId: string
  projectId: string
  activeDurationSec: number
}

export class GemService {
  // All mutation paths for a user's project ledger acquire this same row.
  // The account is independent of GemType, so creating/changing a gem type
  // cannot race a stop, correction, deletion, or repair replay.
  private async lockAccount(tx: TransactionClient, userId: string, projectId: string) {
    // Prisma's upsert can become SELECT-then-INSERT on this compound key.
    // Two transactions seeing a missing account can therefore both attempt
    // the insert and one receives P2002 before either reaches FOR UPDATE.
    // MySQL's atomic insert-or-no-op serializes that first-use race on the
    // primary key; FK failures still surface normally.
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO GemAccount (userId, projectId, createdAt)
        VALUES (${userId}, ${projectId}, CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE userId = VALUES(userId)
      `,
    )
    await tx.$queryRaw(
      Prisma.sql`SELECT userId FROM GemAccount WHERE userId = ${userId} AND projectId = ${projectId} FOR UPDATE`,
    )
  }

  // Gems are always on. Older projects may lack a GemType row — create the
  // fixed default in-transaction before awarding.
  private async requireGemType(tx: TransactionClient, projectId: string) {
    const existing = await tx.gemType.findUnique({ where: { projectId } })
    if (existing) return existing
    return tx.gemType.create({ data: { projectId, ...DEFAULT_GEM } })
  }

  // Fast path for the normal append-only case. WorkSessionService invokes
  // this inside the same transaction that marks the session STOPPED, so the
  // session, ledger entry, balance, carry, and active-session release either
  // all commit or all roll back.
  async settleStoppedSession(tx: TransactionClient, session: StoppedSession) {
    await this.lockAccount(tx, session.userId, session.projectId)

    const existing = await tx.gemLedgerEntry.findUnique({
      where: { workSessionId: session.id },
    })
    if (existing) return existing

    const project = await tx.project.findUnique({
      where: { id: session.projectId },
      include: { gemType: true },
    })
    if (!project) return null
    const gemType = project.gemType ?? (await this.requireGemType(tx, session.projectId))
    // Rebuild the included shape so the rest of this method can keep using
    // project.gemType without a second branch.
    project.gemType = gemType

    const persistedSession = await tx.workSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { startedAt: true },
    })
    const canonicalBefore = {
      OR: [
        { startedAt: { lt: persistedSession.startedAt } },
        { startedAt: persistedSession.startedAt, id: { lt: session.id } },
      ],
    }
    const canonicalAfter = {
      OR: [
        { startedAt: { gt: persistedSession.startedAt } },
        { startedAt: persistedSession.startedAt, id: { gt: session.id } },
      ],
    }
    const [unsettledEarlierSession, settledLaterSession] = await Promise.all([
      tx.workSession.findFirst({
        where: {
          userId: session.userId,
          projectId: session.projectId,
          status: 'STOPPED',
          ...canonicalBefore,
          gemLedgerEntry: { is: null },
        },
        select: { id: true },
      }),
      tx.workSession.findFirst({
        where: {
          userId: session.userId,
          projectId: session.projectId,
          status: 'STOPPED',
          ...canonicalAfter,
          gemLedgerEntry: { isNot: null },
        },
        select: { id: true },
      }),
    ])
    if (unsettledEarlierSession || settledLaterSession) {
      await this.rebuildLocked(tx, session.userId, session.projectId)
      return tx.gemLedgerEntry.findUnique({ where: { workSessionId: session.id } })
    }

    const gemTypeId = project.gemType.id
    await tx.gemBalance.deleteMany({
      where: {
        userId: session.userId,
        projectId: session.projectId,
        gemTypeId: { not: gemTypeId },
      },
    })
    const balance = await tx.gemBalance.upsert({
      where: {
        userId_projectId_gemTypeId: {
          userId: session.userId,
          projectId: session.projectId,
          gemTypeId,
        },
      },
      create: {
        userId: session.userId,
        projectId: session.projectId,
        gemTypeId,
        totalGems: 0,
        carrySec: 0,
      },
      update: {},
    })

    const totalSec = balance.carrySec + session.activeDurationSec
    const gemsAwarded = Math.floor(totalSec / SECONDS_PER_GEM)
    const carryOutSec = totalSec % SECONDS_PER_GEM

    const entry = await tx.gemLedgerEntry.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        projectId: session.projectId,
        workSessionId: session.id,
        gemTypeId,
        activeDurationSec: session.activeDurationSec,
        carryInSec: balance.carrySec,
        carryOutSec,
        gemsAwarded,
      },
    })
    await tx.gemBalance.update({
      where: { id: balance.id },
      data: {
        totalGems: { increment: gemsAwarded },
        carrySec: carryOutSec,
      },
    })
    return entry
  }

  async recomputeInTransaction(tx: TransactionClient, userId: string, projectId: string) {
    await this.lockAccount(tx, userId, projectId)
    await this.rebuildLocked(tx, userId, projectId)
  }

  private async rebuildLocked(tx: TransactionClient, userId: string, projectId: string) {
    const project = await tx.project.findUnique({ where: { id: projectId } })
    if (!project) {
      await tx.gemLedgerEntry.deleteMany({ where: { userId, projectId } })
      await tx.gemBalance.deleteMany({ where: { userId, projectId } })
      return
    }
    const gemType = await this.requireGemType(tx, projectId)

    const sessions = await tx.workSession.findMany({
      where: { userId, projectId, status: 'STOPPED' },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    })

    let carry = 0
    let totalGems = 0
    const entries: Prisma.GemLedgerEntryCreateManyInput[] = []
    for (const session of sessions) {
      const totalSec = carry + session.activeDurationSec
      const gemsAwarded = Math.floor(totalSec / SECONDS_PER_GEM)
      const carryOutSec = totalSec % SECONDS_PER_GEM

      entries.push({
        tenantId: session.tenantId,
        userId,
        projectId,
        workSessionId: session.id,
        gemTypeId: gemType.id,
        activeDurationSec: session.activeDurationSec,
        carryInSec: carry,
        carryOutSec,
        gemsAwarded,
      })
      totalGems += gemsAwarded
      carry = carryOutSec
    }

    await tx.gemLedgerEntry.deleteMany({ where: { userId, projectId } })
    if (entries.length > 0) {
      await tx.gemLedgerEntry.createMany({ data: entries })
    }
    await tx.gemBalance.deleteMany({ where: { userId, projectId } })
    await tx.gemBalance.create({
      data: {
        userId,
        projectId,
        gemTypeId: gemType.id,
        totalGems,
        carrySec: carry,
      },
    })
  }

  async recompute(userId: string, projectId: string) {
    return db.$transaction(
      (tx) => this.recomputeInTransaction(tx, userId, projectId),
      TRANSACTION_OPTIONS,
    )
  }

  // Recompute for every user who has ever stopped a session on this project.
  // Different accounts lock different (userId, projectId) rows and can replay
  // concurrently without touching one another's ledger.
  async recomputeAllUsersForProject(projectId: string) {
    const distinctUsers = await db.workSession.findMany({
      where: { projectId, status: 'STOPPED' },
      distinct: ['userId'],
      select: { userId: true },
    })
    await Promise.all(distinctUsers.map(({ userId }) => this.recompute(userId, projectId)))
  }

  async listBalances(userId: string, tenantId: string) {
    const balances = await db.gemBalance.findMany({
      where: { userId, project: { tenantId } },
      include: { project: true, gemType: true },
      orderBy: { updatedAt: 'desc' },
    })
    return balances.map((balance) => ({
      projectId: balance.projectId,
      projectName: balance.project.name,
      gemType: balance.gemType,
      totalGems: balance.totalGems,
      carrySec: balance.carrySec,
    }))
  }
}
