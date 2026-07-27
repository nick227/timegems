import type { ProjectFeedItem } from '@timegems/sdk'

export function feedProvenanceLabel(provenance: ProjectFeedItem['provenance']): string {
  if (provenance === 'human') return 'Human'
  if (provenance === 'github') return 'GitHub'
  if (provenance === 'ai') return 'AI update'
  return 'System'
}

export function feedProvenanceClass(provenance: ProjectFeedItem['provenance']): string {
  if (provenance === 'human') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
  if (provenance === 'github') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
  if (provenance === 'ai') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  return 'bg-muted text-muted-foreground'
}
