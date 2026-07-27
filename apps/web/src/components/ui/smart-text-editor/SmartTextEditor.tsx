import { useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { cn } from '@/lib/utils'
import { stripHtml } from '@/lib/stripHtml'
import { Toolbar } from './Toolbar'
import { SuggestionChips, type SuggestionContext } from './SuggestionChips'
import { projectMention } from './projectMention'
import { createPeopleMention } from './peopleMention'
import { Video, Audio } from './mediaNodes'

const DRAFT_KEY_PREFIX = 'smart-text-draft:'

export interface SmartTextEditorProps {
  value: string
  onChange: (html: string) => void
  /** Enter submits instead of inserting a newline; Shift+Enter still inserts one. Omit for multi-paragraph contexts (e.g. description fields). */
  onSubmit?: (html: string) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  /** Drives which predictive suggestion-chip phrase set is shown; omit (or 'description') to hide chips entirely. */
  suggestionContext?: SuggestionContext
  /** The user's own recent note text for this project, shown ahead of generic suggestions. */
  recentTexts?: string[]
  /** Enables @-mention suggestions scoped to this team's members; omit if the current context has no team. */
  teamId?: string
  /**
   * Stable identity for this specific capture gesture (e.g. `note-${workSessionId}`,
   * `stop-note-${workSessionId}`) -- when set, unsaved content survives a
   * crash/refresh/closed tab via localStorage, restored on mount and cleared
   * the moment `value` goes back to empty (a real submit, not just the user
   * clearing the field by hand, which also happens to clear it -- both are
   * "nothing left to recover" states, so one code path covers both). Omit
   * for contexts that don't need this (e.g. a field seeded from and always
   * reset to existing server data).
   */
  persistKey?: string
  /** DOM id for the contentEditable root -- lets a <Field>/<Label> connect via htmlFor, same as Input/Textarea. Named literally (not `ariaDescribedBy`) so <Field>'s cloneElement can wire it the same way it does for any native element. */
  id?: string
  /** Accessible name when a visible <Label> genuinely doesn't fit (e.g. NoteComposer's placeholder-only capture gesture). Prefer <Field><Label> over this where a visible label works. */
  'aria-label'?: string
  'aria-describedby'?: string
}

/**
 * The one reusable rich-text input for the whole app -- a real contentEditable
 * element (via Tiptap) supporting headings/links/lists, adaptive height
 * (grows with content up to a capped max-height, no custom resize logic
 * needed), voice-to-text, and a low-profile always-visible formatting bar.
 * Mentions, media embeds, AI-assist, and suggestion chips are layered on in
 * later phases without changing this base shape.
 */
export function SmartTextEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  disabled,
  className,
  suggestionContext,
  recentTexts,
  teamId,
  persistKey,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: SmartTextEditorProps) {
  // Tiptap's editor instance is intentionally stable while the user types.
  // Keep changing React callbacks behind refs so its editorProps never call
  // a first-render closure (notably NoteComposer's submit closure, whose
  // draft value changes on every keystroke).
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit

  const editorRef = useRef<any>(null)

  // Every mention trigger the editor supports, in one place. Adding a new
  // one (e.g. a future `!goal` mention) means adding it to this array --
  // nothing below (extensions, the active-popup check, or the direct
  // key-handoff) needs to know each trigger by name.
  // useEditor below only actually recreates the editor when [teamId]
  // changes, so this only needs to run again on that same condition --
  // matching, rather than fighting, that recreation boundary.
  const mentions = useMemo(() => {
    const peopleMention = teamId ? createPeopleMention(teamId) : undefined
    return [projectMention, ...(peopleMention ? [peopleMention] : [])]
  }, [teamId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // No target/rel override -- mentions link to in-app routes
        // (/projects/:id, /users/:id) and should behave like normal
        // same-tab links, not force a new tab the way an external-link
        // default would. openOnClick stays false so clicking a link while
        // *editing* doesn't navigate away mid-typing; NoteList's read-only
        // rendering intercepts clicks for real in-app navigation instead.
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: null, rel: null } },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write something...' }),
      Image,
      Video,
      Audio,
      ...mentions,
    ],
    content: value,
    editable: !disabled,
    autofocus: autoFocus ? 'end' : false,
    // v3 defaults to false -- we need the toolbar's active-state (isActive)
    // highlighting to update as the selection moves, not just on content change.
    shouldRerenderOnTransaction: true,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-10 max-h-96 overflow-y-auto px-3 py-2 text-sm',
        // contentEditable is exposed as a generic/inconsistent role across
        // browsers unless told otherwise -- make it a real accessible
        // multi-line textbox, same as a native <textarea> gets for free.
        role: 'textbox',
        'aria-multiline': 'true',
        ...(id ? { id } : {}),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
      },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter' || event.shiftKey) return false
        // This runs as a direct EditorView prop, which ProseMirror always
        // checks before any plugin-provided prop -- including the mention
        // Suggestion plugins' own Enter handling (which confirms the
        // highlighted popup item). Left alone, that means Enter here would
        // win every time: either submitting the raw unresolved "#text"/
        // "@text" (if onSubmit is set) or falling through to some other
        // plugin's default Enter behavior (a plain newline), and the
        // Suggestion plugin would never get a chance. So when a popup is
        // open, its handler is invoked directly -- bypassing plugin
        // resolution order entirely -- before any onSubmit logic runs.
        const activeMention = mentions.find((mention) => mention.pluginKey.getState(view.state)?.active === true)
        if (activeMention) return activeMention.handleSuggestionKeyDown(view, event)
        if (!onSubmitRef.current) return false
        // Don't submit empty content -- a media-only note (no text, just an
        // embedded image/video/audio) still counts as real content, so this
        // checks both rather than relying on text alone.
        const hasText = view.state.doc.textContent.trim().length > 0
        const hasMedia = view.dom.querySelector('img, video, audio') !== null
        if (!hasText && !hasMedia) return false
         event.preventDefault()
         if (editorRef.current) {
           onSubmitRef.current(editorRef.current.getHTML())
         } else {
           onSubmitRef.current('')
         }
         return true
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML())
    },
  }, [teamId])

  editorRef.current = editor

  // Push external resets (e.g. clearing the field after submit) into the
  // editor without fighting the user's own typing -- only when `value`
  // genuinely diverges from current content, not on every keystroke's own
  // onChange echo (which would otherwise fight the cursor position).
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  // Draft recovery: restore once, then keep localStorage mirroring `value`
  // from then on -- one effect, not two, deliberately. A separate
  // "restore" effect and "persist" effect race each other: persist doesn't
  // know a restore is pending, so on the very first render (editor still
  // null, value still '') it would see "no content" and delete the saved
  // draft before restore ever gets a chance to read it back -- caught by
  // an actual reload-and-recover test, not just reasoning about it.
  // `restoredRef` makes the restore attempt happen at most once per mount
  // (so clearing the field by hand later doesn't bring an old draft back),
  // and the early `return` on a successful restore skips this same pass's
  // persist step, since a re-render with the real value is already coming.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!editor || !persistKey) return
    const key = DRAFT_KEY_PREFIX + persistKey
    if (!restoredRef.current) {
      restoredRef.current = true
      const saved = localStorage.getItem(key)
      if (saved && !value) {
        onChangeRef.current(saved)
        return
      }
    }
    const hasContent = stripHtml(value).length > 0 || /<(img|video|audio)\b/i.test(value)
    if (hasContent) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  }, [value, editor, persistKey])

  if (!editor) return null

  function handleChipSelect(text: string) {
    if (!editor) return
    const isEmpty = editor.isEmpty
    editor
      .chain()
      .focus('end')
      .insertContent(isEmpty ? text : ` ${text}`)
      .run()
  }

  return (
    <div className="space-y-2">
      <div className={cn('rounded border border-input-border bg-transparent', className)}>
        <EditorContent editor={editor} />
        <Toolbar editor={editor} />
      </div>
      {suggestionContext && (
        <SuggestionChips context={suggestionContext} recentTexts={recentTexts} onSelect={handleChipSelect} />
      )}
    </div>
  )
}
