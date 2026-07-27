import { ApiError, useStartWorkSession, type components } from '@timegems/sdk'
import { CirclePause, Clock3, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

type ActiveSession = components['schemas']['WorkSessionDetail']

interface StartProjectWorkButtonProps {
  projectId: string
  projectName: string
  activeSession?: ActiveSession | null
  activeSessionLoading?: boolean
  showOtherActiveSession?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StartProjectWorkButton({
  projectId,
  projectName,
  activeSession,
  activeSessionLoading = false,
  showOtherActiveSession = false,
  size = 'md',
}: StartProjectWorkButtonProps) {
  const navigate = useNavigate()
  const startSession = useStartWorkSession()
  const isThisProject = activeSession?.projectId === projectId

  if (isThisProject) {
    const label =
      activeSession.status === 'RUNNING'
        ? 'Working'
        : activeSession.status === 'PAUSED'
          ? 'Paused'
          : 'Review session'
    const Icon = activeSession.status === 'RUNNING' ? Clock3 : CirclePause

    return (
      <Button
        size={size}
        variant={activeSession.status === 'RUNNING' ? 'default' : 'outline'}
        aria-label={`${label} on ${projectName}. Return to Work`}
        onClick={() => navigate('/')}
      >
        <Icon size={15} />
        {label}
      </Button>
    )
  }

  if (activeSession && showOtherActiveSession) {
    const activeProjectName = activeSession.project?.name
    return (
      <Button
        size={size}
        variant="outline"
        aria-label={activeProjectName ? `Return to active work on ${activeProjectName}` : 'Return to active work session'}
        onClick={() => navigate('/')}
      >
        <Clock3 size={15} />
        {activeProjectName ? `Working on ${activeProjectName}` : 'Return to active session'}
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
        toast.info('Returning to your active session')
        navigate('/')
      }
      // Other failures are handled by the global mutation error toast.
    }
  }

  return (
    <Button
      size={size}
      loading={startSession.isPending}
      disabled={activeSessionLoading || Boolean(activeSession)}
      title={activeSession ? 'Finish your active session before starting another project.' : undefined}
      aria-label={`Start work on ${projectName}`}
      onClick={() => void handleStart()}
    >
      <Play size={15} />
      Start work
    </Button>
  )
}
