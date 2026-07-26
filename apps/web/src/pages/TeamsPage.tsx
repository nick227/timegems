import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTeams, useCreateTeam } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Users } from 'lucide-react'
import { toast } from 'sonner'

export function TeamsPage() {
  const [newName, setNewName] = useState('')
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTeams()
  const createMutation = useCreateTeam()

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const items = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Team</h1>

      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New team name" voice={false} />
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

      {items.length === 0 ? (
        <EmptyState icon={Users} title="No teams yet" description="Create a team above to group members for reporting." />
      ) : (
        <div className="space-y-2">
          {items.map((team: any) => (
            <Link key={team.id} to={`/teams/${team.id}`}>
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-3 text-sm font-medium">{team.name}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
