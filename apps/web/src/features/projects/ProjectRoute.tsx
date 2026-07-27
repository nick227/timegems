import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ApiError,
  useProject,
  useUpdateProject,
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useActiveWorkSession,
  useReviewWorkSession,
} from '@timegems/sdk'
import { ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate } from '@/lib/formatDate'
import { GemTypeEditor } from './components/GemTypeEditor'
import { GoalCard, CreateGoalForm } from '@/features/goals'
import { toast } from 'sonner'
import { useAuthorization } from '@/lib/Authorization'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { StartProjectWorkButton } from './components/StartProjectWorkButton'
import { ProjectGoalCsvImport } from './components/ProjectGoalCsvImport'

export function ProjectRoute() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const projectQuery = useProject(projectId!)
  const { data, isLoading } = projectQuery
  const updateMutation = useUpdateProject(projectId!)
  const activeSessionQuery = useActiveWorkSession()
  const reviewSessionMutation = useReviewWorkSession()
  const activeSession = activeSessionQuery.data?.data ?? null
  const goalsQuery = useGoals({ projectId })
  const { data: goalsData } = goalsQuery
  const createGoalMutation = useCreateGoal()
  const updateGoalMutation = useUpdateGoal()
  const goals = goalsData?.pages.flatMap((p) => p.data) ?? []
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const { can, user } = useAuthorization()
  const canManageProjects = can('project:manage')

  if (isLoading) return <Skeleton className="h-48 w-full max-w-xl mx-auto mt-6" />
  if (projectQuery.isError) {
    return (
      <QueryErrorState
        error={projectQuery.error}
        resource="Project"
        onRetry={() => void projectQuery.refetch()}
        returnTo="/projects"
        returnLabel="Return to Projects"
      />
    )
  }

  const project = data?.data
  if (!project) {
    return (
      <QueryErrorState
        error={new ApiError(404, 'Project not found')}
        resource="Project"
        onRetry={() => void projectQuery.refetch()}
        returnTo="/projects"
        returnLabel="Return to Projects"
      />
    )
  }

  async function handleArchiveToggle() {
    try {
      await updateMutation.mutateAsync({ archived: !project!.archivedAt })
      toast.success(project!.archivedAt ? 'Project restored' : 'Project archived')
    } catch {
      // handled by the global mutation error toast
    } finally {
      setConfirmingArchive(false)
    }
  }

  async function handleStopWorking() {
    if (!activeSession) return
    try {
      await reviewSessionMutation.mutateAsync(activeSession.id)
      toast.success('Timing stopped. Review your session to finish it.')
      navigate('/')
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? 'hsl(var(--muted-foreground))' }} />
          {project.name}
        </h1>
        {!project.archivedAt && (
          <StartProjectWorkButton
            projectId={project.id}
            projectName={project.name}
            activeSession={activeSession}
            activeSessionLoading={!activeSessionQuery.isSuccess}
            showOtherActiveSession
          />
        )}
      </div>

      {activeSessionQuery.isError && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium">Your current work status could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">
            Retry before starting work so an existing session is not overlooked.
          </p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void activeSessionQuery.refetch()}>
            Retry work status
          </Button>
        </div>
      )}

      {activeSession?.projectId === project.id && (
        <div role="status" className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-medium">
            {activeSession.status === 'RUNNING'
              ? 'You are working on this project.'
              : activeSession.status === 'PAUSED'
                ? 'Work on this project is paused.'
                : 'This project session is awaiting review.'}
          </p>
          <p className="text-muted-foreground">
            {activeSession.status === 'RUNNING'
              ? user.isAnonymous
                ? 'Timing continues on the server when this browser closes, but recovering this guest account depends on keeping its browser cookie.'
                : 'Timing continues on the server when this browser closes or you log out. Only an explicit Pause or Stop working action changes timing.'
              : activeSession.status === 'REVIEWING'
                ? 'Timing has stopped. Review and finish the session, or resume working.'
                : 'This session stays assigned to the project while paused. Return to Work to resume or finish it.'}
          </p>

          {user.isAnonymous && (
            <div className="flex items-start gap-2 rounded-md bg-background/60 px-3 py-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-muted-foreground">
                Guest recovery is best effort. Logging out, clearing browser data, or changing devices can leave this
                session inaccessible. Save the account in Settings to make it recoverable.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate('/')}>
              {activeSession.status === 'REVIEWING' ? 'Review session' : 'Return to Work'}
            </Button>
            {activeSession.status !== 'REVIEWING' && (
              <Button
                size="sm"
                variant="destructive"
                loading={reviewSessionMutation.isPending}
                onClick={() => void handleStopWorking()}
              >
                Stop working
              </Button>
            )}
            {user.isAnonymous && (
              <Button size="sm" variant="outline" onClick={() => navigate('/settings')}>
                Save account
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="py-4 space-y-1 text-sm text-muted-foreground">
          <p>Created {formatDate(project.createdAt)}</p>
          {project.archivedAt && <p>Archived {formatDate(project.archivedAt)}</p>}
        </CardContent>
      </Card>

      <GemTypeEditor projectId={project.id} gemType={project.gemType ?? null} editable={canManageProjects} />

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Goals</p>
        {goalsData === undefined && !goalsQuery.isError && <Skeleton className="h-24 w-full" />}
        {goalsQuery.isError ? (
          <QueryErrorState
            error={goalsQuery.error}
            resource="Project goals"
            onRetry={() => void goalsQuery.refetch()}
          />
        ) : goals.length === 0 && goalsData !== undefined ? (
          <p className="text-sm text-muted-foreground">No goals for this project yet.</p>
        ) : goals.map((goal) => (
          <Card key={goal.id}>
            <CardContent className="py-4">
              <GoalCard
                goal={goal}
                updating={updateGoalMutation.isPending}
                onUpdateStatus={(status) => updateGoalMutation.mutate({ goalId: goal.id, status })}
                onNudgeProgress={(delta) =>
                  updateGoalMutation.mutate({ goalId: goal.id, progressPercent: Math.min(100, Math.max(0, goal.progressPercent + delta)) })
                }
              />
            </CardContent>
          </Card>
        ))}
        {!goalsQuery.isError && (
          <>
            <div className="flex flex-wrap gap-2">
              <CreateGoalForm
                fixedProjectId={project.id}
                creating={createGoalMutation.isPending}
                onCreate={async (input) => {
                  try {
                    await createGoalMutation.mutateAsync({ ...input, projectId: project.id })
                    toast.success('Goal created')
                  } catch {
                    // handled by the global mutation error toast
                  }
                }}
              />
            </div>
            <ProjectGoalCsvImport projectId={project.id} />
          </>
        )}
      </div>

      {canManageProjects && (
        <>
          {project.archivedAt ? (
            <Button variant="outline" loading={updateMutation.isPending} onClick={handleArchiveToggle}>
              Restore project
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmingArchive(true)}>
              Archive project
            </Button>
          )}

          <ConfirmDialog
            open={confirmingArchive}
            onOpenChange={setConfirmingArchive}
            title="Archive this project?"
            description="Archived projects are hidden from the Work screen's project picker but keep their history and gems."
            confirmLabel="Archive"
            destructive
            loading={updateMutation.isPending}
            onConfirm={handleArchiveToggle}
          />
        </>
      )}
    </div>
  )
}
