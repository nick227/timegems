import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginRoute } from '@/features/auth'
import { WorkIndexRoute, WorkSessionRoute } from '@/features/work-sessions'
import { AuthGuard } from '@/lib/AuthGuard'
import { PageErrorBoundary } from '@/lib/PageErrorBoundary'
import { Shell } from '@/components/layout/Shell'
import { PageSpinner } from '@/components/ui/Spinner'

const ProjectRoute = lazy(() => import('@/features/projects').then((module) => ({ default: module.ProjectRoute })))
const TeamRoute = lazy(() => import('@/features/teams').then((module) => ({ default: module.TeamRoute })))
const UserRoute = lazy(() => import('@/features/users').then((module) => ({ default: module.UserRoute })))
const ReportRoute = lazy(() => import('@/features/reports').then((module) => ({ default: module.ReportRoute })))
const IntegrationsRoute = lazy(() =>
  import('@/features/integrations').then((module) => ({ default: module.IntegrationsRoute })),
)
const SettingsRoute = lazy(() => import('@/features/account').then((module) => ({ default: module.SettingsRoute })))
const NotFoundRoute = lazy(() =>
  import('@/features/not-found').then((module) => ({ default: module.NotFoundRoute })),
)

function withBoundary(element: React.ReactNode) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageSpinner />}>{element}</Suspense>
    </PageErrorBoundary>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={withBoundary(<LoginRoute />)} />

        {/* Protected — no drawer, no nav list. Work is the index route;
            everything else (Projects, Teams, Agent Reports, Activity,
            Admin) lives as a tab inside /settings (see SettingsRoute) now
            that there's nowhere else for a nav link to live. Detail pages
            for individual entities stay real routes of their own. */}
        <Route element={<AuthGuard />}>
          <Route element={<Shell />}>
            <Route index element={withBoundary(<WorkIndexRoute />)} />
            <Route path="/work/:workSessionId" element={withBoundary(<WorkSessionRoute />)} />
            <Route path="/projects/:projectId" element={withBoundary(<ProjectRoute />)} />
            <Route path="/teams/:teamId" element={withBoundary(<TeamRoute />)} />
            <Route path="/users/:userId" element={withBoundary(<UserRoute />)} />
            <Route path="/reports/:agentReportId" element={withBoundary(<ReportRoute />)} />
            <Route path="/integrations" element={withBoundary(<IntegrationsRoute />)} />
            <Route path="/settings" element={withBoundary(<SettingsRoute />)} />
            <Route path="*" element={withBoundary(<NotFoundRoute />)} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
