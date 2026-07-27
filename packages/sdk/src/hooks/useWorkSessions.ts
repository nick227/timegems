import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

// A user can run one concurrent session per project (see
// UserActiveSession's schema comment), so this is a list -- possibly empty,
// possibly several. Named plural deliberately so a consumer can't
// accidentally treat `.data.data` as a single session the way the old
// singular endpoint allowed.
export function useActiveWorkSessions() {
  return useQuery({
    queryKey: ['work-sessions', 'active'],
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
  goalId?: string
  teamId?: string
  status?: 'RUNNING' | 'PAUSED' | 'REVIEWING' | 'STOPPED'
  from?: string
  to?: string
  limit?: number
}, enabled = true) {
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
    enabled,
  })
}

export function useStartWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body?: { projectId?: string | null; goalId?: string | null }) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/start', { body: body ?? {} })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: (data) => {
      if (data.data) queryClient.setQueryData(['work-session', data.data.id], data)
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
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
    onSuccess: (data, workSessionId) => {
      // The single-session detail query (used by /work/:workSessionId,
      // which reads its own session by id rather than off the active list)
      // has its own cache entry -- invalidating only the active list left it
      // stale, so a transition here (e.g. Stop -> REVIEWING) never showed
      // up on that route until something else happened to refetch it.
      queryClient.setQueryData(['work-session', workSessionId], data)
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
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
    onSuccess: (data, workSessionId) => {
      queryClient.setQueryData(['work-session', workSessionId], data)
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
    },
  })
}

export function useReviewWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workSessionId: string) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/{workSessionId}/review', {
        params: { path: { workSessionId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: (data, workSessionId) => {
      queryClient.setQueryData(['work-session', workSessionId], data)
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
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
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['work-session', variables.workSessionId], data)
      // A stopped session leaves the active list immediately, not on the
      // next background refetch -- without this, a route reading the active
      // list right after Stop (e.g. `/` deciding whether to redirect
      // somewhere or show Idle) can still see this session as active for
      // one render, since `invalidateQueries` below only *schedules* a
      // refetch rather than updating the cache synchronously.
      queryClient.setQueryData(['work-sessions', 'active'], (old: any) =>
        old ? { ...old, data: old.data.filter((s: any) => s.id !== variables.workSessionId) } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['gem-balances'] })
      queryClient.invalidateQueries({ queryKey: ['time-summary'] })
    },
  })
}

export function useUpdateWorkSession(workSessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { projectId?: string | null; goalId?: string | null; activeDurationSec?: number }) => {
      const { data, error, response } = await getApiClient().PATCH('/work-sessions/{workSessionId}', {
        params: { path: { workSessionId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['work-session', workSessionId] })
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['gem-balances'] })
      queryClient.invalidateQueries({ queryKey: ['time-summary'] })
    },
  })
}

export function useDeleteWorkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workSessionId: string) => {
      const { error, response } = await getApiClient().DELETE('/work-sessions/{workSessionId}', {
        params: { path: { workSessionId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['gem-balances'] })
      queryClient.invalidateQueries({ queryKey: ['time-summary'] })
    },
  })
}
