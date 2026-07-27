import { useEffect, useRef, useState } from 'react'
import type { components } from '@timegems/sdk'
import { RichTextView } from '@/components/ui/RichTextView'
import { cn } from '@/lib/utils'
import { formatTime } from '../lib/formatTime'

type Note = components['schemas']['Note']

// Newest first (matches the API's default order) so whatever was just typed
// in NoteComposer above appears immediately below it, no scrolling needed.
// Newly arrived notes get a fast fade-in so posting doesn't feel like a jump.
export function NoteList({ notes }: { notes: Note[] }) {
  const seenIds = useRef<Set<string> | null>(null)
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(notes.map((note) => note.id))
      return
    }

    const fresh = notes.filter((note) => !seenIds.current!.has(note.id)).map((note) => note.id)
    if (fresh.length === 0) return

    for (const id of fresh) seenIds.current.add(id)
    setEnteringIds((prev) => new Set([...prev, ...fresh]))

    const timer = window.setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev)
        for (const id of fresh) next.delete(id)
        return next
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [notes])

  if (notes.length === 0) return null
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className={cn('space-y-0.5', enteringIds.has(note.id) && 'animate-fade-in-fast')}>
          <RichTextView html={note.body} />
          <p className="text-xs text-muted-foreground">{formatTime(note.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}
