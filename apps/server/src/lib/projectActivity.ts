import type { ProjectEventSource, ProjectUpdateProvenance } from '@prisma/client'

export const PROJECT_UPDATE_MODEL = 'timegems-update-writer'
export const PROJECT_UPDATE_MODEL_VERSION = 'heuristic-v1'
export const PUSH_BATCH_WINDOW_MS = 30_000
export const JOB_SWEEP_INTERVAL_MS = 5_000
export const JOB_LOCK_TTL_MS = 60_000

/** Provider-neutral kind strings used across feed + writer. */
export const ProjectEventKinds = {
  NOTE_CREATED: 'NOTE_CREATED',
  GITHUB_PUSH: 'GITHUB_PUSH',
  GITHUB_PULL_REQUEST: 'GITHUB_PULL_REQUEST',
  GITHUB_CHECK_RUN: 'GITHUB_CHECK_RUN',
  GITHUB_PUSH_BATCH: 'GITHUB_PUSH_BATCH',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
} as const

export interface ProjectFeedActor {
  id: string
  name: string
  avatarUrl: string | null
}

export interface ProjectFeedLink {
  label: string
  url: string
}

export interface ProjectFeedEvidence {
  commits?: Array<{ sha: string; message: string; url?: string }>
  filesChanged?: string[]
  pullRequest?: { number: number; title: string; url: string; state?: string }
  checkRun?: { name: string; conclusion: string | null; url?: string }
  limitations?: string[]
  links: ProjectFeedLink[]
}

export interface ProjectFeedItem {
  id: string
  projectId: string
  provenance: 'human' | 'github' | 'ai' | 'system'
  kind: string
  title: string | null
  body: string | null
  occurredAt: string
  actor: ProjectFeedActor | null
  workSessionId?: string | null
  noteId?: string | null
  sourceEventIds?: string[]
  confidence?: number
  modelName?: string
  modelVersion?: string | null
  evidence?: ProjectFeedEvidence
  links?: ProjectFeedLink[]
}

export interface ProjectEventPayload {
  noteId?: string
  workSessionId?: string
  repoFullName?: string
  ref?: string
  commits?: Array<{ id: string; message: string; url?: string }>
  filesChanged?: string[]
  pullRequest?: { number: number; title: string; url: string; state?: string }
  checkRun?: { id: number; name: string; conclusion: string | null; url?: string }
  githubDeliveryId?: string
  batchedEventIds?: string[]
}

export function sourceToProvenance(source: ProjectEventSource): ProjectFeedItem['provenance'] {
  if (source === 'HUMAN') return 'human'
  if (source === 'GITHUB') return 'github'
  if (source === 'AI') return 'ai'
  return 'system'
}

export function provenanceLabel(provenance: ProjectFeedItem['provenance']): string {
  if (provenance === 'human') return 'Human'
  if (provenance === 'github') return 'GitHub'
  if (provenance === 'ai') return 'AI update'
  return 'System'
}

export function updateProvenanceLabel(provenance: ProjectUpdateProvenance): string {
  return provenance === 'AI' ? 'AI update' : 'Human update'
}

export function eventsToEvidence(events: Array<{ payload: unknown }>): ProjectFeedEvidence {
  const evidence: ProjectFeedEvidence = { links: [], limitations: [] }
  const commits: NonNullable<ProjectFeedEvidence['commits']> = []
  const files = new Set<string>()

  for (const event of events) {
    const payload = event.payload as ProjectEventPayload
    for (const commit of payload.commits ?? []) {
      commits.push({ sha: commit.id, message: commit.message, url: commit.url })
      if (commit.url) evidence.links.push({ label: commit.id.slice(0, 7), url: commit.url })
    }
    for (const file of payload.filesChanged ?? []) files.add(file)
    if (payload.pullRequest) {
      evidence.pullRequest = payload.pullRequest
      evidence.links.push({ label: `PR #${payload.pullRequest.number}`, url: payload.pullRequest.url })
    }
    if (payload.checkRun) {
      evidence.checkRun = {
        name: payload.checkRun.name,
        conclusion: payload.checkRun.conclusion,
        url: payload.checkRun.url,
      }
      if (payload.checkRun.url) evidence.links.push({ label: payload.checkRun.name, url: payload.checkRun.url })
    }
  }

  if (commits.length) evidence.commits = commits
  if (files.size) evidence.filesChanged = [...files]
  return evidence
}
