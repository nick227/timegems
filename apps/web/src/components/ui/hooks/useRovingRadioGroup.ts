import type { KeyboardEvent } from 'react'

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown'])
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * Behavior for a single-choice "pill picker" (ProjectPicker, GoalPicker,
 * ComplexityPicker, ...): exactly one of a small set of options is chosen,
 * same interaction model as a native radio group even though it's rendered
 * as buttons, not <input type="radio">. Per the ARIA APG radio-group
 * pattern: only the checked option (or the first, if none is checked) is a
 * Tab stop; arrow keys move focus *and* selection between options together.
 *
 * Not a visual component -- each picker keeps its own rendering (pills,
 * dots, whatever) and just spreads `getItemProps(option)` onto its buttons
 * plus `groupProps` onto the container. Behavior is what's actually shared
 * across the three call sites; markup differs enough it isn't.
 */
export function useRovingRadioGroup<T extends string | number>(options: readonly T[], value: T | null, onChange: (next: T) => void) {
  function getItemProps(option: T) {
    const checked = value === option
    const isFirstAndNoneChecked = value === null && option === options[0]

    return {
      role: 'radio' as const,
      'aria-checked': checked,
      tabIndex: checked || isFirstAndNoneChecked ? 0 : -1,
      onClick: () => onChange(option),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (!NEXT_KEYS.has(e.key) && !PREV_KEYS.has(e.key)) return
        e.preventDefault()

        const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]')
        const radios = group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')) : []
        const currentIndex = radios.indexOf(e.currentTarget as HTMLElement)
        if (currentIndex === -1 || radios.length === 0) return

        const delta = NEXT_KEYS.has(e.key) ? 1 : -1
        const nextIndex = (currentIndex + delta + radios.length) % radios.length
        radios[nextIndex]?.focus()

        const nextOption = options[nextIndex]
        if (nextOption !== undefined) onChange(nextOption)
      },
    }
  }

  return { groupProps: { role: 'radiogroup' as const }, getItemProps }
}
