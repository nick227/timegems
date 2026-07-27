import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type GoalStatus = components['schemas']['GoalStatus']

export function useGoals(params?: { status?: GoalStatus; projectId?: string; limit?: number }, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['goals', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/goals', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled,
  })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      title: string
      description: string
      teamId?: string | null
      projectId?: string | null
      complexityScore?: number
      estimatedHours?: number | null
    }) => {
      const { data, error, response } = await getApiClient().POST('/goals', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', 'list'] })
    },
  })
}

export function useImportProjectGoals(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      goals: {
        title: string
        description: string
        complexityScore?: number
        estimatedHours?: number | null
      }[],
    ) => {
      const { data, error, response } = await getApiClient().POST('/projects/{projectId}/goals/import', {
        params: { path: { projectId } },
        body: { goals },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', 'list'] })
    },
  })
}

export function useUpdateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      goalId,
      ...body
    }: {
      goalId: string
      title?: string
      description?: string
      projectId?: string | null
      status?: GoalStatus
      progressPercent?: number
      complexityScore?: number
      estimatedHours?: number | null
    }) => {
      const { data, error, response } = await getApiClient().PATCH('/goals/{goalId}', {
        params: { path: { goalId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', 'list'] })
    },
  })
}
