import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Trash2, Github, AlertCircle } from 'lucide-react'
import {
  useProjectGithubBindings,
  useGithubInstallations,
  useGithubInstallationRepositories,
  useBindProjectGithubRepository,
  useUnbindProjectGithubRepository,
  useRegisterGithubInstallation,
} from '@timegems/sdk'
import { toast } from 'sonner'
import { GITHUB_RETURN_KEY, githubInstallUrl } from '@/features/integrations'

interface GithubRepositoryBindingsProps {
  projectId: string
  editable: boolean
}

// Compact GitHub section: one Connect button when nothing is linked; bind /
// list repos once an installation exists. Install callback may land on
// /integrations (App setup URL) — IntegrationsRoute redirects back via
// sessionStorage — or here if installation_id is present on this page.
export function GithubRepositoryBindings({ projectId, editable }: GithubRepositoryBindingsProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const installationIdParam = searchParams.get('installation_id')

  const { data: bindingsData, isLoading: bindingsLoading, refetch: refetchBindings } = useProjectGithubBindings(projectId)
  const { data: installationsData, isLoading: installationsLoading, refetch: refetchInstallations } = useGithubInstallations()
  const registerMutation = useRegisterGithubInstallation()
  const bindMutation = useBindProjectGithubRepository(projectId)
  const unbindMutation = useUnbindProjectGithubRepository(projectId)

  const [selectedInstId, setSelectedInstId] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [isBinding, setIsBinding] = useState(false)

  const installations = installationsData?.data ?? []
  const bindings = bindingsData?.data ?? []

  useEffect(() => {
    if (!installationIdParam) return
    let cancelled = false
    void (async () => {
      try {
        await registerMutation.mutateAsync({ installationId: installationIdParam })
        if (cancelled) return
        toast.success('GitHub connected')
        await Promise.all([refetchInstallations(), refetchBindings()])
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to connect GitHub')
        }
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams)
          next.delete('installation_id')
          next.delete('setup_action')
          next.delete('state')
          setSearchParams(next, { replace: true })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [installationIdParam])

  useEffect(() => {
    if (!selectedInstId && installations.length > 0) {
      setSelectedInstId(installations[0]!.installationId)
    }
  }, [installations, selectedInstId])

  const { data: reposData, isLoading: reposLoading } = useGithubInstallationRepositories(
    selectedInstId,
    isBinding && !!selectedInstId,
  )
  const repositories = reposData?.data ?? []

  function startConnect() {
    const returnTo = `/projects/${projectId}`
    sessionStorage.setItem(GITHUB_RETURN_KEY, returnTo)
    window.location.href = githubInstallUrl(returnTo)
  }

  async function handleBind() {
    if (!selectedInstId || !selectedRepoId) return
    const repo = repositories.find((r) => r.id === selectedRepoId)
    if (!repo) return

    try {
      await bindMutation.mutateAsync({
        installationId: selectedInstId,
        repoId: repo.id,
        repoFullName: repo.fullName,
      })
      toast.success('Repository bound')
      setSelectedRepoId('')
      setIsBinding(false)
    } catch {
      // Handled globally
    }
  }

  async function handleUnbind(bindingId: string) {
    try {
      await unbindMutation.mutateAsync(bindingId)
      toast.success('Repository unbound')
    } catch {
      // Handled globally
    }
  }

  if (bindingsLoading || installationsLoading || registerMutation.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        {registerMutation.isPending ? 'Connecting GitHub…' : 'Loading GitHub…'}
      </div>
    )
  }

  if (!editable && installations.length === 0 && bindings.length === 0) return null

  if (installations.length === 0) {
    if (!editable) return null
    return (
      <Button size="sm" onClick={startConnect}>
        <Github size={14} />
        Connect GitHub
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      {bindings.map((binding) => (
        <Card key={binding.id} className="bg-muted/15 border-0">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Github size={16} className="shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{binding.repoFullName}</span>
            </div>
            {editable && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                loading={unbindMutation.isPending && unbindMutation.variables === binding.id}
                onClick={() => void handleUnbind(binding.id)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {editable && !isBinding && (
        <Button size="sm" variant="outline" onClick={() => setIsBinding(true)}>
          <Github size={14} />
          {bindings.length === 0 ? 'Bind repository' : 'Bind another'}
        </Button>
      )}

      {isBinding && (
        <Card className="border border-primary/20 bg-muted/20">
          <CardContent className="py-4 space-y-3">
            {installations.length > 1 && (
              <div className="flex flex-col gap-1">
                <label htmlFor="github-installation-select" className="text-xs text-muted-foreground">
                  GitHub account
                </label>
                <select
                  id="github-installation-select"
                  value={selectedInstId}
                  onChange={(e) => {
                    setSelectedInstId(e.target.value)
                    setSelectedRepoId('')
                  }}
                  className="w-full h-9 rounded bg-background border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {installations.map((inst) => (
                    <option key={inst.id} value={inst.installationId}>
                      {inst.accountName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="github-repository-select" className="text-xs text-muted-foreground">
                Repository
              </label>
              {reposLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-muted-foreground">Loading repositories…</span>
                </div>
              ) : repositories.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-amber-500">
                  <AlertCircle size={14} />
                  <span className="text-xs">No repositories available for this account.</span>
                </div>
              ) : (
                <select
                  id="github-repository-select"
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="w-full h-9 rounded bg-background border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Choose a repository…</option>
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.name} {repo.private ? '(private)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setIsBinding(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedRepoId || bindMutation.isPending}
                loading={bindMutation.isPending}
                onClick={() => void handleBind()}
              >
                Bind
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editable && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={startConnect}
        >
          Connect another account
        </button>
      )}
    </div>
  )
}
