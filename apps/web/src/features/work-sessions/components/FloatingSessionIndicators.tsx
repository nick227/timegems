import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { components } from '@timegems/sdk'
import { useActiveWorkSessions, useProjectNoteEvents } from '@timegems/sdk'
import { useWorkTimer } from '../hooks/useWorkTimer'
import { formatElapsedEstimate } from '../lib/formatDuration'
import { cn } from '@/lib/utils'

type WorkSessionDetail = components['schemas']['WorkSessionDetail']

const STATUS_DOT: Record<string, string> = {
  RUNNING: 'bg-emerald-500',
  PAUSED: 'bg-amber-500',
  REVIEWING: 'bg-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'Running',
  PAUSED: 'Paused',
  REVIEWING: 'Stopped — awaiting review',
}

// The application's whole premise is that sessions run in the background of
// everything else you do, so this bar is global (mounted once in Shell) and
// stays put across every page -- not tucked behind the hamburger, which
// would make a second/third concurrent session invisible unless you went
// looking for it. Docked "minimized conversation" style (bottom, rounded-top
// cards) rather than a chat-head circle, since each one carries a row of
// real info (status, project-room time, unseen activity), not just an
// avatar. The one exception: a session's own row is hidden while its own
// /work/:id page is open -- the page itself already shows everything the
// row would, so keeping the row too would just be the same status twice.
export function FloatingSessionIndicators() {
  const { data } = useActiveWorkSessions()
  const sessions = data?.data ?? []
  const location = useLocation()
  const currentSessionId = location.pathname.match(/^\/work\/([^/]+)/)?.[1]
  const visible = sessions.filter((s) => s.id !== currentSessionId)

  if (visible.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Active sessions"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2 px-4 pb-2"
    >
      {visible.map((session) => (
        <SessionIndicator key={session.id} session={session} />
      ))}
    </div>
  )
}

function SessionIndicator({ session }: { session: WorkSessionDetail }) {
  const navigate = useNavigate()
  const elapsedSeconds = useWorkTimer(session.intervals, session.status === 'RUNNING')
  const [hasUpdate, setHasUpdate] = useState(false)
  const label = session.project?.name ?? session.name
  const statusLabel = STATUS_LABEL[session.status] ?? session.status

  // A note posted by a teammate elsewhere in this project's room shows up
  // as a quiet dot here -- the same signal ProjectActivityFeed renders in
  // full once you're actually on the session's page.
  useProjectNoteEvents(session.projectId, (event) => {
    if (event.workSessionId === session.id) return
    setHasUpdate(true)
  })

  return (
    <button
      type="button"
      onClick={() => {
        setHasUpdate(false)
        navigate(`/work/${session.id}`)
      }}
      aria-label={`${label} — ${statusLabel}, ${formatElapsedEstimate(elapsedSeconds)} in room${hasUpdate ? ', new activity' : ''}`}
      title={`${label} — ${statusLabel}, ${formatElapsedEstimate(elapsedSeconds)} in room`}
      className="pointer-events-auto relative flex min-w-[10rem] items-center gap-2 rounded-t-lg bg-surface px-3 py-2 text-left text-sm shadow-lg transition-colors hover:bg-accent"
    >
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[session.status] ?? 'bg-muted-foreground')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {statusLabel} · {formatElapsedEstimate(elapsedSeconds)}
        </span>
      </span>
      {hasUpdate && (
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
      )}
    </button>
  )
}
