import { useState } from 'react'
import { useAddTeamMembers, useTenantMembers } from '@timegems/sdk'
import { Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

export function TenantMemberPicker({ teamId }: { teamId: string }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const deferredQuery = useDebouncedValue(query.trim())
  const candidatesQuery = useTenantMembers({
    q: deferredQuery || undefined,
    excludeTeamId: teamId,
    limit: 20,
  })
  const addMembers = useAddTeamMembers(teamId)
  const candidates = candidatesQuery.data?.pages.flatMap((page) => page.data) ?? []

  function toggle(userId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return
    try {
      const count = selectedIds.size
      await addMembers.mutateAsync([...selectedIds])
      setSelectedIds(new Set())
      toast.success(`${count} ${count === 1 ? 'member' : 'members'} added`)
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="add-team-members-title">
      <div>
        <h2 id="add-team-members-title" className="text-sm font-medium">
          Add tenant members
        </h2>
        <p className="text-xs text-muted-foreground">Search by name or email. External invitations are not enabled.</p>
      </div>

      <Field label="Search tenant members">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email"
          voice={false}
        />
      </Field>

      {candidatesQuery.isError ? (
        <EmptyState
          icon={Search}
          title="Tenant members could not be loaded"
          description="Check your connection and try again."
          action={{ label: 'Retry', onClick: () => void candidatesQuery.refetch() }}
        />
      ) : candidatesQuery.isLoading ? (
        <Skeleton className="h-24 w-full" aria-label="Loading tenant members" />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={deferredQuery ? 'No matching tenant members' : 'Everyone is already on this team'}
          description={deferredQuery ? 'Try a different name or email.' : 'There are no additional tenant members to add.'}
        />
      ) : (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <CardContent className="py-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(candidate.id)}
                    onChange={() => toggle(candidate.id)}
                    className="h-4 w-4 rounded border-input-border"
                    aria-label={`Select ${candidate.name}`}
                  />
                  <Avatar name={candidate.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{candidate.email}</span>
                  </span>
                  <span className="rounded bg-accent px-2 py-0.5 text-xs">{candidate.tenantRole}</span>
                </label>
              </CardContent>
            </Card>
          ))}
          <LoadMoreButton
            hasNextPage={candidatesQuery.hasNextPage}
            isFetchingNextPage={candidatesQuery.isFetchingNextPage}
            onClick={() => void candidatesQuery.fetchNextPage()}
          />
        </div>
      )}

      <Button disabled={selectedIds.size === 0} loading={addMembers.isPending} onClick={() => void handleAdd()}>
        <UserPlus size={16} />
        Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}{selectedIds.size === 1 ? 'member' : 'members'}
      </Button>
    </section>
  )
}
