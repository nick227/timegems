import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleAuth } from '@timegems/sdk'

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
  redirectTo?: string
}

export function GoogleLoginButton({ redirectTo = '/' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const mutation = useGoogleAuth()

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || !window.google || !ref.current) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }: { credential: string }) => {
        try {
          await mutation.mutateAsync(credential)
          navigate(redirectTo)
        } catch {
          // mutation.error surfaces the message below
        }
      },
    })

    window.google.accounts.id.renderButton(ref.current, {
      theme: 'outline',
      size: 'large',
      width: ref.current.offsetWidth || 300,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="w-full" />
      {mutation.isPending && <p className="text-sm text-muted-foreground">Signing in...</p>}
      {mutation.isError && (
        <p className="text-sm text-destructive">{(mutation.error as any)?.message ?? 'Google sign-in failed'}</p>
      )}
    </div>
  )
}
