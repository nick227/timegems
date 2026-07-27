import { Link } from 'react-router-dom'
import { useAgentReports } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { ListPageShell } from '@/components/ui/ListPageShell'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { formatDateTime } from '@/lib/formatDate'
import { Sparkles } from 'lucide-react'
import { REPORT_TYPE_LABEL } from './lib/typeLabel'

export function ReportsRoute() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAgentReports()
  const items = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="space-y-3">
      <ListPageShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        skeletonClassName="h-20 w-full"
        emptyIcon={Sparkles}
        emptyTitle="No agent reports yet"
        emptyDescription="Your AI agent employees will post summaries and reviews here as your team works."
        isError={isError}
        errorTitle="Agent Reports could not be loaded"
        onRetry={() => void refetch()}
      >
        <div className="space-y-3">
          {items.map((report) => (
            <Link key={report.id} to={`/reports/${report.id}`}>
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {REPORT_TYPE_LABEL[report.type] ?? report.type}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(report.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium">{report.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{report.body}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </ListPageShell>

      <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onClick={() => fetchNextPage()} />
    </div>
  )
}
