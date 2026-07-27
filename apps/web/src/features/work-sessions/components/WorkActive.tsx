import { useState } from 'react'
import type { components } from '@timegems/sdk'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GemProgress } from '@/features/gems'
import { PresenceStrip } from '@/features/presence'
import { ProjectPicker } from './ProjectPicker'
import { GoalPicker } from './GoalPicker'
import { NoteList } from './NoteList'
import { NoteComposer } from './NoteComposer'
import { ProjectFeed } from '@/features/project-activity'
import { formatElapsedEstimate } from '../lib/formatDuration'
import { formatTime } from '../lib/formatTime'

type Project = components['schemas']['Project']
type Goal = components['schemas']['Goal']
type Note = components['schemas']['Note']

interface WorkActiveProps {
  workSessionId: string
  sessionName: string
  isPaused: boolean
  elapsedSeconds: number
  startedAt: string
  carryInSec: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
  pausePending: boolean
  resumePending: boolean
  reviewPending: boolean
  projects: Project[]
  activeProjectId?: string | null
  onSelectProject: (projectId: string) => void
  onCreateProject?: (name: string) => Promise<void>
  creatingProject: boolean
  goals: Goal[]
  activeGoalId?: string | null
  onSelectGoal: (goalId: string | null) => void
  notes: Note[]
  onAddNote: (body: string) => Promise<void>
  addingNote: boolean
  recentTexts?: string[]
  teamId?: string
}

export function WorkActive({
  workSessionId,
  sessionName,
  isPaused,
  elapsedSeconds,
  startedAt,
  carryInSec,
  onPause,
  onResume,
  onStop,
  pausePending,
  resumePending,
  reviewPending,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  creatingProject,
  goals,
  activeGoalId,
  onSelectGoal,
  notes,
  onAddNote,
  addingNote,
  recentTexts,
  teamId,
}: WorkActiveProps) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerExiting, setComposerExiting] = useState(false)

  async function handleAddNote(body: string) {
    await onAddNote(body)
    // Let the new note paint + fade in first, then dissolve the form.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await new Promise((resolve) => setTimeout(resolve, 160))
    setComposerExiting(true)
    await new Promise((resolve) => setTimeout(resolve, 180))
    setComposerOpen(false)
    setComposerExiting(false)
  }

  function toggleComposer() {
    if (composerExiting) return
    setComposerOpen((open) => !open)
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-6">

        <h1 className="text-center text-xl font-bold tracking-tight">{sessionName}</h1>

        <div className="w-full flex gap-4">
          <h6>Online</h6>
          <div>
            <PresenceStrip />
          </div>
        </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{isPaused ? 'Paused' : 'Working'}</p>
          <p className="text-lg font-medium tracking-tight">{formatElapsedEstimate(elapsedSeconds)} logged</p>
          <p className="text-xs text-muted-foreground">
            Started at {formatTime(startedAt)}
            {!isPaused && ' · refreshes every 5 min'}
          </p>
        </div>

        <div className="grid w-full max-w-xs grid-cols-2 gap-2 pt-1">
          {isPaused ? (
            <Button className="w-full px-2" onClick={onResume} loading={resumePending}>
              Resume
            </Button>
          ) : (
            <Button className="w-full px-2" variant="default" onClick={onPause} loading={pausePending}>
              Pause
            </Button>
          )}
          <Button className="w-full px-2" variant="outline" size="icon" loading={reviewPending} onClick={onStop}>
            Stop
          </Button>
        </div>

        {activeProjectId && (
          <div className="mx-auto w-full max-w-sm pt-1">
            <GemProgress carryInSec={carryInSec} elapsedSeconds={elapsedSeconds} />
          </div>
        )}
      </section>

      <section className="border-t pt-5">
        <ProjectPicker
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={onSelectProject}
          onCreate={onCreateProject}
          creating={creatingProject}
        />
      </section>

      {goals.length > 0 && (
        <section className="border-t pt-5">
          <GoalPicker goals={goals} activeGoalId={activeGoalId} onSelect={onSelectGoal} />
        </section>
      )}

      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={composerOpen}
            className="w-[120px] truncate"
            aria-controls="work-update-composer"
            onClick={toggleComposer}
          >
            {composerOpen ? <X size={14} /> : <Plus size={14} />}
            {composerOpen ? 'Cancel' : 'Add update'}
          </Button>
        </div>
        {composerOpen && (
          <div
            id="work-update-composer"
            className={composerExiting ? 'animate-fade-out-fast' : 'animate-fade-in-fast'}
          >
            <NoteComposer
              onAdd={handleAddNote}
              loading={addingNote || composerExiting}
              recentTexts={recentTexts}
              teamId={teamId}
              workSessionId={workSessionId}
            />
          </div>
        )}
        <NoteList notes={notes} />
      </section>

      {activeProjectId && <ProjectFeed projectId={activeProjectId} compact />}
    </div>
  )
}
