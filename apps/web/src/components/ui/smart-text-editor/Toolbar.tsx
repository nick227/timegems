import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Italic, Heading2, List, ListOrdered, Link2, Mic, MicOff, Image as ImageIcon, Video, Music, Loader2, Sparkles, type LucideIcon } from 'lucide-react'
import { uploadFile, getApiBaseUrl, useTextAssist, type components } from '@timegems/sdk'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '../voice/useSpeechRecognition'

type TextAssistMode = components['schemas']['TextAssistMode']
type MediaKind = 'image' | 'video' | 'audio'

// One entry per insertable media kind -- adding a new one (unlikely, but
// e.g. a future document/PDF embed) means adding a row here, not a new
// hand-copied ToolbarButton block.
const MEDIA_KINDS: { kind: MediaKind; label: string; accept: string; icon: LucideIcon }[] = [
  { kind: 'image', label: 'Insert image', accept: 'image/*', icon: ImageIcon },
  { kind: 'video', label: 'Insert video', accept: 'video/*', icon: Video },
  { kind: 'audio', label: 'Insert audio', accept: 'audio/*', icon: Music },
]

// Same reasoning for AI-assist modes -- this list is the one place a new
// `TextAssistMode` (spec + TextAssistService) needs a toolbar entry added.
// Typed against the generated enum so adding a mode to the spec without
// adding a row here is instantly a real (if easy to miss) TODO, not a
// silent gap -- see TextAssistService.ts server-side for its own mirror
// of this "one row per mode" rule.
const TEXT_ASSIST_MODES: { mode: TextAssistMode; label: string }[] = [
  { mode: 'enhance', label: 'Enhance' },
  { mode: 'summarize', label: 'Summarize' },
]

interface ToolbarButtonProps {
  onClick: () => void
  children: ReactNode
  label: string
  // Independent toggle-formatting state (Bold/Italic/Heading/Lists/Link/
  // Voice) -- exposed as aria-pressed. Mutually exclusive with `expanded`:
  // a button is either a toggle or a disclosure trigger, never both.
  pressed?: boolean
  // Disclosure-trigger state (the AI-assist menu) -- exposed as
  // aria-expanded + aria-haspopup instead of aria-pressed, since "is this
  // menu open" isn't the same relationship as "is bold currently applied."
  expanded?: boolean
  hasPopup?: 'menu' | 'listbox'
}

function ToolbarButton({ onClick, children, label, pressed, expanded, hasPopup }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={hasPopup ? expanded : undefined}
      aria-haspopup={hasPopup}
      // Prevent the button itself from stealing focus/selection away from
      // the editor -- formatting should apply to whatever was selected.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded transition-colors',
        pressed || expanded
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
    >
      {children}
    </button>
  )
}

interface ToolbarProps {
  editor: Editor
}

// Deliberately understated: small icon-only buttons, no labels, no visible
// container chrome beyond a hairline top border -- functional depth without
// visual weight, matching the bold-minimal/low-profile direction.
export function Toolbar({ editor }: ToolbarProps) {
  const [linkPrompt, setLinkPrompt] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [pendingMediaKind, setPendingMediaKind] = useState<MediaKind | null>(null)
  const [assistMenuOpen, setAssistMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const assistMenuRef = useRef<HTMLDivElement>(null)
  const textAssist = useTextAssist()

  // A real menu, so it should behave like one: Escape and clicking outside
  // both close it, not just picking an item. (Popup-open focus stays in the
  // editor rather than moving into the menu -- same "don't steal selection"
  // reasoning as ToolbarButton's onMouseDown preventDefault -- so this is a
  // click/Escape listener, not a focus-trap like Dialog/Drawer use.)
  useEffect(() => {
    if (!assistMenuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (!assistMenuRef.current?.contains(e.target as Node)) setAssistMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAssistMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [assistMenuOpen])

  const speech = useSpeechRecognition({
    continuous: true,
    onResult: (transcript) => {
      editor.chain().focus().insertContent(`${transcript} `).run()
    },
  })

  function applyLink() {
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setLinkPrompt(false)
    setLinkUrl('')
  }

  function pickMedia(kind: MediaKind) {
    if (pendingMediaKind) return
    setPendingMediaKind(kind)
    const input = fileInputRef.current
    if (!input) return
    input.accept = MEDIA_KINDS.find((m) => m.kind === kind)!.accept
    input.value = ''
    input.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const kind = pendingMediaKind
    if (!file || !kind) {
      setPendingMediaKind(null)
      return
    }
    try {
      const { url } = await uploadFile(file)
      // The server returns a path relative to *its own* origin -- resolve
      // it against the API base URL, not the page's own origin, since the
      // frontend and API can (and in dev do) run on different ports.
      const absoluteUrl = new URL(url, getApiBaseUrl()).toString()
      const chain = editor.chain().focus()
      if (kind === 'image') chain.setImage({ src: absoluteUrl }).run()
      else chain.insertContent({ type: kind, attrs: { src: absoluteUrl } }).run()
    } catch (err) {
      // uploadFile is a plain fetch, not a React Query mutation, so it isn't
      // covered by the app's global MutationCache.onError toast -- surface
      // it here instead, matching that same toast.error(message) convention.
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPendingMediaKind(null)
    }
  }

  async function applyAssist(mode: TextAssistMode) {
    setAssistMenuOpen(false)
    const text = editor.getText().trim()
    if (!text) return
    try {
      const { data } = await textAssist.mutateAsync({ text, mode })
      // Plain text in, plain text back -- insert as literal text content
      // (not an HTML string) so nothing in the result is misread as markup.
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: data.result ? [{ type: 'text', text: data.result }] : [] }],
      })
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-t border-input-border/50">
      <ToolbarButton label="Bold" pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton label="Italic" pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Heading"
        pressed={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        pressed={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        pressed={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarButton>

      {linkPrompt ? (
        <input
          // Focuses on mount (this input only exists once `linkPrompt` is
          // true, i.e. right after the user clicked to reveal it) without
          // the JSX `autoFocus` attribute jsx-a11y flags -- a callback ref
          // that fires exactly once, when the node is first attached, gets
          // the same "focus what was just revealed" behavior.
          ref={(el) => el?.focus()}
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyLink()
            }
            if (e.key === 'Escape') setLinkPrompt(false)
          }}
          onBlur={applyLink}
          placeholder="https://..."
          aria-label="Link URL"
          className="h-6 w-32 rounded border border-input-border bg-transparent px-1.5 text-xs focus-visible:outline-none"
        />
      ) : (
        <ToolbarButton label="Link" pressed={editor.isActive('link')} onClick={() => setLinkPrompt(true)}>
          <Link2 size={14} />
        </ToolbarButton>
      )}

      {speech.supported && (
        <ToolbarButton
          label={speech.listening ? 'Stop voice input' : 'Voice input'}
          pressed={speech.listening}
          onClick={speech.toggle}
        >
          {speech.listening ? <MicOff size={14} className="text-destructive" /> : <Mic size={14} />}
        </ToolbarButton>
      )}
      {speech.interimTranscript && (
        <span role="status" className="max-w-40 truncate text-xs text-muted-foreground">
          {speech.interimTranscript}
        </span>
      )}

      {MEDIA_KINDS.map(({ kind, label, icon: Icon }) => (
        <ToolbarButton key={kind} label={label} onClick={() => pickMedia(kind)}>
          {pendingMediaKind === kind ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
        </ToolbarButton>
      ))}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      <div className="relative" ref={assistMenuRef}>
        <ToolbarButton
          label="AI assist"
          expanded={assistMenuOpen}
          hasPopup="menu"
          onClick={() => setAssistMenuOpen((open) => !open)}
        >
          {textAssist.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </ToolbarButton>
        {assistMenuOpen && (
          <div role="menu" aria-label="AI assist" className="absolute bottom-full left-0 mb-1 min-w-28 rounded border border-input-border bg-surface py-1 shadow-md">
            {TEXT_ASSIST_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyAssist(mode)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent/50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
