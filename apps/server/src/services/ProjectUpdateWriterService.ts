import type { ProjectEvent } from '@prisma/client'
import { eventsToEvidence, ProjectEventKinds } from '../lib/projectActivity'
import type { ProjectEventPayload } from '../lib/projectActivity'
import type { WriterDraft } from './ProjectUpdateJobService'

// Heuristic, evidence-grounded writer -- same documented placeholder pattern
// as AgentEmployeeService and TextAssistService. It only states what the
// source payloads actually contain and lowers confidence when evidence is thin.
export class ProjectUpdateWriterService {
  write(sourceEvents: ProjectEvent[], recentActivity: ProjectEvent[]): WriterDraft {
    const evidence = eventsToEvidence(sourceEvents)
    const limitations: string[] = [...(evidence.limitations ?? [])]

    const pushEvents = sourceEvents.filter(
      (e) => e.kind === ProjectEventKinds.GITHUB_PUSH || e.kind === ProjectEventKinds.GITHUB_PUSH_BATCH,
    )
    const prEvents = sourceEvents.filter((e) => e.kind === ProjectEventKinds.GITHUB_PULL_REQUEST)
    const checkEvents = sourceEvents.filter((e) => e.kind === ProjectEventKinds.GITHUB_CHECK_RUN)

    const commitCount = evidence.commits?.length ?? 0
    const fileCount = evidence.filesChanged?.length ?? 0
    const repo = this.firstRepo(sourceEvents)

    const lines: string[] = []
    if (pushEvents.length > 0) {
      const batchLabel = pushEvents.length > 1 ? `${pushEvents.length} related pushes` : 'A push'
      lines.push(
        `${batchLabel} landed on ${repo ?? 'the linked repository'}${commitCount ? ` with ${commitCount} commit${commitCount === 1 ? '' : 's'}` : ''}.`,
      )
    }

    if (fileCount > 0) {
      const preview = evidence.filesChanged!.slice(0, 5).join(', ')
      const more = fileCount > 5 ? ` (+${fileCount - 5} more)` : ''
      lines.push(`Changed files include ${preview}${more}.`)
    } else if (pushEvents.length > 0) {
      limitations.push('No per-file change list was available in the webhook payload.')
    }

    if (prEvents.length > 0) {
      const pr = (prEvents[0]!.payload as ProjectEventPayload).pullRequest
      if (pr) {
        lines.push(`Pull request #${pr.number} "${pr.title}" is ${pr.state ?? 'open'}.`)
      }
    }

    if (checkEvents.length > 0) {
      const check = (checkEvents[0]!.payload as ProjectEventPayload).checkRun
      if (check) {
        if (check.conclusion === 'success') {
          lines.push(`CI check "${check.name}" completed successfully.`)
        } else if (check.conclusion === 'failure') {
          lines.push(`CI check "${check.name}" failed.`)
          limitations.push('Do not treat this work as fully validated — CI reported a failure.')
        } else if (check.conclusion) {
          lines.push(`CI check "${check.name}" finished with conclusion "${check.conclusion}".`)
        } else {
          lines.push(`CI check "${check.name}" is in progress or has no conclusion yet.`)
          limitations.push('CI had not finished when this update was written.')
        }
      }
    }

    const recentNotes = recentActivity.filter((e) => e.source === 'HUMAN').length
    if (recentNotes > 0) {
      lines.push(`${recentNotes} recent human note${recentNotes === 1 ? '' : 's'} also appear in project activity.`)
    }

    if (lines.length === 0) {
      lines.push('GitHub activity was recorded, but the available payload did not include enough detail for a richer summary.')
      limitations.push('Summary is intentionally conservative because source evidence was minimal.')
    }

    // Misleading-completion guardrail: never imply shipping/merge without PR merge evidence.
    const merged = prEvents.some((e) => (e.payload as ProjectEventPayload).pullRequest?.state === 'merged')
    if (!merged && prEvents.length > 0) {
      limitations.push('No merge was observed — this update does not claim the pull request shipped.')
    }
    if (checkEvents.some((e) => (e.payload as ProjectEventPayload).checkRun?.conclusion === 'failure')) {
      limitations.push('At least one CI check failed; do not present this as a clean completion.')
    }

    let confidence = 0.35
    if (commitCount > 0) confidence += 0.15
    if (fileCount > 0) confidence += 0.15
    if (prEvents.length > 0) confidence += 0.1
    if (checkEvents.some((e) => (e.payload as ProjectEventPayload).checkRun?.conclusion === 'success')) confidence += 0.15
    if (limitations.length > 2) confidence -= 0.1
    confidence = Math.max(0.1, Math.min(0.95, confidence))

    const body = [...lines, ...(limitations.length ? [`\nCaveats: ${limitations.join(' ')}`] : [])].join('\n')
    evidence.limitations = limitations

    return { body, confidence, evidence }
  }

  private firstRepo(events: ProjectEvent[]): string | null {
    for (const event of events) {
      const repo = (event.payload as ProjectEventPayload).repoFullName
      if (repo) return repo
    }
    return null
  }
}
