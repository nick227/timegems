import { db } from '../src/client'

async function cleanupUser(googleId: string) {
  const user = await db.user.findUnique({ where: { googleId } })
  if (!user) return
  const staleSessions = await db.workSession.findMany({ where: { userId: user.id }, select: { id: true } })
  const staleSessionIds = staleSessions.map((s) => s.id)
  if (staleSessionIds.length > 0) {
    await db.userActiveSession.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.gemLedgerEntry.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.note.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.workSessionInterval.deleteMany({ where: { workSessionId: { in: staleSessionIds } } })
    await db.workSession.deleteMany({ where: { id: { in: staleSessionIds } } })
  }
  await db.gemBalance.deleteMany({ where: { userId: user.id } })
  await db.gemAccount.deleteMany({ where: { userId: user.id } })
}

async function main() {
  await cleanupUser('e2e-google-id')
  const stray = await db.project.findMany({ where: { name: { startsWith: 'Manual Verify' } }, select: { id: true } })
  const strayIds = stray.map((p) => p.id)
  if (strayIds.length > 0) {
    await db.gemType.deleteMany({ where: { projectId: { in: strayIds } } })
    await db.project.deleteMany({ where: { id: { in: strayIds } } })
  }
  console.log('cleaned up')
}

main().finally(() => db.$disconnect())
