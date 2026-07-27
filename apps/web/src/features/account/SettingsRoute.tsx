import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { useTabs } from '@/components/ui/hooks/useTabs'
import { useAuthorization } from '@/lib/Authorization'
import { cn } from '@/lib/utils'
import { AccountTab } from './components/AccountTab'

const ViewsRoute = lazy(() => import('@/features/views').then((m) => ({ default: m.ViewsRoute })))
const ProjectsRoute = lazy(() => import('@/features/projects').then((m) => ({ default: m.ProjectsRoute })))
const TeamsRoute = lazy(() => import('@/features/teams').then((m) => ({ default: m.TeamsRoute })))
const ReportsRoute = lazy(() => import('@/features/reports').then((m) => ({ default: m.ReportsRoute })))
const AdminRoute = lazy(() => import('@/features/admin').then((m) => ({ default: m.AdminRoute })))

type Tab = 'account' | 'activity' | 'projects' | 'teams' | 'reports' | 'admin'

const BASE_TABS: { value: Tab; label: string }[] = [
  { value: 'account', label: 'Account' },
  { value: 'activity', label: 'Activity' },
  { value: 'projects', label: 'Projects' },
  { value: 'teams', label: 'Teams' },
  { value: 'reports', label: 'Agent Reports' },
]

function isTab(value: string | null, tabs: readonly { value: Tab }[]): value is Tab {
  return tabs.some((t) => t.value === value)
}

// Everything that used to be its own drawer-nav destination (Projects,
// Teams, Agent Reports, the standalone Activity page) now lives here as a
// tab, alongside what Settings already had (account, gem bank, logout) --
// one page instead of six, now that there's no drawer to hold six separate
// links. `?tab=` (not just component state) so a detail page's "Return to
// Projects"/"Return to Teams" link (see QueryErrorState call sites) lands
// on the right panel, not just the default one.
export function SettingsRoute() {
  const { can } = useAuthorization()
  const tabs = can('site:admin') ? [...BASE_TABS, { value: 'admin' as const, label: 'Admin' }] : BASE_TABS
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const [tab, setTabState] = useState<Tab>(isTab(requested, tabs) ? requested : 'account')

  function setTab(next: Tab) {
    setTabState(next)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('tab', next)
      return params
    })
  }

  const { tablistProps, getTabProps, getPanelProps } = useTabs('settings', tabs, tab, setTab)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Settings" />

      <div {...tablistProps} aria-label="Settings sections" className="flex gap-1 rounded-lg bg-surface p-1 w-full justify-between">
        {tabs.map((t) => (
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
        <Suspense fallback={<PageSpinner />}>
          {tab === 'account' && <AccountTab />}
          {tab === 'activity' && <ViewsRoute />}
          {tab === 'projects' && <ProjectsRoute />}
          {tab === 'teams' && <TeamsRoute />}
          {tab === 'reports' && <ReportsRoute />}
          {tab === 'admin' && can('site:admin') && <AdminRoute />}
        </Suspense>
      </div>
    </div>
  )
}
