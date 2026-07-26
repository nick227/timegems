import { useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useTimeSummary(params: {
  period: 'day' | 'month' | 'year'
  date: string
  scope: 'individual' | 'team'
  teamId?: string
}) {
  return useQuery({
    queryKey: ['time-summary', params],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/reports/time-summary', {
        params: { query: params },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: params.scope === 'individual' || !!params.teamId,
  })
}
