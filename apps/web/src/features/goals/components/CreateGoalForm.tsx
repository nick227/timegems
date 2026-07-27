import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Label } from '@/components/ui/Label'
import { SmartTextEditor } from '@/components/ui/smart-text-editor'
import { useRovingRadioGroup } from '@/components/ui/hooks/useRovingRadioGroup'
import { cn } from '@/lib/utils'
import { stripHtml } from '@/lib/stripHtml'
import { ComplexityPicker } from './ComplexityPicker'

interface Project {
  id: string
  name: string
}

// Same sentinel technique as GoalPicker's "No goal" option -- see its own
// comment for why.
const NO_PROJECT = '__none__'

interface CreateGoalFormProps {
  // Omit to lock the goal to `fixedProjectId` (e.g. embedded on a Project's
  // own planning section) instead of showing a picker.
  projects?: Project[]
  fixedProjectId?: string | null
  onCreate: (input: { title: string; description: string; projectId?: string | null; complexityScore: number; estimatedHours: number | null }) => Promise<void>
  creating: boolean
}

export function CreateGoalForm({ projects, fixedProjectId, onCreate, creating }: CreateGoalFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<string | null>(fixedProjectId ?? null)
  const [complexityScore, setComplexityScore] = useState(3)
  const [estimatedHours, setEstimatedHours] = useState('')
  const projectGroup = useRovingRadioGroup(
    [NO_PROJECT, ...(projects ?? []).map((p) => p.id)],
    projectId ?? NO_PROJECT,
    (next) => setProjectId(next === NO_PROJECT ? null : next),
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full text-sm border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        + New goal
      </button>
    )
  }

  async function handleSave() {
    if (!title.trim() || stripHtml(description).length === 0) return
    await onCreate({
      title: title.trim(),
      description,
      projectId,
      complexityScore,
      estimatedHours: estimatedHours.trim() ? Number(estimatedHours) : null,
    })
    setTitle('')
    setDescription('')
    setEstimatedHours('')
    setComplexityScore(3)
    setOpen(false)
  }

  return (
    <div className="space-y-3 rounded-lg bg-surface p-4 w-full">
      <Field label="Goal title">
        {/* Callback ref instead of the JSX `autoFocus` attribute -- see
            Toolbar.tsx's identical comment. This form only renders once the
            user has already clicked "+ New goal", so focusing what just
            appeared is the expected continuation of their own action. */}
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" voice={false} ref={(el) => el?.focus()} />
      </Field>
      <Field label="Description" hint="What does 'done' look like?">
        <SmartTextEditor value={description} onChange={setDescription} placeholder="What does 'done' look like?" />
      </Field>

      {projects && !fixedProjectId && (
        <div className="flex flex-wrap gap-2" {...projectGroup.groupProps} aria-label="Project">
          <button
            {...projectGroup.getItemProps(NO_PROJECT)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              projectId === null ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            No project
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              {...projectGroup.getItemProps(project.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                projectId === project.id ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Complexity</Label>
          <ComplexityPicker value={complexityScore} onChange={setComplexityScore} />
        </div>
        <Field label="Est. hours" className="w-28">
          <Input type="number" min={0} value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="Est. hours" voice={false} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button size="sm" loading={creating} onClick={handleSave}>
          Create goal
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
