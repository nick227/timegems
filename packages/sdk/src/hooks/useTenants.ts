import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useMyTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/tenants')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; slug: string }) => {
      const { data, error, response } = await getApiClient().POST('/tenants', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useSelectActiveTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error, response } = await getApiClient().POST('/tenants/{tenantId}/select', {
        params: { path: { tenantId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}
