import { toast } from 'sonner'
import { useGoals, useCreateGoal, useUpdateGoal, useProjects } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ListPageShell } from '@/components/ui/ListPageShell'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { Target } from 'lucide-react'
import { GoalCard } from './components/GoalCard'
import { CreateGoalForm } from './components/CreateGoalForm'

export function GoalsRoute() {
  const goalsQuery = useGoals()
  const projectsQuery = useProjects()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = goalsQuery
  const { data: projectsData } = projectsQuery
  const createMutation = useCreateGoal()
  const updateMutation = useUpdateGoal()
  const goals = data?.pages.flatMap((p) => p.data) ?? []
  const projects = projectsData?.pages.flatMap((p) => p.data) ?? []
  const projectName = (id: string | null | undefined) => (id ? projects.find((p) => p.id === id)?.name : undefined)

  async function handleCreate(input: Parameters<typeof createMutation.mutateAsync>[0]) {
    try {
      await createMutation.mutateAsync(input)
      toast.success('Goal created')
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
      <PageHeader
        title="Goals"
        description="Proposed by the Steering agent or created manually. Nothing here takes effect until you approve it."
      />

      <CreateGoalForm projects={projects} onCreate={handleCreate} creating={createMutation.isPending} />

      <ListPageShell
        isLoading={isLoading}
        isEmpty={goals.length === 0}
        skeletonCount={2}
        skeletonClassName="h-24 w-full"
        emptyIcon={Target}
        emptyTitle="No goals yet"
        emptyDescription="The Steering agent will propose goals here based on recent activity, or create one yourself above."
        isError={goalsQuery.isError || projectsQuery.isError}
        errorTitle="Goals could not be loaded"
        onRetry={() => {
          void goalsQuery.refetch()
          void projectsQuery.refetch()
        }}
      >
        <div className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="py-4">
                <GoalCard
                  goal={goal}
                  projectName={projectName(goal.projectId)}
                  updating={updateMutation.isPending}
                  onUpdateStatus={(status) => updateMutation.mutate({ goalId: goal.id, status })}
                  onNudgeProgress={(delta) =>
                    updateMutation.mutate({ goalId: goal.id, progressPercent: Math.min(100, Math.max(0, goal.progressPercent + delta)) })
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </ListPageShell>

      <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onClick={() => fetchNextPage()} />
    </div>
  )
}
