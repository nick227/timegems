import { useState } from 'react'
import { useTabs } from '@/components/ui/hooks/useTabs'
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

// No own page wrapper/heading -- this is now a panel inside the combined
// Settings page's "Admin" tab (see features/account/SettingsRoute.tsx),
// which owns the single h1 for the whole page.
export function AdminRoute() {
  const [tab, setTab] = useState<Tab>('tenants')
  const { tablistProps, getTabProps, getPanelProps } = useTabs('admin', TABS, tab, setTab)

  return (
    <div className="space-y-4">
      <div {...tablistProps} aria-label="Admin sections" className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            {...getTabProps(t.value)}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              tab === t.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div {...getPanelProps(tab)}>
        {tab === 'tenants' && <TenantsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'agents' && <AgentEmployeeList />}
      </div>
    </div>
  )
}
