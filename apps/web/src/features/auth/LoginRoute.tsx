import { useNavigate, useLocation } from 'react-router-dom'
import { useGoogleAuth } from '@timegems/sdk'
import { GoogleLoginButton } from './components/GoogleLoginButton'
import { EmailAuthForm } from './components/EmailAuthForm'

// This is an opt-in destination now, not the default landing for a new
// visitor -- AuthGuard auto-provisions an instant guest account for anyone
// unauthenticated who lands on a protected route, so most people never see
// this page at all. It exists for someone who specifically wants to sign
// into an *existing* account (Google or email) instead of getting a new
// guest identity, which is also why "Continue as a guest instead" is here:
// it's the way back to that zero-friction path for someone who followed a
// link here without meaning to.
export function LoginRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { from?: string; message?: string } | null
  const redirectTo = state?.from?.startsWith('/') ? state.from : '/'
  const googleAuth = useGoogleAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xs space-y-8 text-center">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">TimeGems</h1>
          {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
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
