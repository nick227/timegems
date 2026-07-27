import { lazy, Suspense } from 'react'
import { toast } from 'sonner'
import {
  useActiveWorkSession,
  useStartWorkSession,
  usePauseWorkSession,
  useResumeWorkSession,
  useReviewWorkSession,
  useStopWorkSession,
  useUpdateWorkSession,
  useNotes,
  useCreateNote,
  useProjects,
  useCreateProject,
  useGemBalances,
  useGoals,
} from '@timegems/sdk'
import { PageSpinner } from '@/components/ui/Spinner'
import { stripHtml } from '@/lib/stripHtml'
import { WorkIdle } from './components/WorkIdle'
import { useWorkTimer } from './hooks/useWorkTimer'
import { useAuthorization } from '@/lib/Authorization'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Button } from '@/components/ui/Button'
import { AlertTriangle } from 'lucide-react'

const WorkActive = lazy(() => import('./components/WorkActive').then((module) => ({ default: module.WorkActive })))
const WorkReview = lazy(() => import('./components/WorkReview').then((module) => ({ default: module.WorkReview })))

export function WorkSessionsRoute() {
  const activeSessionQuery = useActiveWorkSession()
  const { data, isLoading } = activeSessionQuery
  const session = data?.data ?? null

  const startMutation = useStartWorkSession()
  const pauseMutation = usePauseWorkSession()
  const resumeMutation = useResumeWorkSession()
  const reviewMutation = useReviewWorkSession()
  const stopMutation = useStopWorkSession()
  const updateMutation = useUpdateWorkSession(session?.id ?? '')
  const createNoteMutation = useCreateNote(session?.id ?? '')
  const createProjectMutation = useCreateProject()
  const hasActiveSession = Boolean(session)
  const projectsQuery = useProjects(undefined, hasActiveSession)
  const notesQuery = useNotes(session?.id ?? '')
  const gemBalancesQuery = useGemBalances(hasActiveSession)
  const goalsQuery = useGoals({ status: 'ACTIVE' }, hasActiveSession)
  const { data: projectsData } = projectsQuery
  const { data: notesData } = notesQuery
  const { data: gemBalancesData } = gemBalancesQuery
  const { data: goalsData } = goalsQuery
  const { can } = useAuthorization()

  const reviewing = session?.status === 'REVIEWING'
  const elapsedSeconds = useWorkTimer(session?.intervals, session?.status === 'RUNNING')

  if (isLoading) return <PageSpinner />
  if (activeSessionQuery.isError) {
    return (
      <QueryErrorState
        error={activeSessionQuery.error}
        resource="Work"
        onRetry={() => void activeSessionQuery.refetch()}
      />
    )
  }

  if (!session) {
    return <WorkIdle onStart={() => startMutation.mutate({})} loading={startMutation.isPending} />
  }

  const notes = notesData?.pages.flatMap((p) => p.data) ?? session?.notes ?? []
  const projects = projectsData?.pages.flatMap((p) => p.data) ?? []
  // A goal scoped to a project only makes sense once a session is tagged
  // with that same project; tenant-wide goals (no projectId) are always
  // offered, matching the server-side validateGoalForSession rule.
  const goals = (goalsData?.pages.flatMap((p) => p.data) ?? []).filter(
    (g) => !g.projectId || g.projectId === session?.projectId,
  )

  const gemType = session?.project?.gemType ?? null
  const gemBalance = gemBalancesData?.data.find((b) => b.projectId === session?.projectId)
  const carryInSec = gemBalance?.carrySec ?? 0
  const teamId = session?.project?.teamId ?? undefined

  // Seeds the suggestion chips with what this project's own recent notes
  // actually looked like -- deduped, capped, plain-text (chips are a single
  // line, not rich content).
  const recentTexts = [...new Set(notes.map((n) => stripHtml(n.body)).filter(Boolean))].slice(0, 3)
  const supportingDataFailed =
    projectsQuery.isError ||
    notesQuery.isError ||
    gemBalancesQuery.isError ||
    goalsQuery.isError
  const supportingDataWarning = supportingDataFailed ? (
    <div role="alert" className="mx-auto mt-4 flex max-w-xl items-center gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm">
      <AlertTriangle size={18} className="shrink-0 text-destructive" />
      <p className="flex-1">Some project, goal, note, or gem details could not be loaded. Timer controls remain available.</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (projectsQuery.isError) void projectsQuery.refetch()
          if (notesQuery.isError) void notesQuery.refetch()
          if (gemBalancesQuery.isError) void gemBalancesQuery.refetch()
          if (goalsQuery.isError) void goalsQuery.refetch()
        }}
      >
        Retry
      </Button>
    </div>
  ) : null

  async function handleAddNote(body: string) {
    try {
      await createNoteMutation.mutateAsync(body)
    } catch {
      // handled by the global mutation error toast
    }
  }

  async function handleCreateProject(name: string) {
    if (!session) return
    try {
      const created = await createProjectMutation.mutateAsync({ name })
      if (created.data) updateMutation.mutate({ projectId: created.data.id })
    } catch {
      // handled by the global mutation error toast
    }
  }

  if (reviewing) {
    return (
      <Suspense fallback={<PageSpinner />}>
        {supportingDataWarning}
        <WorkReview
        elapsedSeconds={elapsedSeconds}
        projectName={session.project?.name}
        gemType={gemType}
        carryInSec={carryInSec}
        notes={notes}
        saving={stopMutation.isPending}
        resuming={resumeMutation.isPending}
        teamId={teamId}
        onResume={async () => {
          try {
            await resumeMutation.mutateAsync(session.id)
          } catch {
            // handled by the global mutation error toast
          }
        }}
        onSave={async (note) => {
          // An "empty" rich-text editor still yields a non-empty HTML string
          // (e.g. '<p></p>'), so a plain truthiness check no longer detects
          // "nothing was typed" the way it did for plain text. A media-only
          // note (no text, just an embedded image) still counts as content.
          const hasContent = stripHtml(note).length > 0 || /<(img|video|audio)\b/i.test(note)
          try {
            await stopMutation.mutateAsync({ workSessionId: session.id, note: hasContent ? note : undefined })
            toast.success('Session finished')
          } catch {
            // handled by the global mutation error toast
          }
        }}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<PageSpinner />}>
      {supportingDataWarning}
      <WorkActive
      isPaused={session?.status === 'PAUSED'}
      elapsedSeconds={elapsedSeconds}
      startedAt={session!.startedAt}
      gemType={gemType}
      carryInSec={carryInSec}
      onPause={() => pauseMutation.mutate(session!.id)}
      onResume={() => resumeMutation.mutate(session!.id)}
      onStop={async () => {
        try {
          await reviewMutation.mutateAsync(session!.id)
        } catch {
          // handled by the global mutation error toast
        }
      }}
      pausePending={pauseMutation.isPending}
      resumePending={resumeMutation.isPending}
      reviewPending={reviewMutation.isPending}
      projects={projects}
      activeProjectId={session?.projectId}
      onSelectProject={(projectId) => updateMutation.mutate({ projectId })}
      onCreateProject={can('project:manage') ? handleCreateProject : undefined}
      creatingProject={createProjectMutation.isPending}
      goals={goals}
      activeGoalId={session?.goalId}
      onSelectGoal={(goalId) => updateMutation.mutate({ goalId })}
      notes={notes}
      onAddNote={handleAddNote}
      addingNote={createNoteMutation.isPending}
      recentTexts={recentTexts}
      teamId={teamId}
      />
    </Suspense>
  )
}
