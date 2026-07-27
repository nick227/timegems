import { useState } from 'react'
import type { components } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useRovingRadioGroup } from '@/components/ui/hooks/useRovingRadioGroup'
import { cn } from '@/lib/utils'

type Project = components['schemas']['Project']

interface ProjectPickerProps {
  projects: Project[]
  activeProjectId?: string | null
  onSelect: (projectId: string) => void
  onCreate?: (name: string) => Promise<void>
  creating: boolean
}

export function ProjectPicker({ projects, activeProjectId, onSelect, onCreate, creating }: ProjectPickerProps) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const { groupProps, getItemProps } = useRovingRadioGroup(
    projects.map((p) => p.id),
    activeProjectId ?? null,
    onSelect,
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* `display: contents` (Tailwind's `contents`) so this wrapper carries
            the radiogroup role/keyboard behavior without breaking the parent's
            flex-wrap layout -- the "+ New project" action below is a sibling,
            not a radio option, and stays outside this group on purpose. */}
        <div className="contents" {...groupProps} aria-labelledby="project-picker-label">
          {projects.map((project) => (
            <button
              key={project.id}
              {...getItemProps(project.id)}
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
        </div>

        {onCreate && (showNew ? (
          <div className="flex gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              aria-label="New project name"
              voice={false}
              className="h-8 text-sm"
              // Callback ref instead of `autoFocus` -- see Toolbar.tsx's
              // identical comment. Only rendered after the user clicks
              // "+ New project", so focusing it is the expected next step.
              ref={(el) => el?.focus()}
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
            className="w-[120px] truncate inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input-border bg-transparent hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
          >
            + New project
          </button>
        ))}
      </div>
    </div>
  )
}
