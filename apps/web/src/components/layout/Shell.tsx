import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, Timer, FolderKanban, Users, BarChart3, Sparkles, Target, Settings, ShieldCheck, LogOut, type LucideIcon } from 'lucide-react'
import { useLogout } from '@timegems/sdk'
import { useAppPresenceReporting } from '@/features/presence'
import { useActiveSessionContinuity } from '@/features/work-sessions'
import { AccountMenu } from '@/features/account'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/utils'
import { useAuthorization, type Capability } from '@/lib/Authorization'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; capability?: Capability }
type NavSection = { label: string; items: NavItem[] }

// TimeGems is full-screen and single-focus: there is no persistent sidebar or
// bottom nav competing with the active screen. Everything except the Work
// screen itself lives behind this hamburger menu.
const navSections: NavSection[] = [
  {
    label: 'Work',
    items: [{ to: '/', label: 'Work', icon: Timer, end: true }],
  },
  {
    label: 'Plan',
    items: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/goals', label: 'Goals', icon: Target },
    ],
  },
  {
    label: 'Team',
    items: [
      { to: '/teams', label: 'Teams', icon: Users },
      { to: '/views', label: 'Activity', icon: BarChart3 },
    ],
  },
  {
    label: 'Automation',
    items: [{ to: '/reports', label: 'Agent Reports', icon: Sparkles }],
  },
  {
    label: 'Account',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
  {
    label: 'Administration',
    items: [{ to: '/admin', label: 'Admin', icon: ShieldCheck, capability: 'site:admin' }],
  },
]

export function Shell() {
  const [open, setOpen] = useState(false)
  const logout = useLogout()
  const navigate = useNavigate()
  const { session: activeSession, elapsedSeconds } = useActiveSessionContinuity()
  const { can } = useAuthorization()
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.capability || can(item.capability)),
    }))
    .filter((section) => section.items.length > 0)

  // Reports this user's own presence for as long as the Shell is mounted
  // (i.e. the whole time they're logged in), not just on the Work screen --
  // "online" should be true anywhere in the app, "working"/"paused" only
  // reflect an actual active session.
  useAppPresenceReporting()

  async function handleLogout() {
    setOpen(false)
    try {
      await logout.mutateAsync()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-4 left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-surface-foreground hover:bg-accent transition-colors"
      >
        <Menu size={22} />
      </button>

      {/* Upper-right, on every protected screen including Work/Idle -- so
          guest status and the way to sign in are visible before someone
          even starts working, not just discoverable later in Settings. */}
      <AccountMenu />

      {/* Full-screen content — no persistent chrome, one screen at a time.
          pt-14 clears the fixed hamburger button; pages own their own
          min-h-screen so this wrapper doesn't declare a height itself. */}
      <main className="pt-14">
        <Outlet />
      </main>

      {/* Hamburger drawer — every secondary surface lives here. Focus trap,
          Escape-to-close, inert background, and focus restoration all come
          from Drawer's shared useModalBehavior (see Dialog.tsx for the
          other primitive built on the same hook) -- this used to be a
          hand-rolled overlay with none of that. */}
      <Drawer open={open} onOpenChange={setOpen} title="Main menu">
        <nav className="flex h-full flex-col gap-1 px-4 py-6 overflow-y-auto" aria-label="Main">
          <div className="flex items-center justify-between px-2 pb-6">
            <span className="text-lg font-bold tracking-tight">TimeGems</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {activeSession && (
            <NavLink
              to="/"
              end
              onClick={() => setOpen(false)}
              className="mx-2 mb-5 rounded-lg bg-surface p-3 hover:bg-accent transition-colors"
              aria-label="Return to active work session"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active session</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activeSession.project?.name ?? 'Unassigned work'}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.status === 'RUNNING'
                      ? 'Running'
                      : activeSession.status === 'REVIEWING'
                        ? 'Awaiting review'
                        : 'Paused'}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium">Return to Work</p>
            </NavLink>
          )}

          <div className="flex-1 space-y-5">
            {visibleNavSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </p>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-2 py-2.5 rounded-lg text-base font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                      )
                    }
                  >
                    <item.icon size={20} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <LogOut size={20} />
            Log out
          </button>
        </nav>
      </Drawer>
    </div>
  )
}

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
