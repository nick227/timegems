import { Link, Outlet } from 'react-router-dom'
import { useAppPresenceReporting } from '@/features/presence'
import { useActiveSessionContinuity, FloatingSessionIndicators, StartSessionButton } from '@/features/work-sessions'
import { AccountMenu } from '@/features/account'

// No drawer, no nav list -- Projects/Teams/Agent Reports/Activity/Admin all
// moved into /settings as tabs (see App.tsx, SettingsRoute) once there was
// nowhere else for a nav link to live. What's left is four small pieces of
// persistent chrome, each fixed on every protected screen: identity
// (top-right), branding/home (top-center), starting a session (bottom-left),
// and the active-session switcher (bottom-center) -- reached via AccountMenu
// now, not a hamburger.
export function Shell() {
  // Keeps the browser tab title live ("Working · TimeGems") for as long as
  // a session is running.
  useActiveSessionContinuity()

  // Reports this user's own presence for as long as the Shell is mounted
  // (i.e. the whole time they're logged in), not just on the Work screen --
  // "online" should be true anywhere in the app, "working"/"paused" only
  // reflect an actual active session.
  useAppPresenceReporting()

  return (
    <div className="min-h-screen bg-background">
      {/* A real landmark, not just fixed-positioned siblings floating
          outside any region -- axe's "region" rule (all page content must
          be contained by a landmark) flags exactly that. `contents` means
          this wrapper generates no box of its own, so it has zero effect on
          the fixed/centered positioning below. */}
      <nav aria-label="App" className="contents">
        {/* Top-center, persistent, on every protected screen -- also the way
            back to Work from anywhere, now that there's no drawer "Work"
            link; a click is all "going home" needs. */}
        <Link
          to="/"
          className="fixed top-4 left-1/2 z-20 flex h-12 -translate-x-1/2 items-center rounded-full bg-surface px-4 text-base font-bold tracking-tight text-surface-foreground transition-colors hover:bg-accent"
        >
          TimeGems
        </Link>

        {/* Upper-right, on every protected screen including Work/Idle -- so
            guest status and the way to sign in are visible before someone
            even starts working. This is also the only way to reach
            /settings now (Projects/Teams/Agent Reports/Activity/Admin all
            live there as tabs). */}
        <AccountMenu />

        {/* Lower-left, on every protected screen -- starting another
            concurrent session should never depend on being on `/`, which
            redirects straight to a primary session once one exists (see
            StartSessionButton, WorkIndexRoute). */}
        <StartSessionButton />

        {/* Docked along the bottom, on every protected screen -- lets a user
            with several concurrent sessions (one per project) jump between
            them without returning to `/`, which only ever redirects to a
            single "primary" session. Hides whichever session's own page is
            currently open; renders nothing when there's nothing left to show
            (see FloatingSessionIndicators). */}
        <FloatingSessionIndicators />
      </nav>

      {/* Full-screen content — no persistent sidebar, one screen at a time.
          pt-14 clears the fixed top elements; pages own their own
          min-h-screen so this wrapper doesn't declare a height itself. */}
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  )
}
