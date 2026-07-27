import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CheckCircle2, Circle, Trash2, Github } from 'lucide-react'
import {
  useGithubInstallations,
  useRegisterGithubInstallation,
  useDisconnectGithubInstallation,
} from '@timegems/sdk'
import { toast } from 'sonner'

export function IntegrationsRoute() {
  const [searchParams, setSearchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')

  const { data: installationsData, isLoading: installationsLoading, refetch } = useGithubInstallations()
  const registerMutation = useRegisterGithubInstallation()
  const disconnectMutation = useDisconnectGithubInstallation()

  const installations = installationsData?.data ?? []

  // Handle GitHub installation callback
  useEffect(() => {
    if (installationId) {
      const register = async () => {
        try {
          await registerMutation.mutateAsync({ installationId })
          toast.success('GitHub App connected successfully')
          await refetch()
        } catch (err: any) {
          toast.error(err.message || 'Failed to connect GitHub App')
        } finally {
          // Clear query params to prevent double submission
          setSearchParams({})
        }
      }
      void register()
    }
  }, [installationId])

  const appName = import.meta.env.VITE_GITHUB_APP_NAME || 'timegems-dev'
  const githubInstallUrl = `https://github.com/apps/${appName}/installations/new`

  async function handleDisconnect(instId: string) {
    try {
      await disconnectMutation.mutateAsync(instId)
      toast.success('GitHub account disconnected')
    } catch {
      // Handled globally
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <PageHeader title="Integrations" />

      {/* Google Integration (Core Auth) */}
      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">Google</p>
            <p className="text-xs text-muted-foreground">Connected — this is how you signed in</p>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Integration */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Github size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium">GitHub</p>
              <p className="text-xs text-muted-foreground">
                Bind repositories to projects to sync commits, pull requests, issues, and deploys.
              </p>
            </div>
          </div>

          {installationsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="space-y-3">
              {installations.length > 0 ? (
                <div className="space-y-3">
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                      Connected Accounts
                    </p>
                    {installations.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          {inst.accountAvatarUrl ? (
                            <img
                              src={inst.accountAvatarUrl}
                              alt={inst.accountName}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                              <span className="text-xs uppercase">{inst.accountName[0]}</span>
                            </div>
                          )}
                          <span className="text-sm font-medium">{inst.accountName}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          loading={disconnectMutation.isPending && disconnectMutation.variables === inst.installationId}
                          onClick={() => void handleDisconnect(inst.installationId)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => {
                      window.location.href = githubInstallUrl
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Connect another GitHub account
                  </Button>
                </div>
              ) : (
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      window.location.href = githubInstallUrl
                    }}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Github size={16} />
                    Install GitHub App
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discord (Static) */}
      <Card>
        <CardContent className="py-3 flex items-center gap-3 opacity-60">
          <Circle size={18} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Discord</p>
            <p className="text-xs text-muted-foreground">Not connected — coming in V2</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
