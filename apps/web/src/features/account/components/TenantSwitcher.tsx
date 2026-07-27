import { useMyTenants, useSelectActiveTenant } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { useAuthorization } from '@/lib/Authorization'

export function TenantSwitcher() {
  const { tenant: activeTenant } = useAuthorization()
  const tenantsQuery = useMyTenants()
  const { data: tenants, isLoading } = tenantsQuery
  const selectMutation = useSelectActiveTenant()
  const list = tenants?.data ?? []

  if (isLoading) return <Skeleton className="h-16 w-full" />
  if (tenantsQuery.isError) {
    return (
      <QueryErrorState
        error={tenantsQuery.error}
        resource="Workspaces"
        onRetry={() => void tenantsQuery.refetch()}
      />
    )
  }

  return (
    <>
      {list.map((tenant) => {
        const isActive = tenant.id === activeTenant?.id
        return (
          <Card key={tenant.id}>
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isActive ? 'Current workspace' : tenant.role}
                </p>
              </div>
              {isActive ? (
                <span className="shrink-0 text-xs text-muted-foreground">Active</span>
              ) : (
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
              )}
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}
