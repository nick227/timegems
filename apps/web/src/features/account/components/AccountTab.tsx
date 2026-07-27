import { useState } from 'react'
import { useLogout, useMyTenants } from '@timegems/sdk'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TenantSwitcher } from './TenantSwitcher'
import { ClaimAccountCard } from './ClaimAccountCard'
import { ProfileCard } from './ProfileCard'
import { useAuthorization } from '@/lib/Authorization'

// The "Account" tab of the combined Settings page (see ../SettingsRoute.tsx)
// -- profile, workspace switcher, and logout. This used to be the entire
// Settings page; it's now one panel among several since Projects, Teams,
// Agent Reports, Activity, and (separately) Gem Bank all moved in as tabs
// alongside it.
export function AccountTab() {
  const { user } = useAuthorization()
  const tenantsQuery = useMyTenants()
  const logout = useLogout()
  const navigate = useNavigate()
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  // Solo personal (or any single) workspace has nothing to switch between —
  // showing it just looks like a joinable org. Only surface the section once
  // the user actually belongs to more than one tenant.
  const showWorkspaces = (tenantsQuery.data?.data.length ?? 0) > 1

  async function handleLogout() {
    try {
      await logout.mutateAsync()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="space-y-6">
      <ProfileCard />

      {user.isAnonymous && <ClaimAccountCard />}

      {showWorkspaces && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Workspaces</p>
          <TenantSwitcher />
        </div>
      )}

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
