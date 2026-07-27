import { useMyTenants, useSelectActiveTenant } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function TenantSwitcher() {
  const tenantsQuery = useMyTenants()
  const { data: tenants, isLoading } = tenantsQuery
  const selectMutation = useSelectActiveTenant()

  if (isLoading) return <Skeleton className="h-16 w-full" />
  if (tenantsQuery.isError) {
    return (
      <QueryErrorState
        error={tenantsQuery.error}
        resource="Organizations"
        onRetry={() => void tenantsQuery.refetch()}
      />
    )
  }

  return (
    <>
      {(tenants?.data ?? []).map((tenant) => (
        <Card key={tenant.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.role}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              loading={selectMutation.isPending}
              onClick={async () => {
                try {
                  await selectMutation.mutateAsync(tenant.id)
                  toast.success(`Switched to ${tenant.name}`)
                } catch {
                  // handled by the global mutation error toast
                }
              }}
            >
              Switch
            </Button>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
