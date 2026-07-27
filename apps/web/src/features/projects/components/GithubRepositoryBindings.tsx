import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Trash2, Github, Plus, AlertCircle } from 'lucide-react'
import {
  useProjectGithubBindings,
  useGithubInstallations,
  useGithubInstallationRepositories,
  useBindProjectGithubRepository,
  useUnbindProjectGithubRepository,
} from '@timegems/sdk'
import { toast } from 'sonner'

interface GithubRepositoryBindingsProps {
  projectId: string
  editable: boolean
}

export function GithubRepositoryBindings({ projectId, editable }: GithubRepositoryBindingsProps) {
  const { data: bindingsData, isLoading: bindingsLoading } = useProjectGithubBindings(projectId)
  const { data: installationsData, isLoading: installationsLoading } = useGithubInstallations()
  const bindMutation = useBindProjectGithubRepository(projectId)
  const unbindMutation = useUnbindProjectGithubRepository(projectId)

  const [selectedInstId, setSelectedInstId] = useState<string>('')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [isAdding, setIsAdding] = useState(false)

  const installations = installationsData?.data ?? []
  const bindings = bindingsData?.data ?? []

  useEffect(() => {
    if (!selectedInstId && installations.length > 0) {
      setSelectedInstId(installations[0]!.installationId)
    }
  }, [installations, selectedInstId])

  const { data: reposData, isLoading: reposLoading } = useGithubInstallationRepositories(
    selectedInstId,
    isAdding && !!selectedInstId
  )
  const repositories = reposData?.data ?? []

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
      toast.success('Repository bound successfully')
      setSelectedRepoId('')
      setIsAdding(false)
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

  if (bindingsLoading || installationsLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">GitHub Repositories</p>
        {editable && installations.length > 0 && !isAdding && (
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setIsAdding(true)}>
            <Plus size={14} />
            Bind Repository
          </Button>
        )}
      </div>

      {installations.length === 0 ? (
        <Card className="border border-dashed border-muted/80 bg-muted/10">
          <CardContent className="py-6 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Github size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No GitHub Accounts Connected</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Connect a GitHub account under Integrations to bind repositories to this project.
              </p>
            </div>
            {editable && (
              <Link
                to="/integrations"
                className="inline-flex h-8 items-center justify-center rounded border border-input-border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Go to Integrations
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bindings.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground italic py-2">No repositories bound to this project yet.</p>
          )}

          {bindings.map((binding) => (
            <Card key={binding.id} className="bg-muted/15 border-0">
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Github size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{binding.repoFullName}</span>
                </div>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    loading={unbindMutation.isPending && unbindMutation.variables === binding.id}
                    onClick={() => void handleUnbind(binding.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {isAdding && (
            <Card className="border border-primary/20 bg-muted/20">
              <CardContent className="py-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Bind GitHub Repository
                  </p>
                </div>

                <div className="space-y-2">
                  {installations.length > 1 && (
                    <div className="flex flex-col gap-1">
                      <label htmlFor="github-installation-select" className="text-xs text-muted-foreground">
                        GitHub Account
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
                      Select Repository
                    </label>
                    {reposLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Spinner size="sm" />
                        <span className="text-xs text-muted-foreground">Loading repositories...</span>
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
                        <option value="">-- Choose a repository --</option>
                        {repositories.map((repo) => (
                          <option key={repo.id} value={repo.id}>
                            {repo.name} {repo.private ? '(private)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
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
        </div>
      )}
    </div>
  )
}
