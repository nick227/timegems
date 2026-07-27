import { useMemo, useState } from 'react'
import type { components } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SmartTextEditor } from '@/components/ui/smart-text-editor'
import { stripHtml } from '@/lib/stripHtml'

type Session = components['schemas']['WorkSessionHistoryItem']
type Project = components['schemas']['Project']
type Goal = components['schemas']['Goal']

interface SessionCorrectionDialogProps {
  session: Session
  projects: Project[]
  goals: Goal[]
  resourcesLoading: boolean
  resourcesError: boolean
  saving: boolean
  onClose: () => void
  onRetryResources: () => void
  onSave: (changes: {
    session: {
      projectId?: string | null
      goalId?: string | null
      activeDurationSec?: number
    }
    notes: { noteId: string; body: string }[]
  }) => Promise<void>
}

function formatDurationInput(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60)
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function parseDurationInput(value: string) {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60
}

const selectClassName =
  'flex h-9 w-full rounded border border-input-border bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SessionCorrectionDialog({
  session,
  projects,
  goals,
  resourcesLoading,
  resourcesError,
  saving,
  onClose,
  onRetryResources,
  onSave,
}: SessionCorrectionDialogProps) {
  const [duration, setDuration] = useState(() => formatDurationInput(session.activeDurationSec))
  const [projectId, setProjectId] = useState(session.projectId ?? '')
  const [goalId, setGoalId] = useState(session.goalId ?? '')
  const [noteDrafts, setNoteDrafts] = useState(() =>
    Object.fromEntries(session.notes.map((note) => [note.id, note.body])),
  )
  const [durationError, setDurationError] = useState<string>()
  const [notesError, setNotesError] = useState<string>()

  const availableProjects = useMemo(
    () => session.project && !projects.some((project) => project.id === session.project?.id)
      ? [session.project, ...projects]
      : projects,
    [projects, session.project],
  )
  const availableGoals = useMemo(
    () => session.goal && !goals.some((goal) => goal.id === session.goal?.id)
      ? [session.goal, ...goals]
      : goals,
    [goals, session.goal],
  )
  const compatibleGoals = useMemo(
    () => availableGoals.filter((goal) => !goal.projectId || goal.projectId === (projectId || null)),
    [availableGoals, projectId],
  )

  async function handleSave() {
    const activeDurationSec = parseDurationInput(duration)
    if (activeDurationSec == null) {
      setDurationError('Use hours:minutes, for example 1:30.')
      return
    }
    const emptyNote = session.notes.find((note) => {
      const body = noteDrafts[note.id] ?? ''
      return stripHtml(body).length === 0 && !/<(img|video|audio)\b/i.test(body)
    })
    if (emptyNote) {
      setNotesError('Saved notes cannot be empty.')
      return
    }

    setDurationError(undefined)
    setNotesError(undefined)
    const nextProjectId = projectId || null
    const nextGoalId = goalId || null
    const sessionChanges = {
      ...(activeDurationSec !== session.activeDurationSec ? { activeDurationSec } : {}),
      ...(nextProjectId !== session.projectId ? { projectId: nextProjectId } : {}),
      ...(nextGoalId !== session.goalId ? { goalId: nextGoalId } : {}),
    }
    const noteChanges = session.notes.flatMap((note) => {
      const body = noteDrafts[note.id] ?? note.body
      return body === note.body ? [] : [{ noteId: note.id, body }]
    })
    await onSave({ session: sessionChanges, notes: noteChanges })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Correct session"
      description="Changes are recorded and gem totals are recalculated when timing or project changes."
      className="max-h-[90vh] max-w-lg overflow-y-auto"
    >
      <div className="space-y-4">
        {resourcesError && (
          <div role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
            Project and goal options could not be loaded. You can still correct duration or notes.
            <Button variant="ghost" size="sm" className="ml-2" onClick={onRetryResources}>
              Retry options
            </Button>
          </div>
        )}
        <Field label="Duration" hint="Hours:minutes" error={durationError}>
          <Input
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            inputMode="numeric"
            placeholder="1:30"
            voice={false}
          />
        </Field>

        <Field label="Project">
          <select
            className={selectClassName}
            value={projectId}
            disabled={resourcesLoading || resourcesError}
            onChange={(event) => {
              const nextProjectId = event.target.value
              setProjectId(nextProjectId)
              const selectedGoal = availableGoals.find((goal) => goal.id === goalId)
              if (selectedGoal?.projectId && selectedGoal.projectId !== nextProjectId) setGoalId('')
            }}
          >
            <option value="">No project</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Goal">
          <select
            className={selectClassName}
            value={goalId}
            disabled={resourcesLoading || resourcesError}
            onChange={(event) => setGoalId(event.target.value)}
          >
            <option value="">No goal</option>
            {compatibleGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </Field>

        {session.notes.length > 0 && (
          <div className="space-y-3">
            {session.notes.map((note, index) => (
              <Field key={note.id} label={session.notes.length === 1 ? 'Note' : `Note ${index + 1}`}>
                <SmartTextEditor
                  value={noteDrafts[note.id] ?? note.body}
                  onChange={(body) => setNoteDrafts((current) => ({ ...current, [note.id]: body }))}
                  disabled={saving}
                  aria-label={session.notes.length === 1 ? 'Note' : `Note ${index + 1}`}
                />
              </Field>
            ))}
            {notesError && <p className="text-xs text-destructive">{notesError}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => void handleSave()}>
            Save corrections
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
