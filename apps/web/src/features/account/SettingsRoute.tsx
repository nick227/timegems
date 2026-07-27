import { useState } from 'react'
import { useLogout, useMyTenants } from '@timegems/sdk'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GemBank } from '@/features/gems'
import { TenantSwitcher } from './components/TenantSwitcher'
import { ClaimAccountCard } from './components/ClaimAccountCard'
import { ProfileCard } from './components/ProfileCard'
import { useAuthorization } from '@/lib/Authorization'

export function SettingsRoute() {
  const { user } = useAuthorization()
  const tenantsQuery = useMyTenants()
  const logout = useLogout()
  const navigate = useNavigate()
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const workspaceCount = tenantsQuery.data?.data.length ?? 0

  async function handleLogout() {
    try {
      await logout.mutateAsync()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <PageHeader title="Settings" />

      <ProfileCard />

      {user.isAnonymous && <ClaimAccountCard />}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Gem Bank</p>
        <GemBank />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {workspaceCount === 1 ? 'Workspace' : 'Workspaces'}
        </p>
        <TenantSwitcher />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => (user.isAnonymous ? setConfirmingLogout(true) : void handleLogout())}
      >
        Log out
      </Button>

      {/* Only guests need the warning -- a real account's data lives on the
          server regardless of this browser's cookies, so logging out has no
          data-loss consequence for them. */}
      <ConfirmDialog
        open={confirmingLogout}
        onOpenChange={setConfirmingLogout}
        title="Log out of this guest account?"
        description="This account only exists in this browser. Once you log out, there's no way back into it unless you saved it above."
        confirmLabel="Log out anyway"
        destructive
        loading={logout.isPending}
        onConfirm={handleLogout}
      />
    </div>
  )
}
