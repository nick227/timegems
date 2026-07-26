import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTeam, useTeamMembers, useAddTeamMember, useRemoveTeamMember } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, X } from 'lucide-react'
import { toast } from 'sonner'

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { data, isLoading } = useTeam(teamId!)
  const { data: membersData, isLoading: membersLoading } = useTeamMembers(teamId!)
  const addMemberMutation = useAddTeamMember(teamId!)
  const removeMemberMutation = useRemoveTeamMember(teamId!)
  const [userId, setUserId] = useState('')

  if (isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />

  const team = data?.data
  if (!team) return <p className="text-center text-muted-foreground py-16">Not found.</p>

  const members = membersData?.pages.flatMap((p) => p.data) ?? []

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold">{team.name}</h1>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Members</p>

        {membersLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Add a tenant member by their user ID below." />
        ) : (
          <div className="space-y-1">
            {members.map((user: any) => (
              <Card key={user.id}>
                <CardContent className="py-2 flex items-center gap-3">
                  <Avatar name={user.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <button
                    aria-label="Remove member"
                    onClick={() => removeMemberMutation.mutate(user.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X size={16} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID to add" voice={false} />
          <Button
            loading={addMemberMutation.isPending}
            onClick={async () => {
              if (!userId.trim()) return
              try {
                await addMemberMutation.mutateAsync(userId.trim())
                setUserId('')
                toast.success('Member added')
              } catch {
                // handled by the global mutation error toast
              }
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
