import { useAdminListAgentEmployees, useAdminRunAgentEmployee } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/formatDate'
import { toast } from 'sonner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

// Agent-*employee* admin/run-now UI -- distinct from the `reports` feature
// (the agent-*generated* report feed). Same "agent" prefix, unrelated
// domains; kept as separate features on purpose.
export function AgentEmployeeList() {
  const employeesQuery = useAdminListAgentEmployees()
  const { data, isLoading } = employeesQuery
  const runMutation = useAdminRunAgentEmployee()
  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (employeesQuery.isError) {
    return (
      <QueryErrorState
        error={employeesQuery.error}
        resource="Agent employees"
        onRetry={() => void employeesQuery.refetch()}
      />
    )
  }
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((employee) => (
        <Card key={employee.id}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{employee.name}</p>
              <p className="text-xs text-muted-foreground">
                {employee.kind} · {employee.schedule}
                {employee.lastRunAt && ` · last run ${formatDateTime(employee.lastRunAt)}`}
              </p>
            </div>
            <Button
              size="sm"
              loading={runMutation.isPending}
              onClick={async () => {
                try {
                  await runMutation.mutateAsync(employee.id)
                  toast.success('Run complete — check Agent Reports')
                } catch {
                  // handled by the global mutation error toast
                }
              }}
            >
              Run now
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
