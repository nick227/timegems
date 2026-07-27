import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, useCurrentUser, useAnonymousAuth } from '@timegems/sdk'
import { PageSpinner } from '@/components/ui/Spinner'
import { AuthorizationProvider } from './Authorization'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

// A 401 with no session at all no longer means "send them to /login" -- it
// means "give them an instant guest account," so the very first thing an
// unauthenticated visitor sees is the app itself, not a sign-in screen.
// /login still exists (see App.tsx: it's a sibling route, outside this
// guard) as an explicit destination for someone who wants to sign into an
// *existing* account instead of getting a new anonymous one.
export function AuthGuard() {
  const authQuery = useCurrentUser()
  const { data, isLoading } = authQuery
  const location = useLocation()
  const navigate = useNavigate()
  const anonymousAuth = useAnonymousAuth()
  const attemptedRef = useRef(false)

  const isNoSession = authQuery.isError && authQuery.error instanceof ApiError && authQuery.error.status === 401

  useEffect(() => {
    if (isNoSession && !attemptedRef.current) {
      attemptedRef.current = true
      anonymousAuth.mutate()
    }
    // Deliberately keyed only on isNoSession -- anonymousAuth's identity
    // changes every render (it's a fresh mutation object from the hook),
    // and attemptedRef is what actually prevents a retry loop.
  }, [isNoSession])

  if (isLoading) return <PageSpinner />

  if (isNoSession) {
    if (anonymousAuth.isError) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't start a session"
          titleAs="h1"
          description={
            anonymousAuth.error instanceof ApiError
              ? anonymousAuth.error.message
              : 'The service may be temporarily unavailable.'
          }
          action={{ label: 'Sign in instead', onClick: () => navigate('/login', { replace: true }) }}
        />
      )
    }
    // Anonymous creation is in flight, or has succeeded and /auth/me is
    // about to refetch with the new session -- either way, this resolves
    // itself in the next render or two without further action here.
    return <PageSpinner />
  }

  if (authQuery.isError) {
    if (authQuery.error instanceof ApiError && authQuery.error.status === 403) {
      return (
        <EmptyState
          icon={ShieldAlert}
          title="Access unavailable"
          titleAs="h1"
          description="Your organization access may have changed. Sign in again or contact an administrator."
          action={{ label: 'Return to sign in', onClick: () => navigate('/login', { replace: true }) }}
        />
      )
    }
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to verify your session"
        titleAs="h1"
        description="The service may be temporarily unavailable. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void authQuery.refetch() }}
      />
    )
  }

  if (!data?.data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, message: 'Sign in to continue.' }} />
  }

  return (
    <AuthorizationProvider value={data.data}>
      <Outlet />
    </AuthorizationProvider>
  )
}
