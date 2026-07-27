import type { components } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { GemProgress } from '@/features/gems'
import { PresenceStrip } from '@/features/presence'
import { ProjectPicker } from './ProjectPicker'
import { GoalPicker } from './GoalPicker'
import { NoteList } from './NoteList'
import { NoteComposer } from './NoteComposer'
import { formatDuration } from '../lib/formatDuration'
import { formatTime } from '../lib/formatTime'

type Project = components['schemas']['Project']
type Goal = components['schemas']['Goal']
type Note = components['schemas']['Note']
type GemType = components['schemas']['GemType']

interface WorkActiveProps {
  isPaused: boolean
  elapsedSeconds: number
  startedAt: string
  gemType: GemType | null
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
  isPaused,
  elapsedSeconds,
  startedAt,
  gemType,
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
  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto space-y-10">
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{isPaused ? 'Paused' : 'Working'}</p>
        <p className="text-7xl font-bold tabular-nums tracking-tight">{formatDuration(elapsedSeconds)}</p>
        <p className="text-sm text-muted-foreground">Started at {formatTime(startedAt)}</p>

        <div className="flex justify-center gap-3 pt-2">
          {isPaused ? (
            <Button size="lg" onClick={onResume} loading={resumePending}>
              Resume
            </Button>
          ) : (
            <Button size="lg" variant="outline" onClick={onPause} loading={pausePending}>
              Pause
            </Button>
          )}
          <Button size="lg" variant="destructive" loading={reviewPending} onClick={onStop}>
            Stop
          </Button>
        </div>

        <div className="flex justify-center pt-2">
          <PresenceStrip />
        </div>

        {gemType && (
          <div className="max-w-xs mx-auto pt-2">
            <GemProgress gemType={gemType} carryInSec={carryInSec} elapsedSeconds={elapsedSeconds} />
          </div>
        )}
      </div>

      <ProjectPicker
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={onSelectProject}
        onCreate={onCreateProject}
        creating={creatingProject}
      />

      <GoalPicker goals={goals} activeGoalId={activeGoalId} onSelect={onSelectGoal} />

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">New Updates</p>
        <NoteComposer onAdd={onAddNote} loading={addingNote} recentTexts={recentTexts} teamId={teamId} />
        <NoteList notes={notes} />
      </div>
    </div>
  )
}
