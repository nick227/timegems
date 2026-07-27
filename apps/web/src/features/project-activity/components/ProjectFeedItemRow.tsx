import type { ProjectFeedItem } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { RichTextView } from '@/components/ui/RichTextView'
import { feedProvenanceClass, feedProvenanceLabel } from '../lib/provenance'
import { ProjectFeedEvidenceDialog } from './ProjectFeedEvidenceDialog'

interface ProjectFeedItemRowProps {
  item: ProjectFeedItem
  onUseInUpdate?: (text: string) => void
}

export function ProjectFeedItemRow({ item, onUseInUpdate }: ProjectFeedItemRowProps) {
  const hasEvidence = Boolean(
    item.evidence?.commits?.length ||
      item.evidence?.filesChanged?.length ||
      item.evidence?.pullRequest ||
      item.evidence?.checkRun ||
      item.links?.length,
  )

  const useText = item.body ?? item.title ?? ''

  return (
    <li className="space-y-2 rounded-lg bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={`rounded-full px-2 py-0.5 font-medium ${feedProvenanceClass(item.provenance)}`}>
          {feedProvenanceLabel(item.provenance)}
        </span>
        {item.actor && <span>{item.actor.name}</span>}
        <span>{new Date(item.occurredAt).toLocaleString()}</span>
        {item.confidence != null && item.provenance === 'ai' && (
          <span>Confidence {(item.confidence * 100).toFixed(0)}%</span>
        )}
      </div>

      {item.title && <p className="text-sm font-medium">{item.title}</p>}
      {item.body && (
        <div className="text-sm">
          {item.provenance === 'human' ? <RichTextView html={item.body} /> : <p className="whitespace-pre-wrap">{item.body}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {hasEvidence && <ProjectFeedEvidenceDialog item={item} />}
        {onUseInUpdate && useText && (
          <Button size="sm" variant="outline" onClick={() => onUseInUpdate(useText)}>
            Use in update
          </Button>
        )}
      </div>
    </li>
  )
}
