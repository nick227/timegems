import { ApiError, useStartWorkSession, type components } from '@timegems/sdk'
import { CirclePause, Clock3, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

type ActiveSession = components['schemas']['WorkSessionDetail']

interface StartProjectWorkButtonProps {
  projectId: string
  projectName: string
  // The user's full set of concurrently active sessions (one per project at
  // most -- see UserActiveSession). Only a session matching THIS project
  // blocks starting a new one; sessions on other projects don't, since
  // concurrent sessions across projects are allowed.
  sessions?: ActiveSession[]
  sessionsLoading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StartProjectWorkButton({
  projectId,
  projectName,
  sessions = [],
  sessionsLoading = false,
  size = 'md',
}: StartProjectWorkButtonProps) {
  const navigate = useNavigate()
  const startSession = useStartWorkSession()
  const thisSession = sessions.find((s) => s.projectId === projectId)

  if (thisSession) {
    const label =
      thisSession.status === 'RUNNING'
        ? 'Working'
        : thisSession.status === 'PAUSED'
          ? 'Paused'
          : 'Review session'
    const Icon = thisSession.status === 'RUNNING' ? Clock3 : CirclePause

    return (
      <Button
        size={size}
        variant={thisSession.status === 'RUNNING' ? 'default' : 'outline'}
        aria-label={`${label} on ${projectName}. Return to Work`}
        onClick={() => navigate(`/work/${thisSession.id}`)}
      >
        <Icon size={15} />
        {label}
      </Button>
    )
  }

  async function handleStart() {
    try {
      await startSession.mutateAsync({ projectId })
      toast.success(`Working on ${projectName}`)
      navigate('/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.info('Returning to your active session on this project')
        // `/` redirects to whichever active session is newest, which is
        // this one unless a stale cache raced with another tab/session AND
        // a different session was started even more recently elsewhere --
        // a narrow edge case not worth a direct react-query lookup here
        // just to resolve this project's exact session id.
        navigate('/')
      }
      // Other failures are handled by the global mutation error toast.
    }
  }

  return (
    <Button
      size={size}
      loading={startSession.isPending}
      disabled={sessionsLoading}
      aria-label={`Start work on ${projectName}`}
      onClick={() => void handleStart()}
    >
      <Play size={15} />
      Start work
    </Button>
  )
}
