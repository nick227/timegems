import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useAgentReports(params?: {
  teamId?: string
  projectId?: string
  type?: 'SUMMARY' | 'REVIEW' | 'PROPOSAL' | 'GOAL'
  limit?: number
}) {
  return useInfiniteQuery({
    queryKey: ['agent-reports', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/agent-reports', {
        params: { query: { ...params, cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

export function useAgentReport(agentReportId: string) {
  return useQuery({
    queryKey: ['agent-report', agentReportId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/agent-reports/{agentReportId}', {
        params: { path: { agentReportId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!agentReportId,
  })
}
