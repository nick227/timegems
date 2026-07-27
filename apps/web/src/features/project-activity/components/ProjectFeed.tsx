import { useProjectFeed, useProjectFeedLive } from '@timegems/sdk'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ProjectFeedItemRow } from './ProjectFeedItemRow'

interface ProjectFeedProps {
  projectId: string
  live?: boolean
  compact?: boolean
}

export function ProjectFeed({ projectId, live = true, compact = false }: ProjectFeedProps) {
  const feedQuery = useProjectFeed(projectId)
  if (live) useProjectFeedLive(projectId)

  const items = feedQuery.data?.pages.flatMap((page) => page.data) ?? []

  if (feedQuery.isLoading) return <Skeleton className="h-32 w-full" />
  if (feedQuery.isError) {
    return (
      <QueryErrorState
        error={feedQuery.error}
        resource="Project activity"
        onRetry={() => void feedQuery.refetch()}
      />
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No project activity yet.</p>
  }

  return (
    <section className={compact ? 'space-y-3' : 'space-y-4'} aria-live="polite">
      {!compact && <p className="text-sm font-medium text-muted-foreground">Project activity</p>}
      <ul className="space-y-3">
        {items.slice(0, compact ? 5 : undefined).map((item) => (
          <ProjectFeedItemRow key={item.id} item={item} />
        ))}
      </ul>
      {!compact && (
        <LoadMoreButton
          hasNextPage={feedQuery.hasNextPage}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          onClick={() => void feedQuery.fetchNextPage()}
        />
      )}
    </section>
  )
}
