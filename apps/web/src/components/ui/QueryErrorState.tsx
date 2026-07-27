import { ApiError } from '@timegems/sdk'
import { AlertTriangle, FileQuestion, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from './EmptyState'

interface QueryErrorStateProps {
  error: unknown
  resource?: string
  onRetry: () => void
  returnTo?: string
  returnLabel?: string
}

export function QueryErrorState({
  error,
  resource = 'Page',
  onRetry,
  returnTo = '/',
  returnLabel = 'Return to Work',
}: QueryErrorStateProps) {
  const navigate = useNavigate()
  const status = error instanceof ApiError ? error.status : undefined

  if (status === 404) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={`${resource} not found`}
        titleAs="h1"
        description="It may have been deleted, archived, or the link may be outdated."
        action={{ label: returnLabel, onClick: () => navigate(returnTo) }}
      />
    )
  }

  if (status === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        titleAs="h1"
        description={`You don't have permission to view this ${resource.toLowerCase()}.`}
        action={{ label: returnLabel, onClick: () => navigate(returnTo) }}
      />
    )
  }

  return (
    <EmptyState
      icon={AlertTriangle}
      title={`${resource} could not be loaded`}
      titleAs="h1"
      description="Check your connection and try again."
      action={{ label: 'Retry', onClick: onRetry }}
    />
  )
}
