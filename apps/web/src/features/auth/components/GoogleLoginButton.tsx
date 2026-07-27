import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, config: object) => void
        }
      }
    }
  }
}

interface Props {
  /** Called with the Google ID token once the widget produces one -- sign-in
   * (LoginRoute) and claim/link (Settings, for an anonymous user) both use
   * this same button, differing only in which mutation this calls and what
   * happens after. */
  onCredential: (credential: string) => Promise<void>
  pendingLabel?: string
  /** Override the default sign-in-flavored error copy for a different context (e.g. linking). */
  getErrorMessage?: (error: unknown) => string
}

type GoogleState = 'loading' | 'ready' | 'configuration-error' | 'script-error' | 'initialization-error'
const GOOGLE_SCRIPT_ID = 'google-identity-services'

function loadGoogleScript(forceReload: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (window.google && !forceReload) {
      resolve()
      return
    }

    const previous = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (forceReload || previous?.dataset.status === 'error') previous?.remove()
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing?.dataset.status === 'loaded') {
      if (window.google) resolve()
      else reject(new Error('Google Identity Services did not initialize'))
      return
    }

    const script = existing ?? document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    const timeout = window.setTimeout(() => {
      cleanup()
      script.dataset.status = 'error'
      reject(new Error('Google Identity Services timed out'))
    }, 10_000)
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      script.dataset.status = 'loaded'
      if (window.google) resolve()
      else reject(new Error('Google Identity Services did not initialize'))
    }
    const handleError = () => {
      cleanup()
      script.dataset.status = 'error'
      reject(new Error('Google Identity Services failed to load'))
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)
    if (!existing) document.head.appendChild(script)
  })
}

function defaultErrorMessage(error: unknown) {
  return error instanceof ApiError && error.status === 403
    ? 'This account is not allowed to sign in.'
    : error instanceof ApiError && error.status === 400
      ? 'Google could not verify this sign-in. Please try again.'
      : 'The sign-in service is unavailable. Please try again.'
}

export function GoogleLoginButton({ onCredential, pendingLabel = 'Signing in...', getErrorMessage = defaultErrorMessage }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential
  const [googleState, setGoogleState] = useState<GoogleState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setGoogleState('configuration-error')
      return
    }

    let cancelled = false
    setGoogleState('loading')
    void loadGoogleScript(attempt > 0)
      .then(() => {
        if (cancelled || !window.google || !ref.current) return
        try {
          ref.current.replaceChildren()
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async ({ credential }: { credential: string }) => {
              setStatus('pending')
              setError(null)
              try {
                await onCredentialRef.current(credential)
                setStatus('idle')
              } catch (err) {
                setStatus('error')
                setError(err)
              }
            },
          })
          window.google.accounts.id.renderButton(ref.current, {
            theme: 'outline',
            size: 'large',
            width: ref.current.offsetWidth || 300,
          })
          setGoogleState('ready')
        } catch {
          setGoogleState('initialization-error')
        }
      })
      .catch(() => {
        if (!cancelled) setGoogleState('script-error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <div className="flex flex-col items-center gap-3">
      {/* min-h reserves the real button's footprint so there's no layout
          shift once Google's script populates it (and gives this slot a
          non-zero size even when it doesn't, e.g. in dev/CI without real
          OAuth credentials configured). */}
      <div ref={ref} data-testid="google-login-slot" className="w-full min-h-10" />
      {googleState === 'loading' && <p className="text-sm text-muted-foreground">Loading Google sign-in…</p>}
      {googleState === 'configuration-error' && (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-medium text-destructive">Google sign-in is not configured.</p>
          <p className="text-xs text-muted-foreground">Set VITE_GOOGLE_CLIENT_ID and reload this application.</p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload configuration
          </Button>
        </div>
      )}
      {(googleState === 'script-error' || googleState === 'initialization-error') && (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-medium text-destructive">Google sign-in could not be loaded.</p>
          <p className="text-xs text-muted-foreground">Check your connection or content-blocking settings, then retry.</p>
          <Button size="sm" variant="outline" onClick={() => setAttempt((current) => current + 1)}>
            Retry Google sign-in
          </Button>
        </div>
      )}
      {status === 'pending' && <p className="text-sm text-muted-foreground">{pendingLabel}</p>}
      {status === 'error' && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          <Button size="sm" variant="outline" onClick={() => setStatus('idle')}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
