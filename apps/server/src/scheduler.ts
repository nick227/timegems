import { db } from '@timegems/db'
import { AgentEmployeeService } from './services/AgentEmployeeService'

const agentEmployeeService = new AgentEmployeeService()
const SWEEP_INTERVAL_MS = 60_000

// Deliberately not a full cron parser -- a small dependency-free mini-syntax
// covers every real interval an agent employee needs ("every:1h",
// "every:7d"). `on_change` is handled separately, event-driven, from
// WorkSessionService.stop(). Anything else (unset, malformed) is treated as
// "not time-based" and simply never fires here -- it's still reachable via
// the admin console's manual "Run now".
function parseIntervalMs(schedule: string): number | null {
  const match = /^every:(\d+)(m|h|d)$/.exec(schedule)
  if (!match) return null
  const amount = Number(match[1])
  const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 'm' | 'h' | 'd']
  return amount * unitMs
}

// This is what makes agent employees actual scheduled workers instead of
// tools that only ever run when a human clicks "Run now" -- see
// docs/system-requirements.md FR-18 and docs/admin.md.
export function startScheduler() {
  setInterval(async () => {
    const employees = await db.agentEmployee.findMany({ where: { enabled: true } })
    const now = Date.now()

    for (const employee of employees) {
      const intervalMs = parseIntervalMs(employee.schedule)
      if (!intervalMs) continue

      const last = (employee.lastRunAt ?? employee.createdAt).getTime()
      if (now - last < intervalMs) continue

      try {
        await agentEmployeeService.run(employee.id)
      } catch (err) {
        console.error(`[scheduler] agent ${employee.id} (${employee.kind}) run failed`, err)
      }
    }
  }, SWEEP_INTERVAL_MS)
}
