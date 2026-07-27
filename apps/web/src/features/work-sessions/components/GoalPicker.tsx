import type { components } from '@timegems/sdk'
import { useRovingRadioGroup } from '@/components/ui/hooks/useRovingRadioGroup'
import { cn } from '@/lib/utils'

type Goal = components['schemas']['Goal']

interface GoalPickerProps {
  goals: Goal[]
  activeGoalId?: string | null
  onSelect: (goalId: string | null) => void
}

// "No goal" is a real, selectable member of this choice set (unlike
// ProjectPicker's "+ New project", which is an action, not an option) --
// represented with this sentinel so it can share useRovingRadioGroup's
// generic string|number value type instead of that hook needing to special-
// case null.
const NONE = '__none__'

// Goal-tagging is optional and only offered for ACTIVE goals already scoped
// to (or unscoped from) the session's current project -- filtering happens
// in the parent so this stays a plain picker, same shape as ProjectPicker.
export function GoalPicker({ goals, activeGoalId, onSelect }: GoalPickerProps) {
  const { groupProps, getItemProps } = useRovingRadioGroup(
    [NONE, ...goals.map((g) => g.id)],
    activeGoalId ?? NONE,
    (next) => onSelect(next === NONE ? null : next),
  )

  if (goals.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground" id="goal-picker-label">
        Working toward a goal?
      </p>
      <div className="flex flex-wrap gap-2" {...groupProps} aria-labelledby="goal-picker-label">
        <button
          {...getItemProps(NONE)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm border transition-colors',
            !activeGoalId ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          No goal
        </button>
        {goals.map((goal) => (
          <button
            key={goal.id}
            {...getItemProps(goal.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              activeGoalId === goal.id ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {goal.title}
          </button>
        ))}
      </div>
    </div>
  )
}
