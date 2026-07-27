import { lazy, Suspense } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useWorkSession,
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
  useCurrentUser,
} from '@timegems/sdk'
import { PageSpinner } from '@/components/ui/Spinner'
import { stripHtml } from '@/lib/stripHtml'
import { useWorkTimer } from './hooks/useWorkTimer'
import { useAuthorization } from '@/lib/Authorization'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Share2 } from 'lucide-react'
import { SharedSessionView } from './components/SharedSessionView'

const WorkActive = lazy(() => import('./components/WorkActive').then((module) => ({ default: module.WorkActive })))
const WorkReview = lazy(() => import('./components/WorkReview').then((module) => ({ default: module.WorkReview })))

// The working screen for one specific session, addressed by URL
// (/work/:workSessionId) so a user with several concurrent sessions (one
// per project) can deep-link/switch between them -- see
// FloatingSessionIndicators for the switcher UI and WorkIndexRoute for what
// `/` itself does.
export function WorkSessionRoute() {
  const { workSessionId } = useParams<{ workSessionId: string }>()
  const navigate = useNavigate()
  const sessionQuery = useWorkSession(workSessionId!)
  const { data: meData } = useCurrentUser()
  const currentUserId = meData?.data.user.id
  const session = sessionQuery.data?.data ?? null

  const pauseMutation = usePauseWorkSession()
  const resumeMutation = useResumeWorkSession()
  const reviewMutation = useReviewWorkSession()
  const stopMutation = useStopWorkSession()
  const updateMutation = useUpdateWorkSession(session?.id ?? '')
  const createNoteMutation = useCreateNote(session?.id ?? '')
  const createProjectMutation = useCreateProject()
  const isOwnSession = Boolean(session && currentUserId && session.userId === currentUserId)
  const projectsQuery = useProjects(undefined, isOwnSession)
  const notesQuery = useNotes(session?.id ?? '')
  const gemBalancesQuery = useGemBalances(isOwnSession)
  const goalsQuery = useGoals({ status: 'ACTIVE' }, isOwnSession)
  const { data: projectsData } = projectsQuery
  const { data: notesData } = notesQuery
  const { data: gemBalancesData } = gemBalancesQuery
  const { data: goalsData } = goalsQuery
  const { can } = useAuthorization()

  const reviewing = session?.status === 'REVIEWING'
  const elapsedSeconds = useWorkTimer(session?.intervals, session?.status === 'RUNNING')

  if (sessionQuery.isLoading) return <PageSpinner />
  if (sessionQuery.isError) {
    return (
      <QueryErrorState
        error={sessionQuery.error}
        resource="Work session"
        onRetry={() => void sessionQuery.refetch()}
      />
    )
  }
  if (!session) return null

  // A finished session has nothing live left to show on the working screen
  // -- hand off to `/`, which redirects to another active session or Idle.
  // A declarative <Navigate>, not an imperative navigate() call during
  // render (a React anti-pattern -- triggering a side effect while another
  // component is still rendering), keeps this a plain, predictable render.
  if (session.status === 'STOPPED') {
    return <Navigate to="/" replace />
  }

  const notes = notesData?.pages.flatMap((p) => p.data) ?? session.notes ?? []

  // A session's URL is shareable to anyone in the tenant (see
  // SharedSessionView) -- native share sheet where available (mobile),
  // clipboard copy otherwise. Rendered above every branch below, not just
  // the owner's, since a viewer looking at someone else's room may want to
  // pass the link along too.
  async function handleShare() {
    const url = `${window.location.origin}/work/${session!.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: session!.project?.name ?? session!.name, url })
      } catch {
        // User cancelled the native share sheet -- not an error.
      }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  }

  const shareButton = (
    <div className="mx-auto flex max-w-lg justify-end px-4 pt-2">
      <Button variant="ghost" size="sm" onClick={() => void handleShare()}>
        <Share2 size={14} />
        Share
      </Button>
    </div>
  )

  // Pause/resume/stop/note controls all assume ownership server-side, so
  // this renders a read-only view instead -- live presence, this session's
  // notes, and the wider project room, not a dead end.
  if (!isOwnSession) {
    return (
      <>
        {shareButton}
        <SharedSessionView session={session} notes={notes} elapsedSeconds={elapsedSeconds} />
      </>
    )
  }

  const projects = projectsData?.pages.flatMap((p) => p.data) ?? []
  // A goal scoped to a project only makes sense once a session is tagged
  // with that same project; tenant-wide goals (no projectId) are always
  // offered, matching the server-side validateGoalForSession rule.
  const goals = (goalsData?.pages.flatMap((p) => p.data) ?? []).filter(
    (g) => !g.projectId || g.projectId === session.projectId,
  )

  const gemType = session.project?.gemType ?? null
  const gemBalance = gemBalancesData?.data.find((b) => b.projectId === session.projectId)
  const carryInSec = gemBalance?.carrySec ?? 0
  const teamId = session.project?.teamId ?? undefined

  // Seeds the suggestion chips with what this project's own recent notes
  // actually looked like -- deduped, capped, plain-text (chips are a single
  // line, not rich content).
  const recentTexts = [...new Set(notes.map((n) => stripHtml(n.body)).filter(Boolean))].slice(0, 4)
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
    try {
      const created = await createProjectMutation.mutateAsync({ name })
      if (created.data) updateMutation.mutate({ projectId: created.data.id })
    } catch {
      // handled by the global mutation error toast
    }
  }

  if (reviewing) {
    return (
      <>
        {shareButton}
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
            navigate('/')
          } catch {
            // handled by the global mutation error toast
          }
        }}
        />
        </Suspense>
      </>
    )
  }

  return (
    <>
      {shareButton}
      <Suspense fallback={<PageSpinner />}>
      {supportingDataWarning}
      <WorkActive
      workSessionId={session.id}
      isPaused={session.status === 'PAUSED'}
      elapsedSeconds={elapsedSeconds}
      startedAt={session.startedAt}
      gemType={gemType}
      carryInSec={carryInSec}
      onPause={() => pauseMutation.mutate(session.id)}
      onResume={() => resumeMutation.mutate(session.id)}
      onStop={async () => {
        try {
          await reviewMutation.mutateAsync(session.id)
        } catch {
          // handled by the global mutation error toast
        }
      }}
      pausePending={pauseMutation.isPending}
      resumePending={resumeMutation.isPending}
      reviewPending={reviewMutation.isPending}
      projects={projects}
      activeProjectId={session.projectId}
      onSelectProject={(projectId) => updateMutation.mutate({ projectId })}
      onCreateProject={can('project:manage') ? handleCreateProject : undefined}
      creatingProject={createProjectMutation.isPending}
      goals={goals}
      activeGoalId={session.goalId}
      onSelectGoal={(goalId) => updateMutation.mutate({ goalId })}
      notes={notes}
      onAddNote={handleAddNote}
      addingNote={createNoteMutation.isPending}
      recentTexts={recentTexts}
      teamId={teamId}
      />
      </Suspense>
    </>
  )
}
