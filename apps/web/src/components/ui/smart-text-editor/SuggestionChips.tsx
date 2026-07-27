export type SuggestionContext = 'start' | 'progress' | 'stop' | 'description'

// V1 heuristic -- generic phrases per context, replaceable later by a real
// agent-generated suggestion feed without changing this component's props.
const GENERIC_PHRASES: Record<'start' | 'progress' | 'stop', string[]> = {
  start: ['Fixed a bug', 'In a meeting', 'Reviewing code', 'Writing documentation', 'Debugging an issue'],
  progress: [
    'Made progress on the main task',
    'Fixed a bug',
    'Investigating an issue',
    'Reviewing code',
    'Testing the latest changes',
    'Writing documentation',
    'Planning next steps',
    'In a meeting',
    'Waiting on feedback',
    'Blocked, need help',
    'Refactoring and cleanup',
    'Ready for review',
  ],
  stop: ['Finished this', 'Halfway done', 'Committed', 'Blocked, need help', 'Wrapping up for today'],
}

const MAX_CHIPS: Record<'start' | 'progress' | 'stop', number> = {
  start: 5,
  progress: 5,
  stop: 5,
}

interface SuggestionChipsProps {
  context: SuggestionContext
  /** The user's own recent note text (plain text, deduped by caller not required) -- shown first, ahead of generic phrases. */
  recentTexts?: string[]
  onSelect: (text: string) => void
}

// Personalized text comes first, followed by context-specific generic
// phrases, capped at 5 everywhere -- a live audit of the active-work
// composer found the previous 12-chip "progress" set wrapping to enough
// rows that it visually collided with the floating session-indicator bar
// docked at the bottom of the screen, on top of just being more choice than
// a "fastest possible path to a log entry" gesture should offer.
// `description` renders nothing.
export function SuggestionChips({ context, recentTexts = [], onSelect }: SuggestionChipsProps) {
  if (context === 'description') return null

  const personalized = [...new Set(recentTexts.filter((t) => t.trim()))].slice(0, 4)
  const chips = [...new Set([...personalized, ...GENERIC_PHRASES[context]])].slice(0, MAX_CHIPS[context])

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Update suggestions">
      {chips.map((text, i) => (
        <button
          key={`${text}-${i}`}
          type="button"
          onClick={() => onSelect(text)}
          title={text}
          className="max-w-[12rem] truncate rounded-full border border-input-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
