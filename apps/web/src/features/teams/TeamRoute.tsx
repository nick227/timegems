import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError, useTeam, useTeamMembers, useRemoveTeamMember } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PresenceIndicator } from '@/features/presence'
import { Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthorization } from '@/lib/Authorization'
import { TenantMemberPicker } from './components/TenantMemberPicker'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

export function TeamRoute() {
  const { teamId } = useParams<{ teamId: string }>()
  const teamQuery = useTeam(teamId!)
  const membersQuery = useTeamMembers(teamId!, { limit: 100 })
  const removeMemberMutation = useRemoveTeamMember(teamId!)
  const [removingMember, setRemovingMember] = useState<{ id: string; name: string } | null>(null)
  const { can } = useAuthorization()
  const canManageTeams = can('team:manage')

  if (teamQuery.isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />
  if (teamQuery.isError) {
    return (
      <QueryErrorState
        error={teamQuery.error}
        resource="Team"
        onRetry={() => void teamQuery.refetch()}
        returnTo="/settings?tab=teams"
        returnLabel="Return to Teams"
      />
    )
  }

  const team = teamQuery.data?.data
  if (!team) {
    return (
      <QueryErrorState
        error={new ApiError(404, 'Team not found')}
        resource="Team"
        onRetry={() => void teamQuery.refetch()}
        returnTo="/settings?tab=teams"
        returnLabel="Return to Teams"
      />
    )
  }

  const members = membersQuery.data?.pages.flatMap((p) => p.data) ?? []

  async function handleRemoveMember() {
    if (!removingMember) return
    try {
      await removeMemberMutation.mutateAsync(removingMember.id)
      toast.success('Member removed')
    } catch {
      // handled by the global mutation error toast
    } finally {
      setRemovingMember(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Members</p>

        {membersQuery.isError ? (
          <EmptyState
            icon={Users}
            title="Members could not be loaded"
            description="Check your connection and try again."
            action={{ label: 'Retry', onClick: () => void membersQuery.refetch() }}
          />
        ) : membersQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members yet"
            description={canManageTeams ? 'Choose existing tenant members below.' : 'This team has no members yet.'}
          />
        ) : (
          <div className="space-y-1">
            {members.map((user) => (
              <Card key={user.id} role="article" aria-label={`Team member ${user.name}`}>
                <CardContent className="py-2 flex items-center gap-3">
                  <Avatar name={user.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Tenant role: {user.tenantRole}</p>
                    <PresenceIndicator userId={user.id} />
                  </div>
                  {canManageTeams && (
                    <button
                      aria-label={`Remove member ${user.name}`}
                      onClick={() => setRemovingMember({ id: user.id, name: user.name })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      {canManageTeams && <TenantMemberPicker teamId={team.id} />}

      {canManageTeams && (
        <ConfirmDialog
          open={!!removingMember}
          onOpenChange={(open) => !open && setRemovingMember(null)}
          title={`Remove ${removingMember?.name ?? 'this member'} from ${team.name}?`}
          description="They'll lose access to this team's projects and reports. Their own work history is unaffected."
          confirmLabel="Remove"
          destructive
          loading={removeMemberMutation.isPending}
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  )
}
