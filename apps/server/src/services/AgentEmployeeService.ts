import { db } from '@timegems/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

const DAY_MS = 24 * 60 * 60 * 1000
const CODE_KEYWORDS = /\b(bug|fix|refactor|test|pr|pull request|review|merge|deploy|regression|hotfix)\b/i

function minutes(seconds: number) {
  return Math.round(seconds / 60)
}

// V1 placeholder policy shared by every kind below: analysis is aggregation
// over WorkSession/Note rows already in the database, not a real LLM call.
// This keeps the report shape (AgentReport) and the admin "Run now" /
// Reports feed interface stable so a real model call can replace the body
// text later without changing the API contract. See docs/admin.md.
export class AgentEmployeeService {
  async list(opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const employees = await db.agentEmployee.findMany({
      where: {
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = employees.length > limit
    const items = hasMore ? employees.slice(0, limit) : employees
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
    return { data: items, meta: { hasMore, nextCursor } }
  }

  async run(agentEmployeeId: string) {
    const employee = await db.agentEmployee.findUnique({ where: { id: agentEmployeeId } })
    if (!employee) throw { statusCode: 404, message: 'Agent employee not found' }

    switch (employee.kind) {
      case 'SUMMARIZER':
        return this.runSummarizer(employee.id, employee.tenantId)
      case 'QA':
        return this.runQA(employee.id, employee.tenantId)
      case 'PM':
        return this.runPM(employee.id, employee.tenantId)
      case 'CODE_REVIEW':
        return this.runCodeReview(employee.id, employee.tenantId)
      case 'STEERING':
        return this.runSteering(employee.id, employee.tenantId)
      default:
        throw { statusCode: 400, message: `No report logic wired up for agent kind ${employee.kind}` }
    }
  }

  private async runSummarizer(agentEmployeeId: string, tenantId: string) {
    const since = new Date(Date.now() - DAY_MS)
    const sessions = await db.workSession.findMany({
      where: { tenantId, status: 'STOPPED', stoppedAt: { gte: since } },
    })
    const totalSec = sessions.reduce((sum, s) => sum + s.activeDurationSec, 0)
    const projectCount = new Set(sessions.map((s) => s.projectId)).size

    const body =
      sessions.length === 0
        ? 'No completed work sessions in the last 24 hours.'
        : `${sessions.length} session(s) completed in the last 24 hours, totaling ${minutes(totalSec)} minutes across ${projectCount} project(s).`

    return this.postReport(agentEmployeeId, tenantId, 'SUMMARY', 'Daily activity summary', body)
  }

  private async runQA(agentEmployeeId: string, tenantId: string) {
    const since = new Date(Date.now() - DAY_MS)
    const sessions = await db.workSession.findMany({
      where: { tenantId, status: 'STOPPED', stoppedAt: { gte: since } },
      include: { notes: true, project: true },
    })

    if (sessions.length === 0) {
      return this.postReport(agentEmployeeId, tenantId, 'REVIEW', 'QA review', 'No completed sessions to review in the last 24 hours.')
    }

    const undocumented = sessions.filter((s) => s.notes.length === 0)
    const lines = [`Reviewed ${sessions.length} completed session(s) from the last 24 hours.`]
    if (undocumented.length > 0) {
      const names = [...new Set(undocumented.map((s) => s.project?.name ?? 'no project'))]
      lines.push(
        `${undocumented.length} session(s) closed with no notes at all — no record of what was actually done (projects: ${names.join(', ')}). Consider requiring at least one note before Stop.`,
      )
    } else {
      lines.push('Every session had at least one note — documentation coverage looks healthy.')
    }

    return this.postReport(agentEmployeeId, tenantId, 'REVIEW', 'QA review', lines.join('\n'))
  }

  private async runPM(agentEmployeeId: string, tenantId: string) {
    const since = new Date(Date.now() - 7 * DAY_MS)
    const sessions = await db.workSession.findMany({
      where: { tenantId, status: 'STOPPED', stoppedAt: { gte: since } },
      include: { project: true },
    })

    if (sessions.length === 0) {
      return this.postReport(agentEmployeeId, tenantId, 'PROPOSAL', 'Weekly priorities proposal', 'No activity in the last 7 days to base a proposal on.')
    }

    const byProject = new Map<string, { name: string; sec: number }>()
    for (const s of sessions) {
      const key = s.projectId ?? 'none'
      const name = s.project?.name ?? 'No project'
      const entry = byProject.get(key) ?? { name, sec: 0 }
      entry.sec += s.activeDurationSec
      byProject.set(key, entry)
    }
    const ranked = [...byProject.values()].sort((a, b) => b.sec - a.sec)
    const top = ranked[0]
    const least = ranked[ranked.length - 1]

    const lines = [
      `Over the last 7 days: ${sessions.length} session(s) across ${ranked.length} project(s).`,
      `Most time went to "${top!.name}" (${minutes(top!.sec)}m).`,
    ]
    if (ranked.length > 1) {
      lines.push(`Least time went to "${least!.name}" (${minutes(least!.sec)}m) — worth checking if that's intentional or a dropped priority.`)
    }
    lines.push('Proposal: confirm next week\'s top project matches where time is actually going before planning starts.')

    return this.postReport(agentEmployeeId, tenantId, 'PROPOSAL', 'Weekly priorities proposal', lines.join('\n'))
  }

  private async runCodeReview(agentEmployeeId: string, tenantId: string) {
    const since = new Date(Date.now() - DAY_MS)
    const notes = await db.note.findMany({
      where: { workSession: { tenantId }, createdAt: { gte: since } },
      include: { workSession: { include: { project: true } } },
    })

    const codeNotes = notes.filter((n) => CODE_KEYWORDS.test(n.body))

    const body =
      codeNotes.length === 0
        ? 'No notes mentioning code-related activity (bug/fix/PR/review/etc.) in the last 24 hours. Note: this agent reads work-log notes only — it has no GitHub integration yet (see docs/roadmap.md, V2), so it cannot see actual diffs.'
        : [
            `${codeNotes.length} note(s) flagged for code-related activity in the last 24 hours:`,
            ...codeNotes.map((n) => `- ${n.workSession.project?.name ?? 'No project'}: "${n.body}"`),
            '',
            'Reminder: this is a text-based read of work-log notes, not a real diff review — no GitHub integration yet.',
          ].join('\n')

    return this.postReport(agentEmployeeId, tenantId, 'REVIEW', 'Code review notes', body)
  }

  private async runSteering(agentEmployeeId: string, tenantId: string) {
    const since = new Date(Date.now() - 7 * DAY_MS)
    const sessions = await db.workSession.findMany({
      where: { tenantId, status: 'STOPPED', stoppedAt: { gte: since } },
      include: { project: true },
    })

    if (sessions.length === 0) {
      return this.postReport(agentEmployeeId, tenantId, 'GOAL', 'Steering: no goal proposed', 'No activity in the last 7 days — nothing to steer toward yet.')
    }

    const byProject = new Map<string, { name: string; sec: number }>()
    for (const s of sessions) {
      const key = s.projectId ?? 'none'
      const name = s.project?.name ?? 'No project'
      const entry = byProject.get(key) ?? { name, sec: 0 }
      entry.sec += s.activeDurationSec
      byProject.set(key, entry)
    }
    const [focusProjectId, focus] = [...byProject.entries()].sort((a, b) => b[1].sec - a[1].sec)[0]!

    const title = `Keep momentum on ${focus.name}`
    const description = `${focus.name} got the most time this week (${minutes(focus.sec)}m across ${sessions.filter((s) => (s.projectId ?? 'none') === focusProjectId).length} session(s)). Proposed goal: define what "done" looks like for the current push before momentum shifts elsewhere.`

    const goal = await db.goal.create({
      data: {
        tenantId,
        title,
        description,
        status: 'PROPOSED',
      },
    })

    const report = await this.postReport(agentEmployeeId, tenantId, 'GOAL', title, description)
    await db.goal.update({ where: { id: goal.id }, data: { sourceAgentReportId: report.id } })
    return report
  }

  private postReport(agentEmployeeId: string, tenantId: string, type: 'SUMMARY' | 'REVIEW' | 'PROPOSAL' | 'GOAL', title: string, body: string) {
    return db.agentReport.create({
      data: {
        agentEmployeeId,
        tenantId,
        type,
        title,
        body,
        postedTo: [{ channel: 'feed' }],
      },
    })
  }
}
