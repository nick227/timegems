import { useParams } from 'react-router-dom'
import { useProject, useUpdateProject } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data, isLoading } = useProject(projectId!)
  const updateMutation = useUpdateProject(projectId!)

  if (isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />

  const project = data?.data
  if (!project) return <p className="text-center text-muted-foreground py-16">Not found.</p>

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: project.color ?? 'hsl(var(--muted-foreground))' }} />
        {project.name}
      </h1>

      <Card>
        <CardContent className="py-4 space-y-1 text-sm text-muted-foreground">
          <p>Created {new Date(project.createdAt).toLocaleDateString()}</p>
          {project.archivedAt && <p>Archived {new Date(project.archivedAt).toLocaleDateString()}</p>}
        </CardContent>
      </Card>

      <Button
        variant={project.archivedAt ? 'outline' : 'destructive'}
        loading={updateMutation.isPending}
        onClick={async () => {
          try {
            await updateMutation.mutateAsync({ archived: !project.archivedAt })
            toast.success(project.archivedAt ? 'Project restored' : 'Project archived')
          } catch {
            // handled by the global mutation error toast
          }
        }}
      >
        {project.archivedAt ? 'Restore project' : 'Archive project'}
      </Button>
    </div>
  )
}
