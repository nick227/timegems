import { useAdminListTenants } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function TenantsTab() {
  const tenantsQuery = useAdminListTenants()
  const { data, isLoading } = tenantsQuery
  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (tenantsQuery.isError) {
    return (
      <QueryErrorState
        error={tenantsQuery.error}
        resource="Tenants"
        onRetry={() => void tenantsQuery.refetch()}
      />
    )
  }
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((tenant) => (
        <Card key={tenant.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.slug}</p>
            </div>
            <span className="text-xs text-muted-foreground">{tenant.plan}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
