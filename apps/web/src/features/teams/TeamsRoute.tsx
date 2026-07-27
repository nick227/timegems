import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTeams, useCreateTeam } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ListPageShell } from '@/components/ui/ListPageShell'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthorization } from '@/lib/Authorization'

export function TeamsRoute() {
  const [newName, setNewName] = useState('')
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useTeams()
  const createMutation = useCreateTeam()
  const { can } = useAuthorization()
  const canManageTeams = can('team:manage')

  const items = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Teams" />

      {canManageTeams && (
        <div className="flex gap-2 items-end">
          <Field label="New team name" className="flex-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team name" voice={false} />
          </Field>
          <Button
            loading={createMutation.isPending}
            onClick={async () => {
              if (!newName.trim()) return
              try {
                await createMutation.mutateAsync({ name: newName.trim() })
                setNewName('')
                toast.success('Team created')
              } catch {
                // handled by the global mutation error toast
              }
            }}
          >
            Create
          </Button>
        </div>
      )}

      <ListPageShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        emptyIcon={Users}
        emptyTitle="No teams yet"
        emptyDescription={
          canManageTeams
            ? 'Create a team above to group members for reporting.'
            : 'No teams are available in this organization yet.'
        }
        isError={isError}
        errorTitle="Teams could not be loaded"
        onRetry={() => void refetch()}
      >
        <div className="space-y-2">
          {items.map((team) => (
            <Link key={team.id} to={`/teams/${team.id}`}>
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-3 text-sm font-medium">{team.name}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </ListPageShell>

      <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onClick={() => fetchNextPage()} />
    </div>
  )
}
