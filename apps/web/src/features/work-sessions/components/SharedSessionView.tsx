import { useQueryClient } from '@tanstack/react-query'
import type { components } from '@timegems/sdk'
import { useProjectNoteEvents } from '@timegems/sdk'
import { PresenceStrip } from '@/features/presence'
import { NoteList } from './NoteList'
import { ProjectActivityFeed } from './ProjectActivityFeed'
import { formatElapsedEstimate } from '../lib/formatDuration'
import { formatTime } from '../lib/formatTime'

type WorkSessionDetail = components['schemas']['WorkSessionDetail']
type Note = components['schemas']['Note']

const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'Working',
  PAUSED: 'Paused',
  REVIEWING: 'Stopped — awaiting review',
}

interface SharedSessionViewProps {
  session: WorkSessionDetail
  notes: Note[]
  elapsedSeconds: number
}

// A session URL is shareable to anyone in the tenant, not just its owner --
// this is what they see: a live, read-only view (presence, this session's
// own notes, and the wider project room), not a dead-end. Pause/Stop/note
// controls stay owner-only server-side, so this deliberately doesn't render
// any of them.
export function SharedSessionView({ session, notes, elapsedSeconds }: SharedSessionViewProps) {
  const queryClient = useQueryClient()

  // This session's own notes come from a one-time fetch (useNotes), which
  // only the owner's browser gets to invalidate (via their own create-note
  // mutation). A viewer's copy would otherwise silently go stale the moment
  // the owner adds something -- refetch it here whenever the room reports a
  // new note that belongs to this specific session.
  useProjectNoteEvents(session.projectId, (event) => {
    if (event.workSessionId === session.id) {
      queryClient.invalidateQueries({ queryKey: ['notes', session.id] })
    }
  })

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-6">
      <section className="space-y-3 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{session.name}</h1>
          <p className="text-sm font-semibold">{STATUS_LABEL[session.status] ?? session.status}</p>
          <p className="text-lg font-medium tracking-tight">{formatElapsedEstimate(elapsedSeconds)} logged</p>
          <p className="text-xs text-muted-foreground">
            {session.user?.name ?? 'A teammate'} · started at {formatTime(session.startedAt)}
          </p>
          {session.project && <p className="text-sm text-muted-foreground">{session.project.name}</p>}
        </div>

        <div className="flex justify-center">
          <PresenceStrip />
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <p className="text-sm font-medium text-muted-foreground">Updates</p>
        <NoteList notes={notes} />
      </section>

      <ProjectActivityFeed projectId={session.projectId} ownWorkSessionId={session.id} />
    </div>
  )
}
