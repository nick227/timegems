import { PrismaClient } from '@prisma/client'

export { Prisma } from '@prisma/client'
export type { GoalStatus, AgentEmployeeKind, MembershipRole, AdminRole } from '@prisma/client'

declare global {
  var __db: PrismaClient | undefined
}

export const db = global.__db ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__db = db
}
