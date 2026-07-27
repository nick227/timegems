import { useState } from 'react'
import { ApiError, useClaimEmail, useClaimGoogle } from '@timegems/sdk'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { GoogleLoginButton } from '@/features/auth'
import { ShieldAlert } from 'lucide-react'

// Shown only for isAnonymous users (see SettingsRoute) -- this is the entire
// answer to "an anonymous account lives only in a cookie, with no recovery
// path if it's lost." Both paths upgrade the *same* user row in place
// (see claimWithEmail/claimWithGoogle server-side); nothing here creates a
// second account to merge later.
export function ClaimAccountCard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const claimEmail = useClaimEmail()
  const claimGoogle = useClaimGoogle()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await claimEmail.mutateAsync({ email, password })
      toast.success('Account saved -- you can now sign in with this email anywhere.')
    } catch {
      // claimEmail.error renders below
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
              This works entirely from a cookie in this browser. If you clear your data or switch devices, there's no
              way to get it back unless you save it below.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" voice={false} required autoComplete="email" />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              voice={false}
              required
              autoComplete="new-password"
            />
          </Field>
          {claimEmail.isError && (
            <p role="alert" className="text-sm text-destructive">
              {claimEmail.error instanceof ApiError ? claimEmail.error.message : 'Something went wrong. Please try again.'}
            </p>
          )}
          <Button type="submit" className="w-full" loading={claimEmail.isPending}>
            Save with email + password
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <GoogleLoginButton
          pendingLabel="Linking..."
          getErrorMessage={(error) =>
            error instanceof ApiError && error.status === 409
              ? 'That Google account is already linked to a different user.'
              : 'Could not link this Google account. Please try again.'
          }
          onCredential={async (credential) => {
            await claimGoogle.mutateAsync(credential)
            toast.success('Google account linked -- you can now sign in with it anywhere.')
          }}
        />
      </CardContent>
    </Card>
  )
}
