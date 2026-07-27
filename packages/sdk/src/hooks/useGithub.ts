import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, getApiClient } from '../client'

export function useGithubInstallations() {
  return useQuery({
    queryKey: ['github', 'installations'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/integrations/github/installations')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useRegisterGithubInstallation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { installationId: string }) => {
      const { data, error, response } = await getApiClient().POST('/integrations/github/installations', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'installations'] })
    },
  })
}

export function useDisconnectGithubInstallation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (installationId: string) => {
      const { error, response } = await getApiClient().DELETE('/integrations/github/installations/{installationId}', {
        params: { path: { installationId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github', 'installations'] })
    },
  })
}

export function useGithubInstallationRepositories(installationId: string, enabled = true) {
  return useQuery({
    queryKey: ['github', 'repositories', installationId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET(
        '/integrations/github/installations/{installationId}/repositories',
        {
          params: { path: { installationId } },
        },
      )
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: enabled && !!installationId,
  })
}

export function useProjectGithubBindings(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'github-bindings'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/projects/{projectId}/github/bindings', {
        params: { path: { projectId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!projectId,
  })
}

export function useBindProjectGithubRepository(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { installationId: string; repoId: string; repoFullName: string }) => {
      const { data, error, response } = await getApiClient().POST('/projects/{projectId}/github/bindings', {
        params: { path: { projectId } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'github-bindings'] })
    },
  })
}

export function useUnbindProjectGithubRepository(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bindingId: string) => {
      const { error, response } = await getApiClient().DELETE('/projects/{projectId}/github/bindings/{bindingId}', {
        params: { path: { projectId, bindingId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'github-bindings'] })
    },
  })
}
