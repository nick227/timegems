import { useState } from 'react'
import { useLogout } from '@timegems/sdk'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GemBank } from '@/features/gems'
import { TenantSwitcher } from './components/TenantSwitcher'
import { ClaimAccountCard } from './components/ClaimAccountCard'
import { useAuthorization } from '@/lib/Authorization'

export function SettingsRoute() {
  const { user } = useAuthorization()
  const logout = useLogout()
  const navigate = useNavigate()
  const [confirmingLogout, setConfirmingLogout] = useState(false)

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

      <Card>
        <CardContent className="py-4 flex items-center gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size="lg" />
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </CardContent>
      </Card>

      {user.isAnonymous && <ClaimAccountCard />}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Gem Bank</p>
        <GemBank />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Your organizations</p>
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
