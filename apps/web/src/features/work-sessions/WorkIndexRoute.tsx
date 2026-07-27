import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useActiveWorkSessions, useStartWorkSession } from '@timegems/sdk'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { WorkIdle } from './components/WorkIdle'

// `/` is just an entry point, not a session view of its own: with no active
// session it's the single big Start Work button; with one or more, it hands
// off immediately to the primary session's own URL (a running one wins over
// a paused one) rather than duplicating a session view here. Switching
// between several active sessions happens via FloatingSessionIndicators,
// not by coming back through `/`.
export function WorkIndexRoute() {
  const activeSessionsQuery = useActiveWorkSessions()
  const startMutation = useStartWorkSession()
  const navigate = useNavigate()
  const [startError, setStartError] = useState(false)

  if (activeSessionsQuery.isLoading) return <PageSpinner />
  if (activeSessionsQuery.isError) {
    return (
      <QueryErrorState
        error={activeSessionsQuery.error}
        resource="Work"
        onRetry={() => void activeSessionsQuery.refetch()}
      />
    )
  }

  const sessions = activeSessionsQuery.data?.data ?? []
  const primary = sessions.find((s:any) => s.status === 'RUNNING') ?? sessions[0]
  if (primary) return <Navigate to={`/work/${primary.id}`} replace />

  async function handleStart() {
    setStartError(false)
    try {
      const created = await startMutation.mutateAsync({})
      if (created.data) navigate(`/work/${created.data.id}`)
    } catch {
      // The 409 (a session already exists) case is handled by falling back
      // to a retry of the active-sessions query below; other failures are
      // handled by the global mutation error toast.
      setStartError(true)
      void activeSessionsQuery.refetch()
    }
  }

  return <WorkIdle onStart={() => void handleStart()} loading={startMutation.isPending || (startError && activeSessionsQuery.isFetching)} />
}
