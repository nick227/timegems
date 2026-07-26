import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from '@/pages/Login'
import { WorkPage } from '@/pages/WorkPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectPage } from '@/pages/ProjectPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { TeamPage } from '@/pages/TeamPage'
import { ViewsPage } from '@/pages/ViewsPage'
import { AgentReportsPage } from '@/pages/AgentReportsPage'
import { AgentReportPage } from '@/pages/AgentReportPage'
import { IntegrationsPage } from '@/pages/IntegrationsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AdminPage } from '@/pages/AdminPage'
import { AuthGuard } from '@/lib/AuthGuard'
import { PageErrorBoundary } from '@/lib/PageErrorBoundary'
import { Shell } from '@/components/layout/Shell'

function withBoundary(element: React.ReactNode) {
  return <PageErrorBoundary>{element}</PageErrorBoundary>
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={withBoundary(<Login />)} />

        {/* Protected — everything except Work itself lives behind the hamburger menu */}
        <Route element={<AuthGuard />}>
          <Route element={<Shell />}>
            <Route index element={withBoundary(<WorkPage />)} />
            <Route path="/projects" element={withBoundary(<ProjectsPage />)} />
            <Route path="/projects/:projectId" element={withBoundary(<ProjectPage />)} />
            <Route path="/teams" element={withBoundary(<TeamsPage />)} />
            <Route path="/teams/:teamId" element={withBoundary(<TeamPage />)} />
            <Route path="/views" element={withBoundary(<ViewsPage />)} />
            <Route path="/reports" element={withBoundary(<AgentReportsPage />)} />
            <Route path="/reports/:agentReportId" element={withBoundary(<AgentReportPage />)} />
            <Route path="/integrations" element={withBoundary(<IntegrationsPage />)} />
            <Route path="/settings" element={withBoundary(<SettingsPage />)} />
            <Route path="/admin" element={withBoundary(<AdminPage />)} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
