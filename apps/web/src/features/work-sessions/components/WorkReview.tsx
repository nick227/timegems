import { useState } from 'react'
import type { components } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { SmartTextEditor } from '@/components/ui/smart-text-editor'
import { GemProgress } from '@/features/gems'
import { NoteList } from './NoteList'
import { formatDuration } from '../lib/formatDuration'

type Note = components['schemas']['Note']

interface WorkReviewProps {
  workSessionId: string
  sessionName: string
  elapsedSeconds: number
  projectName?: string | null
  carryInSec: number
  notes: Note[]
  onSave: (note: string) => Promise<void>
  onResume: () => Promise<void>
  saving: boolean
  resuming: boolean
  teamId?: string
}

export function WorkReview({
  workSessionId,
  sessionName,
  elapsedSeconds,
  projectName,
  carryInSec,
  notes,
  onSave,
  onResume,
  saving,
  resuming,
  teamId,
}: WorkReviewProps) {
  const [stopNoteDraft, setStopNoteDraft] = useState('')

  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">{sessionName}</h1>
        <p className="text-sm text-muted-foreground">Session summary</p>
        <p className="text-3xl font-semibold tabular-nums">{formatDuration(elapsedSeconds)}</p>
        {projectName && <p className="text-sm text-muted-foreground">{projectName}</p>}
      </div>

      {projectName && <GemProgress carryInSec={carryInSec} elapsedSeconds={elapsedSeconds} />}

      <NoteList notes={notes} />

      <SmartTextEditor
        value={stopNoteDraft}
        onChange={setStopNoteDraft}
        placeholder="Anything else worth noting? (optional)"
        // See NoteComposer.tsx's identical comment -- this maps to Tiptap's
        // `autofocus: 'end'` editor option, not the DOM autofocus attribute.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        suggestionContext="stop"
        teamId={teamId}
        persistKey={`stop-note-${workSessionId}`}
      />

      <div className="space-y-2">
        <Button className="w-full" size="lg" loading={saving} disabled={resuming} onClick={() => onSave(stopNoteDraft)}>
          Finish session
        </Button>
        <Button className="w-full" size="lg" variant="ghost" loading={resuming} disabled={saving} onClick={onResume}>
          Resume working
        </Button>
      </div>
    </div>
  )
}
