import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/auth/me')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useGoogleAuth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credential: string) => {
      const { data, error, response } = await getApiClient().POST('/auth/google', {
        body: { credential },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await getApiClient().POST('/auth/logout')
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
