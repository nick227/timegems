export type SuggestionContext = 'start' | 'progress' | 'stop' | 'description'

// V1 heuristic -- generic phrases per context, replaceable later by a real
// agent-generated suggestion feed without changing this component's props.
const GENERIC_PHRASES: Record<'start' | 'progress' | 'stop', string[]> = {
  start: ['Fixed a bug', 'In a meeting', 'Reviewing code', 'Writing documentation', 'Debugging an issue'],
  progress: ['Fixed a bug', 'In a meeting', 'Reviewing code', 'Writing documentation', 'Debugging an issue'],
  stop: ['Finished this', 'Halfway done', 'Committed', 'Blocked, need help', 'Wrapping up for today'],
}

const MAX_CHIPS = 5

interface SuggestionChipsProps {
  context: SuggestionContext
  /** The user's own recent note text (plain text, deduped by caller not required) -- shown first, ahead of generic phrases. */
  recentTexts?: string[]
  onSelect: (text: string) => void
}

// 3-5 single-line truncated chips, personalized text first then generic
// phrases filling the remainder. `description` context renders nothing --
// "what am I working on" prompts don't fit a settings/description field.
export function SuggestionChips({ context, recentTexts = [], onSelect }: SuggestionChipsProps) {
  if (context === 'description') return null

  const personalized = [...new Set(recentTexts.filter((t) => t.trim()))].slice(0, 2)
  const chips = [...personalized, ...GENERIC_PHRASES[context]].slice(0, MAX_CHIPS)

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((text, i) => (
        <button
          key={`${text}-${i}`}
          type="button"
          onClick={() => onSelect(text)}
          title={text}
          className="max-w-[12rem] truncate rounded-full border border-input-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
