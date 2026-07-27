import { useParams } from 'react-router-dom'
import { ApiError, useUser } from '@timegems/sdk'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { PresenceIndicator } from '@/features/presence'
import { QueryErrorState } from '@/components/ui/QueryErrorState'

// Minimal by design -- just enough for a mention to land somewhere real
// (avatar, name, live presence). Not a full profile; there's no broader
// "user profile" product surface yet.
export function UserRoute() {
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId!)
  const { data, isLoading } = userQuery

  if (isLoading) return <Skeleton className="h-24 w-full max-w-xl mx-auto mt-6" />
  if (userQuery.isError) {
    return (
      <QueryErrorState
        error={userQuery.error}
        resource="User"
        onRetry={() => void userQuery.refetch()}
        returnTo="/settings?tab=teams"
        returnLabel="Return to Teams"
      />
    )
  }

  const user = data?.data
  if (!user) {
    return (
      <QueryErrorState
        error={new ApiError(404, 'User not found')}
        resource="User"
        onRetry={() => void userQuery.refetch()}
        returnTo="/settings?tab=teams"
        returnLabel="Return to Teams"
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4">
        <Avatar src={user.avatarUrl} name={user.name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <PresenceIndicator userId={user.id} />
        </div>
      </div>
    </div>
  )
}
