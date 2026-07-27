import { useNavigate, useLocation } from 'react-router-dom'
import { useGoogleAuth } from '@timegems/sdk'
import { GoogleLoginButton } from './components/GoogleLoginButton'
import { EmailAuthForm } from './components/EmailAuthForm'

// Opt-in destination for signing into an *existing* account (or registering
// a new one), nested under Shell like every other app page. AuthGuard
// auto-provisions a guest for anyone unauthenticated, so most people never
// land here -- Settings' ClaimAccountCard is the in-place path for guests
// who want to keep their current identity. "Continue as a guest instead"
// is the way back to Work for someone who followed a link here without
// meaning to.
export function LoginRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { from?: string; message?: string } | null
  const redirectTo = state?.from?.startsWith('/') ? state.from : '/'
  const googleAuth = useGoogleAuth()

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center px-4 py-10 text-center">
      <div className="w-full space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          {state?.message ? (
            <p className="text-sm text-muted-foreground">{state.message}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Use an existing account, or register a new one.</p>
          )}
        </div>

        <GoogleLoginButton
          onCredential={async (credential) => {
            await googleAuth.mutateAsync(credential)
            navigate(redirectTo)
          }}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <EmailAuthForm redirectTo={redirectTo} />

        <button
          type="button"
          onClick={() => navigate(redirectTo)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Continue as a guest instead
        </button>
      </div>
    </div>
  )
}
