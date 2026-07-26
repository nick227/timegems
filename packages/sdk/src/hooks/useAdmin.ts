import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useAdminListTenants(params?: { q?: string; limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['admin-tenants', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/tenants', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useAdminUpdateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ tenantId, ...body }: { tenantId: string; plan?: 'FREE' | 'TEAM' | 'ENTERPRISE' }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/tenants/{tenantId}', {
        params: { path: { tenantId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants', 'list'] })
    },
  })
}

export function useAdminListUsers(params?: { q?: string; limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['admin-users', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/users', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useAdminUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, suspended }: { userId: string; suspended?: boolean }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/users/{userId}', {
        params: { path: { userId } },
        body: { suspended },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users', 'list'] })
    },
  })
}

export function useAdminListAgentEmployees(params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: ['admin-agent-employees', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/agent-employees', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useAdminRunAgentEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (agentEmployeeId: string) => {
      const { data, error, response } = await getApiClient().POST('/admin/agent-employees/{agentEmployeeId}/run', {
        params: { path: { agentEmployeeId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-reports', 'list'] })
    },
  })
}
