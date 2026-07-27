import { useEffect } from 'react'
import { useActiveWorkSession } from '@timegems/sdk'
import { useWorkTimer } from './useWorkTimer'
import { formatDuration } from '../lib/formatDuration'

/**
 * Keeps the active session visible outside the Work route and makes the
 * browser tab itself a lightweight running indicator.
 */
export function useActiveSessionContinuity() {
  const query = useActiveWorkSession()
  const session = query.data?.data ?? null
  const elapsedSeconds = useWorkTimer(session?.intervals, session?.status === 'RUNNING')

  useEffect(() => {
    if (session?.status === 'RUNNING') {
      document.title = `${formatDuration(elapsedSeconds)} · TimeGems`
    } else {
      document.title = 'TimeGems'
    }
  }, [elapsedSeconds, session?.status])

  useEffect(() => () => {
    document.title = 'TimeGems'
  }, [])

  return { ...query, session, elapsedSeconds }
}
