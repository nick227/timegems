import type { KeyboardEvent } from 'react'

/**
 * Behavior for a real ARIA tabs widget (switches which panel is rendered
 * below) -- a different interaction model from useRovingRadioGroup's
 * radiogroup (role="tab"+aria-selected+aria-controls vs.
 * role="radio"+aria-checked), even though both render as a row of pill
 * buttons. Extracted once a second tab strip appeared (AdminRoute's own
 * comment called this out as the trigger); `namespace` keeps each page's
 * generated ids from colliding with the other's.
 */
export function useTabs<T extends string>(
  namespace: string,
  tabs: readonly { value: T; label: string }[],
  value: T,
  onChange: (next: T) => void,
) {
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const currentIndex = tabs.findIndex((t) => t.value === value)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length
    const next = tabs[nextIndex]!
    onChange(next.value)
    ;(e.currentTarget.parentElement?.querySelector(`#${namespace}-tab-${next.value}`) as HTMLElement | null)?.focus()
  }

  function getTabProps(tabValue: T) {
    return {
      id: `${namespace}-tab-${tabValue}`,
      role: 'tab' as const,
      'aria-selected': value === tabValue,
      'aria-controls': `${namespace}-tabpanel-${tabValue}`,
      tabIndex: value === tabValue ? 0 : -1,
      onClick: () => onChange(tabValue),
      onKeyDown,
    }
  }

  function getPanelProps(tabValue: T) {
    return {
      id: `${namespace}-tabpanel-${tabValue}`,
      role: 'tabpanel' as const,
      'aria-labelledby': `${namespace}-tab-${tabValue}`,
    }
  }

  return { tablistProps: { role: 'tablist' as const }, getTabProps, getPanelProps }
}
