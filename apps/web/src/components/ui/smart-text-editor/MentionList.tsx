import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { cn } from '@/lib/utils'

export interface MentionItem {
  id: string
  label: string
}

interface MentionListProps {
  items: MentionItem[]
  command: (item: MentionItem) => void
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

// Shared popup UI for every mention trigger (projects, team members, ...) --
// only the item source and the resulting link target differ per trigger.
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [items])

  function selectItem(index: number) {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div data-testid="mention-list" className="rounded border border-input-border bg-surface px-3 py-2 text-xs text-muted-foreground shadow-md">
        No matches
      </div>
    )
  }

  // Full combobox semantics would need the ProseMirror contenteditable
  // itself to carry role="combobox"/aria-expanded/aria-controls and an
  // aria-activedescendant pointing at the highlighted option's id -- doable
  // in principle, but that element is owned by tiptap, not this component's
  // JSX, so wiring it through is a real follow-up, not done here. This
  // still gets the popup's own static structure right: a real listbox with
  // real, selection-tracked options, keyboard-navigable (arrow keys handled
  // above via the imperative handle tiptap's Suggestion plugin calls).
  return (
    <div data-testid="mention-list" role="listbox" aria-label="Suggestions" className="min-w-40 max-h-56 overflow-y-auto rounded border border-input-border bg-surface py-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectItem(index)}
          className={cn(
            'flex w-full items-center truncate px-3 py-1.5 text-left text-sm transition-colors',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
})
MentionList.displayName = 'MentionList'
