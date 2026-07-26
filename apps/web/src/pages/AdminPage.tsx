import { useState } from 'react'
import {
  useAdminListTenants,
  useAdminListUsers,
  useAdminListAgentEmployees,
  useAdminUpdateUser,
  useAdminRunAgentEmployee,
} from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Tab = 'tenants' | 'users' | 'agents'

const TABS: { value: Tab; label: string }[] = [
  { value: 'tenants', label: 'Tenants' },
  { value: 'users', label: 'Users' },
  { value: 'agents', label: 'Agent Employees' },
]

function TenantsTab() {
  const { data, isLoading } = useAdminListTenants()
  if (isLoading) return <Skeleton className="h-24 w-full" />
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((tenant: any) => (
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

function UsersTab() {
  const { data, isLoading } = useAdminListUsers()
  const updateMutation = useAdminUpdateUser()
  if (isLoading) return <Skeleton className="h-24 w-full" />
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((user: any) => (
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

function AgentsTab() {
  const { data, isLoading } = useAdminListAgentEmployees()
  const runMutation = useAdminRunAgentEmployee()
  if (isLoading) return <Skeleton className="h-24 w-full" />
  const items = data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="space-y-2">
      {items.map((employee: any) => (
        <Card key={employee.id}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{employee.name}</p>
              <p className="text-xs text-muted-foreground">{employee.kind} · {employee.schedule}</p>
            </div>
            <Button
              size="sm"
              loading={runMutation.isPending}
              onClick={async () => {
                try {
                  await runMutation.mutateAsync(employee.id)
                  toast.success('Run complete — check Reports')
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

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('tenants')

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>

      <div className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              tab === t.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tenants' && <TenantsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'agents' && <AgentsTab />}
    </div>
  )
}
