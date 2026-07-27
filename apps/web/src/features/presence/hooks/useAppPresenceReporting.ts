import { useActiveWorkSessions, usePresenceConnection } from '@timegems/sdk'

/**
 * Reports the current user's own presence for as long as the caller stays
 * mounted. Shell.tsx calls this once so "online" is true anywhere in the
 * app, not just on the Work screen -- "working"/"paused" only reflect an
 * actual active session.
 *
 * Presence is keyed per-session server-side: a user can have several
 * concurrent sessions across projects (see UserActiveSession), and every one
 * of them is reported here, not just a single "most active" stand-in. A
 * project's own room (task: live project room) can then tell who's actually
 * present in *that* project specifically, rather than only knowing one
 * derived status per user.
 */
export function useAppPresenceReporting() {
  const { data: activeSessions } = useActiveWorkSessions()
  const sessions = activeSessions?.data ?? []
  usePresenceConnection({
    sessions: sessions
      .filter((s) => s.status === 'RUNNING' || s.status === 'PAUSED')
      .map((s) => ({
        workSessionId: s.id,
        projectId: s.projectId ?? null,
        status: s.status === 'RUNNING' ? ('working' as const) : ('paused' as const),
        sessionStartedAt: s.startedAt,
      })),
  })
}
