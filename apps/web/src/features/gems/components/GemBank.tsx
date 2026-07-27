import { useGemBalances } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Gem } from 'lucide-react'
import { GemBadge } from './GemBadge'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function GemBank() {
  const balancesQuery = useGemBalances()
  const { data, isLoading } = balancesQuery
  const balances = data?.data ?? []

  if (isLoading) return <Skeleton className="h-16 w-full" />
  if (balancesQuery.isError) {
    return (
      <QueryErrorState
        error={balancesQuery.error}
        resource="Gem Bank"
        onRetry={() => void balancesQuery.refetch()}
      />
    )
  }

  if (balances.length === 0) {
    return <EmptyState icon={Gem} title="No gems yet" description="Projects with a gem type earn you gems as you work." />
  }

  return (
    <div className="space-y-2">
      {balances.map((balance) => (
        <Card key={`${balance.projectId}-${balance.gemType.id}`}>
          <CardContent className="py-3 flex items-center gap-3">
            <GemBadge icon={balance.gemType.icon} color={balance.gemType.color} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{balance.projectName}</p>
              <p className="text-xs text-muted-foreground">
                {balance.gemType.name}
                {balance.carrySec > 0 && ` · ${Math.floor((3600 - balance.carrySec) / 60)}m to next`}
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums">{balance.totalGems}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
