import { GoalService } from '../services/GoalService'
import { requireTenantContext, requireTenantId } from '../lib/tenant'

const goalService = new GoalService()

export async function listGoals(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const result = await goalService.list(tenantId, request.query)
  return reply.send(result)
}

export async function createGoal(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const goal = await goalService.create(auth.tenantId, auth.userId, request.body)
  return reply.status(201).send({ data: goal })
}

export async function updateGoal(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const goal = await goalService.update(tenantId, request.params.goalId, request.body)
  return reply.send({ data: goal })
}

export async function importProjectGoals(request: any, reply: any) {
  const auth = requireTenantContext(request)
  const result = await goalService.importProjectGoals(
    auth.tenantId,
    auth.userId,
    request.params.projectId,
    request.body.goals,
  )
  return reply.status(201).send({ data: result })
}
