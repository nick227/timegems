import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useNotes(workSessionId: string, params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['notes', workSessionId, params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/work-sessions/{workSessionId}/notes', {
        params: { path: { workSessionId }, query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!workSessionId,
  })
}

export function useCreateNote(workSessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error, response } = await getApiClient().POST('/work-sessions/{workSessionId}/notes', {
        params: { path: { workSessionId } },
        body: { body },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', workSessionId] })
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
    },
  })
}
