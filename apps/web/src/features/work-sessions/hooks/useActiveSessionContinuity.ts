import { useEffect } from 'react'
import { useActiveWorkSessions } from '@timegems/sdk'
import { useWorkTimer } from './useWorkTimer'

/**
 * Keeps the active session(s) visible outside the Work route and makes the
 * browser tab itself a lightweight running indicator.
 *
 * A user can now have several concurrent sessions (one per project). Until
 * the floating per-session indicators land (see the multi-session frontend
 * work), this surfaces a single "primary" session -- a running one wins over
 * a paused one -- for the drawer card and tab title. `sessions` is also
 * returned in full for callers that want the whole list.
 */
export function useActiveSessionContinuity() {
  const query = useActiveWorkSessions()
  const sessions = query.data?.data ?? []
  const session = sessions.find((s) => s.status === 'RUNNING') ?? sessions[0] ?? null
  const elapsedSeconds = useWorkTimer(session?.intervals, session?.status === 'RUNNING')

  useEffect(() => {
    if (session?.status === 'RUNNING') {
      document.title = 'Working · TimeGems'
    } else {
      document.title = 'TimeGems'
    }
  }, [session?.status])

  useEffect(() => () => {
    document.title = 'TimeGems'
  }, [])

  return { ...query, session, sessions, elapsedSeconds }
}
