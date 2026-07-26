import { useParams } from 'react-router-dom'
import { useAgentReport } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export function AgentReportPage() {
  const { agentReportId } = useParams<{ agentReportId: string }>()
  const { data, isLoading } = useAgentReport(agentReportId!)

  if (isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />

  const report = data?.data
  if (!report) return <p className="text-center text-muted-foreground py-16">Not found.</p>

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">{report.type}</p>
        <h1 className="text-xl font-semibold">{report.title}</h1>
        <p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</p>
      </div>
      <Card>
        <CardContent className="py-4 whitespace-pre-wrap text-sm">{report.body}</CardContent>
      </Card>
    </div>
  )
}
