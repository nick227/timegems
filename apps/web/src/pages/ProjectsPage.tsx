import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects, useCreateProject } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FolderKanban } from 'lucide-react'
import { toast } from 'sonner'

export function ProjectsPage() {
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useProjects(q ? { q } : undefined)
  const createMutation = useCreateProject()

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
      <h1 className="text-xl font-semibold">Projects</h1>

      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects..." voice={false} />
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          voice={false}
        />
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

      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project above — it'll show up on the Work screen next time you start work."
        />
      ) : (
        <div className="space-y-2">
          {items.map((project: any) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:bg-accent/40 transition-colors">
                <CardContent className="py-3 flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color ?? 'hsl(var(--muted-foreground))' }}
                  />
                  <span className="text-sm font-medium">{project.name}</span>
                  {project.archivedAt && (
                    <span className="text-xs text-muted-foreground ml-auto">Archived</span>
                  )}
                </CardContent>
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
