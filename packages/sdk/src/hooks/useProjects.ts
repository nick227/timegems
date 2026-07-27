import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useProjects(params?: { q?: string; teamId?: string; archived?: boolean; limit?: number }, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['projects', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/projects', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled,
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/projects/{projectId}', {
        params: { path: { projectId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!projectId,
  })
}

type GemTypeInput = { name: string; icon: string; color: string; description?: string }

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; teamId?: string | null; color?: string | null; gemType?: GemTypeInput }) => {
      const { data, error, response } = await getApiClient().POST('/projects', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name?: string
      teamId?: string | null
      color?: string | null
      archived?: boolean
      gemType?: Partial<GemTypeInput>
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/projects/{projectId}', {
        params: { path: { projectId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}
