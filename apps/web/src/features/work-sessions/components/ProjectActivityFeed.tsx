import { useEffect, useState } from 'react'
import { useProjectNoteEvents, type ProjectNoteEvent } from '@timegems/sdk'
import { Avatar } from '@/components/ui/Avatar'
import { RichTextView } from '@/components/ui/RichTextView'
import { formatTime } from '../lib/formatTime'

const MAX_ENTRIES = 5

interface ProjectActivityFeedProps {
  projectId: string | null | undefined
  ownWorkSessionId: string
}

// The live half of a project "room": a project with several teammates each
// running their own concurrent session on it (see UserActiveSession) now
// pushes every note in real time (broadcastProjectNote/presence.ts) to
// everyone else presence-tracked as active there. Deliberately distinct
// from NoteList, which only ever shows this session's own notes -- this is
// what's happening in *other* concurrent sessions on the same project.
// Ephemeral like presence itself: only what arrived since this screen
// mounted, nothing persisted or backfilled on reload.
export function ProjectActivityFeed({ projectId, ownWorkSessionId }: ProjectActivityFeedProps) {
  const [entries, setEntries] = useState<ProjectNoteEvent[]>([])

  useProjectNoteEvents(projectId, (event) => {
    // The author's own other tabs are included in the broadcast, but this
    // session's own notes already appear in NoteList above -- showing them
    // here too would just be a duplicate.
    if (event.workSessionId === ownWorkSessionId) return
    setEntries((prev) => [event, ...prev].slice(0, MAX_ENTRIES))
  })

  // A project switch mid-session should clear anything left over from the
  // previous room rather than misattributing it to the new one.
  useEffect(() => {
    setEntries([])
  }, [projectId])

  if (entries.length === 0) return null

  return (
    <section aria-live="polite" className="space-y-3 border-t pt-5">
      <p className="text-sm font-medium text-muted-foreground">Live from the room</p>
      <ul className="space-y-3">
        {entries.map((event) => (
          <li key={event.note.id} className="flex items-start gap-2">
            <Avatar src={event.note.author.avatarUrl} name={event.note.author.name} size="sm" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {event.note.author.name} · {formatTime(event.note.createdAt)}
              </p>
              <RichTextView html={event.note.body} className="line-clamp-2" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
