import type { components } from '@timegems/sdk'
import { RichTextView } from '@/components/ui/RichTextView'
import { formatTime } from '../lib/formatTime'

type Note = components['schemas']['Note']

// Newest first (matches the API's default order) so whatever was just typed
// in NoteComposer above appears immediately below it, no scrolling needed.
// No card/background block per note -- typography and spacing alone carry
// the separation, consistent with the bold-minimal, open-space direction.
export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="space-y-0.5">
          <RichTextView html={note.body} />
          <p className="text-xs text-muted-foreground">{formatTime(note.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}
