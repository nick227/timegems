import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects, useCreateProject, useActiveWorkSession } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ListPageShell } from '@/components/ui/ListPageShell'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthorization } from '@/lib/Authorization'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { StartProjectWorkButton } from './components/StartProjectWorkButton'

export function ProjectsRoute() {
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const debouncedQuery = useDebouncedValue(q.trim())
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useProjects(
    debouncedQuery ? { q: debouncedQuery } : undefined,
  )
  const createMutation = useCreateProject()
  const activeSessionQuery = useActiveWorkSession()
  const activeSession = activeSessionQuery.data?.data ?? null
  const { can } = useAuthorization()
  const canManageProjects = can('project:manage')

  const items = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Projects" />

      {activeSessionQuery.isError && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium">Your current work status could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">Retry before starting work so an existing session is not overlooked.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void activeSessionQuery.refetch()}>
            Retry work status
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        {/* A visible "Search" label above a search box is unusual UX (no
            major product does this) -- aria-label is the right call here,
            not a Field, matching the guidance that visible labels are the
            default but a real fit test still applies. */}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects..." aria-label="Search projects" voice={false} />
      </div>

      {canManageProjects && (
        <div className="flex gap-2 items-end">
          <Field label="New project name" className="flex-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New project name" voice={false} />
          </Field>
          <Button
            loading={createMutation.isPending}
            onClick={async () => {
              if (!newName.trim()) return
              try {
                await createMutation.mutateAsync({ name: newName.trim() })
                setNewName('')
                toast.success('Project created')
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
        emptyIcon={FolderKanban}
        emptyTitle="No projects yet"
        emptyDescription={
          canManageProjects
            ? "Create your first project above — it'll show up on the Work screen next time you start work."
            : 'No projects are available in this organization yet.'
        }
        isError={isError}
        errorTitle="Projects could not be loaded"
        onRetry={() => void refetch()}
      >
        <div className="space-y-2">
          {items.map((project) => (
            <Card key={project.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <Link
                  to={`/projects/${project.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color ?? 'hsl(var(--muted-foreground))' }}
                  />
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  {project.archivedAt && <span className="text-xs text-muted-foreground ml-auto">Archived</span>}
                </Link>
                {!project.archivedAt && (
                  <StartProjectWorkButton
                    projectId={project.id}
                    projectName={project.name}
                    activeSession={activeSession}
                    activeSessionLoading={!activeSessionQuery.isSuccess}
                    size="sm"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ListPageShell>

      <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onClick={() => fetchNextPage()} />
    </div>
  )
}
