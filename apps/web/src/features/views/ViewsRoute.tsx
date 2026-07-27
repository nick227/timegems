import { useMemo, useState } from 'react'
import {
  useDeleteWorkSession,
  useGoals,
  useProjects,
  useTeams,
  useTimeSummary,
  useUpdateNote,
  useUpdateWorkSession,
  useWorkSessions,
  type components,
} from '@timegems/sdk'
import { BarChart3, ChevronLeft, ChevronRight, Clock3, FolderKanban, Gem, Pencil, Target, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { RichTextView } from '@/components/ui/RichTextView'
import { Skeleton } from '@/components/ui/Skeleton'
import { useRovingRadioGroup } from '@/components/ui/hooks/useRovingRadioGroup'
import { useAuthorization } from '@/lib/Authorization'
import { cn } from '@/lib/utils'
import {
  activityRange,
  activityRangeLabel,
  isCurrentActivityPeriod,
  localDateKey,
  shiftActivityDate,
  type ActivityPeriod,
} from './lib/dateRange'
import { formatDuration } from './lib/formatDuration'
import { SessionCorrectionDialog } from './components/SessionCorrectionDialog'

type Scope = 'individual' | 'team'
type HistoryItem = components['schemas']['WorkSessionHistoryItem']

const PERIODS: { value: ActivityPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function aggregateByProject(
  entries: { projectId: string | null; projectName: string | null; durationSec: number; gemsEarned: number }[],
) {
  const byProject = new Map<
    string,
    { projectId: string | null; projectName: string | null; durationSec: number; gemsEarned: number }
  >()
  for (const entry of entries) {
    const key = entry.projectId ?? 'none'
    const existing = byProject.get(key)
    if (existing) {
      existing.durationSec += entry.durationSec
      existing.gemsEarned += entry.gemsEarned
    } else {
      byProject.set(key, { ...entry })
    }
  }
  return [...byProject.values()]
}

function sessionTimeRange(session: HistoryItem) {
  const format = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${format.format(new Date(session.startedAt))} – ${
    session.stoppedAt ? format.format(new Date(session.stoppedAt)) : 'In progress'
  }`
}

function isCorrected(session: HistoryItem) {
  return !!session.correctedAt
}

function SessionRow({
  session,
  showUser,
  canCorrect,
  onEdit,
  onDelete,
}: {
  session: HistoryItem
  showUser: boolean
  canCorrect: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card role="article" aria-label={`Session for ${session.project?.name ?? 'No project'}`}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">{session.project?.name ?? 'No project'}</p>
            <p className="text-xs text-muted-foreground">{sessionTimeRange(session)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium tabular-nums">{formatDuration(session.activeDurationSec)}</p>
            <p className="text-xs text-muted-foreground">{isCorrected(session) ? 'Corrected' : 'Recorded'}</p>
          </div>
        </div>

        {(showUser || session.goal) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {showUser && <span>{session.user?.name ?? 'Team member'}</span>}
            {session.goal && (
              <span className="flex items-center gap-1">
                <Target size={12} />
                {session.goal.title}
              </span>
            )}
          </div>
        )}

        {session.notes.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {session.notes.map((note) => (
              <RichTextView key={note.id} html={note.body} className="text-muted-foreground" />
            ))}
          </div>
        )}

        {session.gemsAwarded != null && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gem size={13} />
            {session.gemsAwarded} {session.gemsAwarded === 1 ? 'gem' : 'gems'}
          </p>
        )}

        {canCorrect && (
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil size={14} />
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ViewsRoute() {
  const { user, can } = useAuthorization()
  const [period, setPeriod] = useState<ActivityPeriod>('day')
  const [date, setDate] = useState(localDateKey)
  const [scope, setScope] = useState<Scope>('individual')
  const [teamId, setTeamId] = useState<string | undefined>()
  const [editingSession, setEditingSession] = useState<HistoryItem | null>(null)
  const [deletingSession, setDeletingSession] = useState<HistoryItem | null>(null)
  const range = useMemo(() => activityRange(period, date), [period, date])
  const queryEnabled = scope === 'individual' || !!teamId

  const teamsQuery = useTeams()
  const teams = teamsQuery.data?.pages.flatMap((page) => page.data) ?? []
  const projectsQuery = useProjects({ limit: 100 })
  const projects = projectsQuery.data?.pages.flatMap((page) => page.data) ?? []
  const goalsQuery = useGoals({ limit: 100 })
  const goals = goalsQuery.data?.pages.flatMap((page) => page.data) ?? []
  const summaryQuery = useTimeSummary({
    period,
    date,
    scope,
    teamId,
    from: range.from,
    to: range.to,
  })
  const sessionsQuery = useWorkSessions(
    {
      userId: scope === 'individual' ? user.id : undefined,
      teamId: scope === 'team' ? teamId : undefined,
      status: 'STOPPED',
      from: range.from,
      to: range.to,
      limit: 20,
    },
    queryEnabled,
  )

  const summary = summaryQuery.data?.data
  const entries = summary ? (scope === 'team' ? aggregateByProject(summary.entries) : summary.entries) : []
  const sessions = sessionsQuery.data?.pages.flatMap((page) => page.data) ?? []
  const updateSession = useUpdateWorkSession(editingSession?.id ?? '')
  const updateNote = useUpdateNote()
  const deleteSession = useDeleteWorkSession()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'

  const periodGroup = useRovingRadioGroup(
    PERIODS.map((item) => item.value),
    period,
    setPeriod,
  )
  const scopeGroup = useRovingRadioGroup<Scope>(['individual', 'team'], scope, setScope)
  const teamGroup = useRovingRadioGroup(
    teams.map((team) => team.id),
    teamId ?? null,
    setTeamId,
  )

  function retry() {
    if (scope === 'team') void teamsQuery.refetch()
    void summaryQuery.refetch()
    void sessionsQuery.refetch()
  }

  async function saveCorrections(changes: {
    session: { projectId?: string | null; goalId?: string | null; activeDurationSec?: number }
    notes: { noteId: string; body: string }[]
  }) {
    if (!editingSession) return
    const sessionChanged = Object.keys(changes.session).length > 0
    if (!sessionChanged && changes.notes.length === 0) {
      toast.info('No changes to save')
      setEditingSession(null)
      return
    }
    try {
      if (sessionChanged) await updateSession.mutateAsync(changes.session)
      for (const note of changes.notes) await updateNote.mutateAsync(note)
      const recalculated =
        Object.prototype.hasOwnProperty.call(changes.session, 'activeDurationSec') ||
        Object.prototype.hasOwnProperty.call(changes.session, 'projectId')
      toast.success(recalculated ? 'Session corrected — gem totals recalculated' : 'Session corrected')
      setEditingSession(null)
    } catch {
      // handled by the global mutation error toast
    }
  }

  async function confirmDelete() {
    if (!deletingSession) return
    try {
      await deleteSession.mutateAsync(deletingSession.id)
      toast.success(deletingSession.projectId ? 'Session deleted — gem totals recalculated' : 'Session deleted')
      setDeletingSession(null)
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <PageHeader title="Activity" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-surface p-1" {...periodGroup.groupProps} aria-label="Period">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              {...periodGroup.getItemProps(item.value)}
              className={cn(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                period === item.value
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg bg-surface p-1" {...scopeGroup.groupProps} aria-label="Scope">
          <button
            {...scopeGroup.getItemProps('individual')}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              scope === 'individual'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            You
          </button>
          <button
            {...scopeGroup.getItemProps('team')}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              scope === 'team' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Team
          </button>
        </div>
      </div>

      {scope === 'team' && (
        <div className="flex flex-wrap gap-2" {...teamGroup.groupProps} aria-label="Team">
          {teams.map((team) => (
            <button
              key={team.id}
              {...teamGroup.getItemProps(team.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                teamId === team.id
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}

      <section aria-label="Date range" className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Previous ${period}`}
          onClick={() => setDate((current) => shiftActivityDate(period, current, -1))}
        >
          <ChevronLeft size={18} />
        </Button>
        <div className="text-center">
          <p className="font-medium">{activityRangeLabel(period, date)}</p>
          <p className="text-xs text-muted-foreground">{timezone}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Next ${period}`}
          onClick={() => setDate((current) => shiftActivityDate(period, current, 1))}
        >
          <ChevronRight size={18} />
        </Button>
      </section>
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={isCurrentActivityPeriod(period, date)}
          onClick={() => setDate(localDateKey())}
        >
          Today
        </Button>
      </div>

      {scope === 'team' && teamsQuery.isError ? (
        <EmptyState
          icon={BarChart3}
          title="Teams could not be loaded"
          description="Check your connection and try again."
          action={{ label: 'Retry', onClick: retry }}
        />
      ) : scope === 'team' && teamsQuery.isLoading ? (
        <Skeleton className="h-24 w-full" aria-label="Loading teams" />
      ) : scope === 'team' && teams.length === 0 ? (
        <EmptyState icon={BarChart3} title="No teams available" description="Join or create a team to see team activity." />
      ) : scope === 'team' && !teamId ? (
        <EmptyState icon={BarChart3} title="Pick a team" description="Select a team above to see its activity." />
      ) : summaryQuery.isError || sessionsQuery.isError ? (
        <EmptyState
          icon={BarChart3}
          title="Activity could not be loaded"
          description="Check your connection and try again."
          action={{ label: 'Retry', onClick: retry }}
        />
      ) : summaryQuery.isLoading || sessionsQuery.isLoading ? (
        <div className="space-y-3" aria-label="Loading activity">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !summary ? (
        <EmptyState icon={BarChart3} title="Activity unavailable" description="Try this date range again." />
      ) : (
        <>
          <section aria-label="Activity summary" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Time', value: formatDuration(summary.totalDurationSec), icon: Clock3 },
              { label: 'Sessions', value: summary.sessionCount, icon: BarChart3 },
              { label: 'Gems', value: summary.totalGemsEarned, icon: Gem },
              { label: 'Projects', value: summary.projectsWorked, icon: FolderKanban },
              { label: 'Goals', value: summary.goalsAdvanced, icon: Target },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent className="space-y-1 py-3">
                  <metric.icon size={15} className="text-muted-foreground" />
                  <p className="text-lg font-semibold tabular-nums">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {entries.length > 0 && (
            <section className="space-y-2" aria-labelledby="project-breakdown-title">
              <h2 id="project-breakdown-title" className="text-sm font-medium text-muted-foreground">
                By project
              </h2>
              {entries.map((entry) => (
                <Card key={entry.projectId ?? 'none'}>
                  <CardContent className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium">{entry.projectName ?? 'No project'}</span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatDuration(entry.durationSec)}</span>
                      <span className="flex items-center gap-1">
                        <Gem size={13} />
                        {entry.gemsEarned}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          <section className="space-y-2" aria-labelledby="session-history-title">
            <h2 id="session-history-title" className="text-sm font-medium text-muted-foreground">
              Sessions
            </h2>
            {sessions.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title="Nothing tracked yet"
                description="Finished sessions in this period will show up here."
              />
            ) : (
              <>
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    showUser={scope === 'team'}
                    canCorrect={session.userId === user.id || can('session:manage')}
                    onEdit={() => setEditingSession(session)}
                    onDelete={() => setDeletingSession(session)}
                  />
                ))}
                <LoadMoreButton
                  hasNextPage={sessionsQuery.hasNextPage}
                  isFetchingNextPage={sessionsQuery.isFetchingNextPage}
                  onClick={() => void sessionsQuery.fetchNextPage()}
                />
              </>
            )}
          </section>
        </>
      )}

      {editingSession && (
        <SessionCorrectionDialog
          key={editingSession.id}
          session={editingSession}
          projects={projects}
          goals={goals}
          resourcesLoading={projectsQuery.isLoading || goalsQuery.isLoading}
          resourcesError={projectsQuery.isError || goalsQuery.isError}
          saving={updateSession.isPending || updateNote.isPending}
          onClose={() => setEditingSession(null)}
          onRetryResources={() => {
            void projectsQuery.refetch()
            void goalsQuery.refetch()
          }}
          onSave={saveCorrections}
        />
      )}

      <ConfirmDialog
        open={!!deletingSession}
        onOpenChange={(open) => !open && setDeletingSession(null)}
        title="Delete this session?"
        description="This permanently removes its notes and recalculates affected gem totals."
        confirmLabel="Delete session"
        destructive
        loading={deleteSession.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
