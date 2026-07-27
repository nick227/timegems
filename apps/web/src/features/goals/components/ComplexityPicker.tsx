import { useRovingRadioGroup } from '@/components/ui/hooks/useRovingRadioGroup'
import { cn } from '@/lib/utils'

const LEVELS = [1, 2, 3, 4, 5] as const

interface ComplexityPickerProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md'
}

// Relative sizing (1 trivial - 5 very complex), not a time estimate on its
// own -- rendered as a row of dots. Two different accessibility shapes
// depending on the mode, not one aria-label slapped on regardless:
// read-only (GoalCard) is a single-choice *display*, not a widget, so it's
// one `role="img"` with a summarizing label and decorative dots; editable
// (CreateGoalForm) is a real 1-5 rating picker, which fits the same
// radiogroup/radio pattern as ProjectPicker/GoalPicker.
export function ComplexityPicker({ value, onChange, size = 'md' }: ComplexityPickerProps) {
  const dotClass = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  const { groupProps, getItemProps } = useRovingRadioGroup(LEVELS, value, onChange ?? (() => {}))

  if (!onChange) {
    return (
      <div className="flex items-center gap-1" role="img" aria-label={`Complexity ${value} of 5`}>
        {LEVELS.map((n) => (
          <span key={n} aria-hidden="true" className={cn('rounded-full', dotClass, n <= value ? 'bg-foreground' : 'bg-muted')} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1" {...groupProps} aria-label="Complexity">
      {LEVELS.map((n) => (
        <button
          key={n}
          type="button"
          {...getItemProps(n)}
          className={cn(
            'rounded-full transition-colors cursor-pointer hover:bg-foreground/70',
            dotClass,
            n <= value ? 'bg-foreground' : 'bg-muted',
          )}
          aria-label={`${n}`}
        />
      ))}
    </div>
  )
}
