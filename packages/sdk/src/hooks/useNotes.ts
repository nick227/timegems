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
    onSuccess: (data) => {
      // Prepend immediately so the new update can fade in before the composer
      // fades out -- waiting on invalidate alone left a blank beat that felt jumpy.
      const note = data.data
      if (note) {
        queryClient.setQueryData(
          ['notes', workSessionId, undefined],
          (existing: { pages: Array<{ data: typeof note[]; meta: unknown }>; pageParams: unknown[] } | undefined) => {
            if (!existing?.pages?.length) {
              return {
                pages: [{ data: [note], meta: { nextCursor: null } }],
                pageParams: [undefined],
              }
            }
            const [first, ...rest] = existing.pages
            if (!first || first.data.some((entry) => entry.id === note.id)) return existing
            return {
              ...existing,
              pages: [{ ...first, data: [note, ...first.data] }, ...rest],
            }
          },
        )
      }
      queryClient.invalidateQueries({ queryKey: ['notes', workSessionId] })
      queryClient.invalidateQueries({ queryKey: ['work-session', 'active'] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/notes/{noteId}', {
        params: { path: { noteId } },
        body: { body },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['work-session'] })
      queryClient.invalidateQueries({ queryKey: ['work-sessions', 'list'] })
    },
  })
}
