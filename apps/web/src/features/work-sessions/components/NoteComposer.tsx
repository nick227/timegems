import { useState } from 'react'
import { SmartTextEditor } from '@/components/ui/smart-text-editor'

interface NoteComposerProps {
  onAdd: (body: string) => Promise<void>
  loading: boolean
  /** The user's own recent note bodies for this project (plain text), fed to the suggestion chips. */
  recentTexts?: string[]
  /** Enables @-mentions of teammates, scoped to the project's team if it has one. */
  teamId?: string
}

// The fastest possible capture gesture: rich text (headings/links/lists/
// media/mentions/AI-assist/voice all live in SmartTextEditor itself), Enter
// saves and clears without ever leaving the field -- no separate "Add"
// button to notice, aim for, or wait on.
export function NoteComposer({ onAdd, loading, recentTexts, teamId }: NoteComposerProps) {
  const [draft, setDraft] = useState('')

  async function submit() {
    if (loading) return
    // Clear *before* awaiting the save, not after -- Enter is handled by
    // Tiptap's own ProseMirror `handleKeyDown`, a raw DOM listener entirely
    // outside React's synthetic event system, and calling setDraft('') in
    // this async function's continuation *after* an await (i.e. after the
    // real network round-trip) reproducibly failed to commit: React kept
    // re-rendering with the old draft value even though the state setter
    // had genuinely been called with the right value. Clearing synchronously
    // first sidesteps whatever that interaction is entirely -- and reads as
    // a faster, more optimistic capture gesture besides, which is the whole
    // point of this component.
    const body = draft
    setDraft('')
    await onAdd(body)
  }

  return (
    <SmartTextEditor
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      disabled={loading}
      // Not the DOM autofocus attribute -- SmartTextEditor's own `autoFocus`
      // prop maps to Tiptap's `autofocus: 'end'` editor option (put the
      // cursor at the end of existing content on init). jsx-a11y's rule
      // matches the JSX attribute name on any element, custom or native, so
      // it can't tell the two apart here.
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      placeholder="Quick project updates"
      // No visible label by design -- this is the "fastest possible capture
      // gesture" (see file header), a stacked label would fight that. The
      // placeholder itself doubles as the accessible name here.
      aria-label="Project updates"
      suggestionContext="progress"
      recentTexts={recentTexts}
      teamId={teamId}
    />
  )
}
