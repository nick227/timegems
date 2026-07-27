import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useProjects, useStartWorkSession, useActiveWorkSessions, ApiError } from '@timegems/sdk'
import { Plus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

// Persistent across the whole app (mounted once in Shell, fixed bottom-left)
// specifically so starting another concurrent session never depends on
// being on `/` -- `/` redirects straight to a primary session the instant
// one exists (see WorkIndexRoute), which would otherwise make "start a
// second session" unreachable except by editing the URL by hand. A small
// popover, not a full navigation, so starting one is a single click from
// anywhere: unassigned at the top for the fastest possible path, then a
// short list of real projects.
export function StartSessionButton() {
  const [open, setOpen] = useState(false)
  const [startingKey, setStartingKey] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const startMutation = useStartWorkSession()
  const activeSessionsQuery = useActiveWorkSessions()
  const projectsQuery = useProjects({ limit: 5 }, open)
  const projects = projectsQuery.data?.pages[0]?.data ?? []

  // Same outside-click/Escape pattern as the smart-text-editor's AI-assist
  // menu -- a real menu should close both ways, not just on selecting an item.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function handleStart(projectId?: string) {
    setStartingKey(projectId ?? 'unassigned')
    try {
      const created = await startMutation.mutateAsync({ projectId })
      setOpen(false)
      if (created.data) navigate(`/work/${created.data.id}`)
    } catch (error) {
      // The guardrail: one user can't run two concurrent sessions on the
      // same project. Rather than just erroring, jump straight to the
      // session that's already running there -- still the fastest path to
      // where the user actually wants to be.
      if (error instanceof ApiError && error.status === 409 && projectId) {
        toast.info('Returning to your active session on this project')
        const refetched = await activeSessionsQuery.refetch()
        const existing = refetched.data?.data.find((s) => s.projectId === projectId)
        setOpen(false)
        if (existing) navigate(`/work/${existing.id}`)
      }
      // Other failures are handled by the global mutation error toast.
    } finally {
      setStartingKey(null)
    }
  }

  return (
    <div ref={menuRef} className="fixed bottom-4 left-4 z-20">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 space-y-1 rounded-lg bg-surface p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => void handleStart(undefined)}
            disabled={startingKey !== null}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Zap size={14} className="shrink-0 text-muted-foreground" />
            Start new session
          </button>
          {projects.length > 0 && (
            <div className="border-t pt-1">
              <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Or start on a project
              </p>
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void handleStart(project.id)}
                  disabled={startingKey !== null}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color ?? 'hsl(var(--muted-foreground))' }}
                  />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Start a new session"
        title="Start a new session"
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90',
          open && 'ring-2 ring-ring',
        )}
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
