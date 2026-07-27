import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useTenantMembers(params?: { q?: string; excludeTeamId?: string; limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['tenant-members', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/users', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/users/{userId}', {
        params: { path: { userId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!userId,
  })
}
