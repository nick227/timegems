import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, useLogin, useRegister } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'

type Mode = 'login' | 'register'

export function EmailAuthForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const mutation = mode === 'login' ? loginMutation : registerMutation

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await loginMutation.mutateAsync({ email, password })
      } else {
        await registerMutation.mutateAsync({ email, password, name: name.trim() || undefined })
      }
      navigate(redirectTo)
    } catch {
      // mutation.error renders below
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
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
      {mode === 'register' && (
        <Field label="Name" hint="Optional -- shown to teammates">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" voice={false} autoComplete="name" />
        </Field>
      )}

      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Something went wrong. Please try again.'}
        </p>
      )}

      <Button type="submit" className="w-full" loading={mutation.isPending}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          loginMutation.reset()
          registerMutation.reset()
        }}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
      </button>
    </form>
  )
}
