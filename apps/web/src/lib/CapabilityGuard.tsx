import { Navigate, Outlet } from 'react-router-dom'
import { useAuthorization, type Capability } from './Authorization'

export function CapabilityGuard({ capability }: { capability: Capability }) {
  const { can } = useAuthorization()
  return can(capability) ? <Outlet /> : <Navigate to="/" replace />
}
