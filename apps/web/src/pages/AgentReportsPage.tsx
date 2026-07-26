import { Link } from 'react-router-dom'
import { useAgentReports } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sparkles } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  SUMMARY: 'Summary',
  REVIEW: 'Review',
  PROPOSAL: 'Proposal',
  GOAL: 'Goal',
}

export function AgentReportsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAgentReports()

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  const items = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
      <h1 className="text-xl font-semibold">Reports</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No reports yet"
          description="Your AI agent employees will post summaries and reviews here as your team works."
        />
      ) : (
        items.map((report: any) => (
          <Link key={report.id} to={`/reports/${report.id}`}>
            <Card className="hover:bg-accent/40 transition-colors">
              <CardContent className="py-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {TYPE_LABEL[report.type] ?? report.type}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{report.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{report.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
