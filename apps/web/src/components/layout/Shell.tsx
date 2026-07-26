import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, Timer, FolderKanban, Users, BarChart3, Sparkles, Plug, Settings, ShieldCheck, LogOut, type LucideIcon } from 'lucide-react'
import { useLogout } from '@timegems/sdk'
import { cn } from '@/lib/utils'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

// TimeGems is full-screen and single-focus: there is no persistent sidebar or
// bottom nav competing with the active screen. Everything except the Work
// screen itself lives behind this hamburger menu.
const navItems: NavItem[] = [
  { to: '/', label: 'Work', icon: Timer, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/teams', label: 'Team', icon: Users },
  { to: '/views', label: 'Views', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: Sparkles },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
]

export function Shell() {
  const [open, setOpen] = useState(false)
  const logout = useLogout()
  const navigate = useNavigate()

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
        className="fixed top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-surface-foreground hover:bg-accent transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Full-screen content — no persistent chrome, one screen at a time.
          pt-14 clears the fixed hamburger button; pages own their own
          min-h-screen so this wrapper doesn't declare a height itself. */}
      <main className="pt-14">
        <Outlet />
      </main>

      {/* Hamburger drawer — every secondary surface lives here */}
      {open && (
        <div className="fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="relative flex h-full w-72 max-w-[85vw] flex-col gap-1 bg-background border-r px-3 py-6 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pb-4">
              <span className="text-sm font-semibold text-muted-foreground">TimeGems</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <LogOut size={18} />
              Log out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
