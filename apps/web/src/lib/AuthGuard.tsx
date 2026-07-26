import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '@timegems/sdk'
import { PageSpinner } from '@/components/ui/Spinner'

export function AuthGuard() {
  const { data, isLoading } = useCurrentUser()
  if (isLoading) return <PageSpinner />
  if (!data?.data) return <Navigate to="/login" replace />
  return <Outlet />
}
