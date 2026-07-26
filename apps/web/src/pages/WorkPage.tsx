import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  useActiveWorkSession,
  useStartWorkSession,
  usePauseWorkSession,
  useResumeWorkSession,
  useStopWorkSession,
  useUpdateWorkSession,
  useNotes,
  useCreateNote,
  useProjects,
  useCreateProject,
} from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type Interval = { kind: string; startedAt: string; endedAt?: string | null }
type Note = { id: string; body: string }
type Project = { id: string; name: string }

function computeActiveSeconds(intervals: Interval[], now: number) {
  let total = 0
  for (const interval of intervals) {
    if (interval.kind !== 'ACTIVE') continue
    const end = interval.endedAt ? new Date(interval.endedAt).getTime() : now
    total += Math.max(0, Math.floor((end - new Date(interval.startedAt).getTime()) / 1000))
  }
  return total
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null
  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="text-sm px-3 py-2 rounded bg-surface text-surface-foreground">
          {note.body}
        </div>
      ))}
    </div>
  )
}

function WorkIdle({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Button size="lg" loading={loading} onClick={onStart}>
        Start Work
      </Button>
    </div>
  )
}

function WorkReview({
  elapsedSeconds,
  projectName,
  notes,
  onSave,
  saving,
}: {
  elapsedSeconds: number
  projectName?: string | null
  notes: Note[]
  onSave: (note: string) => Promise<void>
  saving: boolean
}) {
  const [stopNoteDraft, setStopNoteDraft] = useState('')

  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">Session summary</p>
        <p className="text-3xl font-semibold tabular-nums">{formatDuration(elapsedSeconds)}</p>
        {projectName && <p className="text-sm text-muted-foreground">{projectName}</p>}
      </div>

      <NoteList notes={notes} />

      <Textarea
        value={stopNoteDraft}
        onChange={(e) => setStopNoteDraft(e.target.value)}
        placeholder="Anything else worth noting? (optional)"
        rows={3}
        autoFocus
      />

      <Button className="w-full" size="lg" loading={saving} onClick={() => onSave(stopNoteDraft.trim())}>
        Save
      </Button>
    </div>
  )
}

function ProjectPicker({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  creating,
}: {
  projects: Project[]
  activeProjectId?: string | null
  onSelect: (projectId: string) => void
  onCreate: (name: string) => Promise<void>
  creating: boolean
}) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">What are you working on?</p>
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              activeProjectId === project.id
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {project.name}
          </button>
        ))}

        {showNew ? (
          <div className="flex gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              voice={false}
              className="h-8 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              loading={creating}
              onClick={async () => {
                if (!name.trim()) return
                await onCreate(name.trim())
                setName('')
                setShowNew(false)
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 rounded-full text-sm border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            + New project
          </button>
        )}
      </div>
    </div>
  )
}

function NoteComposer({ onAdd, loading }: { onAdd: (body: string) => Promise<void>; loading: boolean }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex gap-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Leave a note about what you're doing..."
        rows={2}
        className="flex-1"
      />
      <Button
        loading={loading}
        onClick={async () => {
          if (!draft.trim()) return
          await onAdd(draft.trim())
          setDraft('')
        }}
      >
        Add
      </Button>
    </div>
  )
}

function WorkActive({
  isPaused,
  elapsedSeconds,
  onPause,
  onResume,
  onStop,
  pausePending,
  resumePending,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  creatingProject,
  notes,
  onAddNote,
  addingNote,
}: {
  isPaused: boolean
  elapsedSeconds: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
  pausePending: boolean
  resumePending: boolean
  projects: Project[]
  activeProjectId?: string | null
  onSelectProject: (projectId: string) => void
  onCreateProject: (name: string) => Promise<void>
  creatingProject: boolean
  notes: Note[]
  onAddNote: (body: string) => Promise<void>
  addingNote: boolean
}) {
  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{isPaused ? 'Paused' : 'Working'}</p>
        <p className="text-4xl font-semibold tabular-nums">{formatDuration(elapsedSeconds)}</p>
        <div className="flex justify-center gap-3 pt-2">
          {isPaused ? (
            <Button onClick={onResume} loading={resumePending}>
              Resume
            </Button>
          ) : (
            <Button variant="outline" onClick={onPause} loading={pausePending}>
              Pause
            </Button>
          )}
          <Button variant="destructive" onClick={onStop}>
            Stop
          </Button>
        </div>
      </div>

      <ProjectPicker
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={onSelectProject}
        onCreate={onCreateProject}
        creating={creatingProject}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Updates</p>
        <NoteList notes={notes} />
        <NoteComposer onAdd={onAddNote} loading={addingNote} />
      </div>
    </div>
  )
}

export function WorkPage() {
  const { data, isLoading } = useActiveWorkSession()
  const session = data?.data ?? null

  const startMutation = useStartWorkSession()
  const pauseMutation = usePauseWorkSession()
  const resumeMutation = useResumeWorkSession()
  const stopMutation = useStopWorkSession()
  const updateMutation = useUpdateWorkSession(session?.id ?? '')
  const createNoteMutation = useCreateNote(session?.id ?? '')
  const createProjectMutation = useCreateProject()
  const { data: projectsData } = useProjects()
  const { data: notesData } = useNotes(session?.id ?? '')

  const [reviewing, setReviewing] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const isTicking = !!session && !reviewing
  useEffect(() => {
    if (!isTicking) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isTicking])

  if (isLoading) return <PageSpinner />

  if (!session && !reviewing) {
    return <WorkIdle onStart={() => startMutation.mutate({})} loading={startMutation.isPending} />
  }

  const elapsedSeconds = session ? computeActiveSeconds(session.intervals ?? [], nowTick) : 0
  const notes = notesData?.pages.flatMap((p) => p.data) ?? session?.notes ?? []
  const projects = projectsData?.pages.flatMap((p) => p.data) ?? []

  async function handleAddNote(body: string) {
    try {
      await createNoteMutation.mutateAsync(body)
    } catch {
      // handled by the global mutation error toast
    }
  }

  async function handleCreateProject(name: string) {
    if (!session) return
    try {
      const created = await createProjectMutation.mutateAsync({ name })
      if (created.data) updateMutation.mutate({ projectId: created.data.id })
    } catch {
      // handled by the global mutation error toast
    }
  }

  if (reviewing && session) {
    return (
      <WorkReview
        elapsedSeconds={elapsedSeconds}
        projectName={session.project?.name}
        notes={notes}
        saving={stopMutation.isPending}
        onSave={async (note) => {
          try {
            await stopMutation.mutateAsync({ workSessionId: session.id, note: note || undefined })
            setReviewing(false)
            toast.success('Saved')
          } catch {
            // handled by the global mutation error toast
          }
        }}
      />
    )
  }

  return (
    <WorkActive
      isPaused={session?.status === 'PAUSED'}
      elapsedSeconds={elapsedSeconds}
      onPause={() => pauseMutation.mutate(session!.id)}
      onResume={() => resumeMutation.mutate(session!.id)}
      onStop={() => setReviewing(true)}
      pausePending={pauseMutation.isPending}
      resumePending={resumeMutation.isPending}
      projects={projects}
      activeProjectId={session?.projectId}
      onSelectProject={(projectId) => updateMutation.mutate({ projectId })}
      onCreateProject={handleCreateProject}
      creatingProject={createProjectMutation.isPending}
      notes={notes}
      onAddNote={handleAddNote}
      addingNote={createNoteMutation.isPending}
    />
  )
}
