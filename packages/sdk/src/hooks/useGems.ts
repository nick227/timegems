import { useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useGemBalances(enabled = true) {
  return useQuery({
    queryKey: ['gem-balances'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/gem-balances')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled,
  })
}
