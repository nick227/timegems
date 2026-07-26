import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useTeams(params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['teams', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/teams', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/teams/{teamId}', {
        params: { path: { teamId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!teamId,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string }) => {
      const { data, error, response } = await getApiClient().POST('/teams', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'list'] })
    },
  })
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name?: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/teams/{teamId}', {
        params: { path: { teamId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', 'list'] })
    },
  })
}

export function useTeamMembers(teamId: string, params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['team', teamId, 'members', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/teams/{teamId}/members', {
        params: { path: { teamId }, query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!teamId,
  })
}

export function useAddTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error, response } = await getApiClient().POST('/teams/{teamId}/members', {
        params: { path: { teamId } },
        body: { userId },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
    },
  })
}

export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error, response } = await getApiClient().DELETE('/teams/{teamId}/members/{userId}', {
        params: { path: { teamId, userId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
    },
  })
}
