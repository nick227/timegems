import { useActiveWorkSession, usePresenceConnection } from '@timegems/sdk'

/**
 * Reports the current user's own presence for as long as the caller stays
 * mounted. Shell.tsx calls this once so "online" is true anywhere in the
 * app, not just on the Work screen -- "working"/"paused" only reflect an
 * actual active session.
 */
export function useAppPresenceReporting() {
  const { data: activeSessionData } = useActiveWorkSession()
  const activeSession = activeSessionData?.data
  usePresenceConnection({
    status: activeSession ? (activeSession.status === 'RUNNING' ? 'working' : 'paused') : 'online',
    projectId: activeSession?.projectId ?? null,
    sessionStartedAt: activeSession?.startedAt ?? null,
  })
}
