import { useState, type KeyboardEvent } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { AgentEmployeeList } from '@/features/agent-employees'
import { TenantsTab } from './components/TenantsTab'
import { UsersTab } from './components/UsersTab'

type Tab = 'tenants' | 'users' | 'agents'

const TABS: { value: Tab; label: string }[] = [
  { value: 'tenants', label: 'Tenants' },
  { value: 'users', label: 'Users' },
  { value: 'agents', label: 'Agent Employees' },
]

// This is a real ARIA tabs widget (switches which panel is rendered below),
// not a single-choice radiogroup like ProjectPicker/GoalPicker/ViewsRoute's
// pickers -- tabs and radiogroups look identical as pill buttons but are
// different widgets (role="tab"+aria-selected+aria-controls vs.
// role="radio"+aria-checked), so this doesn't reuse useRovingRadioGroup.
// Hand-rolled rather than a shared `useTabs` hook since this is currently
// the only tab strip in the app -- revisit if a second one shows up.
export function AdminRoute() {
  const [tab, setTab] = useState<Tab>('tenants')

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const currentIndex = TABS.findIndex((t) => t.value === tab)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + delta + TABS.length) % TABS.length
    const next = TABS[nextIndex]!
    setTab(next.value)
    ;(e.currentTarget.parentElement?.querySelector(`#admin-tab-${next.value}`) as HTMLElement | null)?.focus()
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Admin" />

      <div role="tablist" aria-label="Admin sections" className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            id={`admin-tab-${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            aria-controls={`admin-tabpanel-${t.value}`}
            tabIndex={tab === t.value ? 0 : -1}
            onClick={() => setTab(t.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              tab === t.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`admin-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === 'tenants' && <TenantsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'agents' && <AgentEmployeeList />}
      </div>
    </div>
  )
}
