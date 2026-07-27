import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects, useWorkSessions, useStartWorkSession, type components } from '@timegems/sdk'
import { FolderKanban, History, Play, Timer, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import { formatDuration } from '../lib/formatDuration'

type Project = components['schemas']['Project']
type WorkSessionDetail = components['schemas']['WorkSessionDetail']

interface WorkIdleProps {
  onStart: () => void
  loading: boolean
}

// Parses notes to extract project links: <a href="/projects/[id]">#ProjectName</a>
function getSessionProjects(session: WorkSessionDetail) {
  const projectsMap = new Map<string, { id: string; name: string; color?: string | null }>()

  if (session.project) {
    projectsMap.set(session.project.id, {
      id: session.project.id,
      name: session.project.name,
      color: session.project.color,
    })
  }

  if (session.notes) {
    session.notes.forEach((note: any) => {
      const regex = /href="\/projects\/([^"]+)"[^>]*>#([^<]+)</g
      let match
      while ((match = regex.exec(note.body)) !== null) {
        const [_, projectId, projectName] = match
        if (projectId && projectName && !projectsMap.has(projectId)) {
          projectsMap.set(projectId, {
            id: projectId,
            name: projectName,
            color: null,
          })
        }
      }
    })
  }

  return Array.from(projectsMap.values())
}

export function WorkIdle({ onStart, loading }: WorkIdleProps) {
  const navigate = useNavigate()
  const startSession = useStartWorkSession()
  const [startingProjectId, setStartingProjectId] = useState<string | null>(null)
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null)

  // Fetch projects (limit to 5 for the quick-start list)
  const projectsQuery = useProjects({ limit: 5 })
  const projects = projectsQuery.data?.pages[0]?.data ?? []

  // Fetch recent stopped sessions (limit to 5)
  const sessionsQuery = useWorkSessions({ status: 'STOPPED', limit: 5 })
  const pastSessions = sessionsQuery.data?.pages[0]?.data ?? []

  // Find the last session associated with a project from the past sessions
  const lastSessionForProject = (projectId: string) => {
    return pastSessions.find((s) => s.projectId === projectId)
  }

  async function handleStartProject(projectId: string, projectName: string) {
    setStartingProjectId(projectId)
    try {
      const created = await startSession.mutateAsync({ projectId })
      toast.success(`Started working on ${projectName}`)
      if (created.data) navigate(`/work/${created.data.id}`)
    } catch {
      // Handled by global toast
    } finally {
      setStartingProjectId(null)
    }
  }

  async function handleResumeSession(session: WorkSessionDetail) {
    setStartingSessionId(session.id)
    try {
      const created = await startSession.mutateAsync({
        projectId: session.projectId,
        goalId: session.goalId,
      })
      toast.success(`Started new session from ${session.name}`)
      if (created.data) navigate(`/work/${created.data.id}`)
    } catch {
      // Handled by global toast
    } finally {
      setStartingSessionId(null)
    }
  }

  const isInitialLoading = projectsQuery.isLoading || sessionsQuery.isLoading

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center justify-start space-y-12 min-h-screen">
      {/* Visually hidden heading for screen readers */}
      <h1 className="sr-only">Work</h1>

      {/* Prominent Site Branding */}
      <div className="flex flex-col items-center space-y-4 pt-4">
        <div className="space-y-1.5">
          <span className="text-branding">
            TimeGems
          </span>
        </div>
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-surface shadow-sm">
          <Timer className="w-10 h-10 text-foreground animate-pulse" />
          <Sparkles className="absolute -top-1.5 -right-1.5 w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Shrunk Start Work button */}
      <div className="flex flex-col items-center space-y-2">
        <Button
          loading={loading}
          onClick={onStart}
          className="h-12 px-8 rounded-full text-base font-bold shadow-md hover:shadow-lg transition-all"
        >
          <Play className="mr-2 h-4 w-4 fill-current" />
          Start
        </Button>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 gap-8 w-full max-w-3xl pt-4">
        {/* Projects Column */}
        <div className="space-y-4">
          <h2 className="text-md font-bold tracking-tight flex items-center gap-2 text-foreground/90 pl-1">
            <FolderKanban size={16} className="text-muted-foreground" />
            Projects
          </h2>

          <div className="space-y-3">
            {isInitialLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-surface/50 border-0">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </CardContent>
                </Card>
              ))
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-1">No projects created yet.</p>
            ) : (
              projects.map((project) => {
                const lastSession = lastSessionForProject(project.id)
                return (
                  <Card key={project.id} className="bg-surface hover:bg-accent/40 transition-colors border-0">
                    <CardContent className="flex items-center justify-between p-4 gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: project.color || 'var(--muted-foreground)' }}
                          />
                          <span className="font-semibold text-sm truncate">{project.name}</span>
                        </div>
                        {lastSession ? (
                          <p className="text-xs text-muted-foreground truncate">
                            Last session: <span className="font-medium">{lastSession.name}</span> ({formatDuration(lastSession.activeDurationSec)})
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No recent sessions</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handleStartProject(project.id, project.name)}
                        loading={startingProjectId === project.id}
                        disabled={loading || !!startingSessionId || !!startingProjectId}
                        className="h-8 px-3.5 text-xs font-semibold shrink-0"
                        aria-label={`Start ${project.name}`}
                      >
                        <Play size={10} className="mr-1 fill-current" />
                        Start
                      </Button>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* Recent Sessions Column */}
        <div className="space-y-4">
          <h2 className="text-md font-bold tracking-tight flex items-center gap-2 text-foreground/90 pl-1">
            <History size={16} className="text-muted-foreground" />
            Recent Sessions
          </h2>

          <div className="space-y-3">
            {isInitialLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-surface/50 border-0">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </CardContent>
                </Card>
              ))
            ) : pastSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-1">No completed sessions yet.</p>
            ) : (
              pastSessions.map((session) => {
                const sessionProjects = getSessionProjects(session)
                return (
                  <Card key={session.id} className="bg-surface hover:bg-accent/40 transition-colors border-0">
                    <CardContent className="flex items-center justify-between p-4 gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Duration: {formatDuration(session.activeDurationSec)}
                          </p>
                        </div>
                        {/* Display project tags associated with this session */}
                        {sessionProjects.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {sessionProjects.map((p) => (
                              <button
                                key={p.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleStartProject(p.id, p.name)
                                }}
                                disabled={loading || !!startingSessionId || !!startingProjectId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-background hover:bg-accent/80 transition-colors text-foreground max-w-[120px] truncate"
                              >
                                {p.color && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: p.color }}
                                  />
                                )}
                                <span className="truncate">{p.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handleResumeSession(session)}
                        loading={startingSessionId === session.id}
                        disabled={loading || !!startingSessionId || !!startingProjectId}
                        variant="outline"
                        className="h-8 px-3.5 text-xs font-semibold shrink-0"
                        aria-label={`Resume ${session.name}`}
                      >
                        <ArrowRight size={12} className="mr-1" />
                        Resume
                      </Button>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
