import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, useClaimEmail, useClaimGoogle, useGoogleAuth, useLogin } from '@timegems/sdk'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { GoogleLoginButton } from '@/features/auth'
import { ShieldAlert } from 'lucide-react'

type Mode = 'login' | 'register'

// Shown only for isAnonymous users -- attach credentials to this guest row
// (Register) or switch into an existing account (Sign in). Register upgrades
// the same user in place (claimWithEmail/claimWithGoogle); Sign in replaces
// the session and leaves this guest behind.
export function ClaimAccountCard() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const claimEmail = useClaimEmail()
  const claimGoogle = useClaimGoogle()
  const googleAuth = useGoogleAuth()
  const login = useLogin()
  const emailMutation = mode === 'login' ? login : claimEmail

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await login.mutateAsync({ email, password })
        navigate('/', { replace: true })
      } else {
        await claimEmail.mutateAsync({ email, password })
        toast.success('Account created -- you can sign in with this email anywhere.')
      }
    } catch {
      // emailMutation.error renders below
    }
  }

  return (
    <Card className="border border-destructive/30">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert size={18} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">You're using a guest account</p>
            <p className="text-xs text-muted-foreground">
              {mode === 'register'
                ? 'Register to keep this account across browsers and devices. Signing in instead switches to a different account and leaves this guest behind.'
                : 'Sign in to an existing account. This guest session (and any unsaved work on it) will be left behind.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" voice={false} required autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              voice={false}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          {emailMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {emailMutation.error instanceof ApiError
                ? emailMutation.error.message
                : 'Something went wrong. Please try again.'}
            </p>
          )}
          <Button type="submit" className="w-full" loading={emailMutation.isPending}>
            {mode === 'login' ? 'Sign in' : 'Register'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              login.reset()
              claimEmail.reset()
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <GoogleLoginButton
          pendingLabel={mode === 'login' ? 'Signing in...' : 'Linking...'}
          getErrorMessage={(error) =>
            error instanceof ApiError && error.status === 409
              ? 'That Google account is already linked to a different user.'
              : mode === 'login'
                ? 'Could not sign in with Google. Please try again.'
                : 'Could not link this Google account. Please try again.'
          }
          onCredential={async (credential) => {
            if (mode === 'login') {
              await googleAuth.mutateAsync(credential)
              navigate('/', { replace: true })
              return
            }
            await claimGoogle.mutateAsync(credential)
            toast.success('Google account linked -- you can now sign in with it anywhere.')
          }}
        />
      </CardContent>
    </Card>
  )
}
