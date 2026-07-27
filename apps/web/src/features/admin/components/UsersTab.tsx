import { useAdminListUsers, useAdminUpdateUser } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function UsersTab() {
  const usersQuery = useAdminListUsers()
  const { data, isLoading } = usersQuery
  const updateMutation = useAdminUpdateUser()
  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (usersQuery.isError) {
    return (
      <QueryErrorState
        error={usersQuery.error}
        resource="Users"
        onRetry={() => void usersQuery.refetch()}
      />
    )
  }
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((user) => (
        <Card key={user.id}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button
              size="sm"
              variant={user.suspendedAt ? 'outline' : 'destructive'}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ userId: user.id, suspended: !user.suspendedAt })}
            >
              {user.suspendedAt ? 'Unsuspend' : 'Suspend'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
