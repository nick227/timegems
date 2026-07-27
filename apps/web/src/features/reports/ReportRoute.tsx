import { useParams } from 'react-router-dom'
import { ApiError, useAgentReport } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/formatDate'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function ReportRoute() {
  const { agentReportId } = useParams<{ agentReportId: string }>()
  const reportQuery = useAgentReport(agentReportId!)
  const { data, isLoading } = reportQuery

  if (isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />
  if (reportQuery.isError) {
    return (
      <QueryErrorState
        error={reportQuery.error}
        resource="Agent report"
        onRetry={() => void reportQuery.refetch()}
        returnTo="/settings?tab=reports"
        returnLabel="Return to Agent Reports"
      />
    )
  }

  const report = data?.data
  if (!report) {
    return (
      <QueryErrorState
        error={new ApiError(404, 'Agent report not found')}
        resource="Agent report"
        onRetry={() => void reportQuery.refetch()}
        returnTo="/settings?tab=reports"
        returnLabel="Return to Agent Reports"
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">{report.type}</p>
        <h1 className="text-2xl font-bold tracking-tight">{report.title}</h1>
        <p className="text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</p>
      </div>
      <Card>
        <CardContent className="py-4 whitespace-pre-wrap text-sm">{report.body}</CardContent>
      </Card>
    </div>
  )
}
