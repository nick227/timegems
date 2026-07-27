import { useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'
import { useProjectActivityEvents, type ProjectActivityEvent } from './usePresence'

export type ProjectFeedItem = components['schemas']['ProjectFeedItem']
export type { ProjectActivityEvent }

export function useProjectFeed(projectId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['project-feed', projectId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/projects/{projectId}/feed', {
        params: { path: { projectId: projectId! }, query: { cursor: pageParam } },
      })
      if (error) throw new ApiError(response.status, (error as { error: string }).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: enabled && !!projectId,
  })
}

export function useProjectUpdate(projectId: string | undefined, updateId: string | undefined) {
  return useQuery({
    queryKey: ['project-update', projectId, updateId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/projects/{projectId}/updates/{updateId}', {
        params: { path: { projectId: projectId!, updateId: updateId! } },
      })
      if (error) throw new ApiError(response.status, (error as { error: string }).error)
      return data!
    },
    enabled: !!projectId && !!updateId,
  })
}

export function useProjectFeedLive(projectId: string | null | undefined) {
  const queryClient = useQueryClient()
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  useProjectActivityEvents(projectId, (event) => {
    const id = projectIdRef.current
    if (!id) return
    queryClient.setQueryData(['project-feed', id], (existing: { pages: Array<{ data: ProjectFeedItem[]; meta: unknown }>; pageParams: unknown[] } | undefined) => {
      if (!existing?.pages?.length) return existing
      const [first, ...rest] = existing.pages
      if (!first || first.data.some((item) => item.id === event.item.id)) return existing
      return {
        ...existing,
        pages: [{ ...first, data: [event.item, ...first.data] }, ...rest],
      }
    })
  })
}
