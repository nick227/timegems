import { useCurrentUser, useMyTenants, useSelectActiveTenant, useLogout } from '@timegems/sdk'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'

export function SettingsPage() {
  const { data: me } = useCurrentUser()
  const { data: tenants, isLoading } = useMyTenants()
  const selectMutation = useSelectActiveTenant()
  const logout = useLogout()
  const navigate = useNavigate()

  const user = me?.data

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {user && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Avatar src={user.avatarUrl} name={user.name} size="lg" />
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Your organizations</p>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          (tenants?.data ?? []).map((tenant: any) => (
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
          ))
        )}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          try {
            await logout.mutateAsync()
          } finally {
            navigate('/login', { replace: true })
          }
        }}
      >
        Log out
      </Button>
    </div>
  )
}
