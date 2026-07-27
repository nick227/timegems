import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginRoute } from '@/features/auth'
import { WorkSessionsRoute } from '@/features/work-sessions'
import { AuthGuard } from '@/lib/AuthGuard'
import { CapabilityGuard } from '@/lib/CapabilityGuard'
import { PageErrorBoundary } from '@/lib/PageErrorBoundary'
import { Shell } from '@/components/layout/Shell'
import { PageSpinner } from '@/components/ui/Spinner'

const ProjectsRoute = lazy(() => import('@/features/projects').then((module) => ({ default: module.ProjectsRoute })))
const ProjectRoute = lazy(() => import('@/features/projects').then((module) => ({ default: module.ProjectRoute })))
const TeamsRoute = lazy(() => import('@/features/teams').then((module) => ({ default: module.TeamsRoute })))
const TeamRoute = lazy(() => import('@/features/teams').then((module) => ({ default: module.TeamRoute })))
const UserRoute = lazy(() => import('@/features/users').then((module) => ({ default: module.UserRoute })))
const ViewsRoute = lazy(() => import('@/features/views').then((module) => ({ default: module.ViewsRoute })))
const ReportsRoute = lazy(() => import('@/features/reports').then((module) => ({ default: module.ReportsRoute })))
const ReportRoute = lazy(() => import('@/features/reports').then((module) => ({ default: module.ReportRoute })))
const GoalsRoute = lazy(() => import('@/features/goals').then((module) => ({ default: module.GoalsRoute })))
const IntegrationsRoute = lazy(() =>
  import('@/features/integrations').then((module) => ({ default: module.IntegrationsRoute })),
)
const SettingsRoute = lazy(() => import('@/features/account').then((module) => ({ default: module.SettingsRoute })))
const AdminRoute = lazy(() => import('@/features/admin').then((module) => ({ default: module.AdminRoute })))
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

        {/* Protected — everything except Work itself lives behind the hamburger menu */}
        <Route element={<AuthGuard />}>
          <Route element={<Shell />}>
            <Route index element={withBoundary(<WorkSessionsRoute />)} />
            <Route path="/projects" element={withBoundary(<ProjectsRoute />)} />
            <Route path="/projects/:projectId" element={withBoundary(<ProjectRoute />)} />
            <Route path="/teams" element={withBoundary(<TeamsRoute />)} />
            <Route path="/teams/:teamId" element={withBoundary(<TeamRoute />)} />
            <Route path="/users/:userId" element={withBoundary(<UserRoute />)} />
            <Route path="/views" element={withBoundary(<ViewsRoute />)} />
            <Route path="/reports" element={withBoundary(<ReportsRoute />)} />
            <Route path="/reports/:agentReportId" element={withBoundary(<ReportRoute />)} />
            <Route path="/goals" element={withBoundary(<GoalsRoute />)} />
            <Route path="/integrations" element={withBoundary(<IntegrationsRoute />)} />
            <Route path="/settings" element={withBoundary(<SettingsRoute />)} />
            <Route element={<CapabilityGuard capability="site:admin" />}>
              <Route path="/admin" element={withBoundary(<AdminRoute />)} />
            </Route>
            <Route path="*" element={withBoundary(<NotFoundRoute />)} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
