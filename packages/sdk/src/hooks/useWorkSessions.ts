import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useActiveWorkSession() {
  return useQuery({
    queryKey: ['work-session', 'active'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/work-sessions/active')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    refetchInterval: 30_000, // keep the elapsed-time display honest across tabs/devices
  })
}

export function useWorkSession(workSessionId: string) {
  return useQuery({
    queryKey: ['work-session', workSessionId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/work-sessions/{workSessionId}', {
        params: { path: { workSessionId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!workSessionId,
  })
}

export function useWorkSessions(params?: {
  userId?: string
  projectId?: string
  teamId?: string
  from?: string
  to?: string
  limit?: number
}) {
  return useInfiniteQuery({
    queryKey: ['work-sessions', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/work-sessions', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useStartWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body?: { projectId?: string | null }) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/start', { body: body ?? {} })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
    },
  })
}

export function usePauseWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workSessionId: string) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/{workSessionId}/pause', {
        params: { path: { workSessionId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
    },
  })
}

export function useResumeWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workSessionId: string) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/{workSessionId}/resume', {
        params: { path: { workSessionId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
    },
  })
}

export function useStopWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workSessionId, note }: { workSessionId: string; note?: string }) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/{workSessionId}/stop', {
        params: { path: { workSessionId } },
        body: note ? { note } : {},
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'list'] })
    },
  })
}

export function useUpdateWorkSession(workSessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { projectId?: string | null }) => {
      const { data, error, response } = await getApiClient().PATCH('/work-sessions/{workSessionId}', {
        params: { path: { workSessionId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['work-session', workSessionId] })
    },
  })
}
