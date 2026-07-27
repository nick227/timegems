import { createContext, useContext, type ReactNode } from 'react'
import type { components } from '@timegems/sdk'

export type Capability = components['schemas']['Capability']
type CurrentUserContext = components['schemas']['CurrentUserContext']

const AuthorizationContext = createContext<CurrentUserContext | null>(null)

export function AuthorizationProvider({ value, children }: { value: CurrentUserContext; children: ReactNode }) {
  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>
}

export function useAuthorization() {
  const context = useContext(AuthorizationContext)
  if (!context) throw new Error('useAuthorization must be used inside AuthGuard')

  return {
    ...context,
    can: (capability: Capability) => context.capabilities.includes(capability),
  }
}
