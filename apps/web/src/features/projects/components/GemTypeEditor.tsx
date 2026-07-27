import { useState } from 'react'
import { useUpdateProject } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Label } from '@/components/ui/Label'
import { SmartTextEditor } from '@/components/ui/smart-text-editor'
import { RichTextView } from '@/components/ui/RichTextView'
import { GemBadge } from '@/features/gems'
import { stripHtml } from '@/lib/stripHtml'
import { toast } from 'sonner'

const DEFAULT_ICON = '💎'
const DEFAULT_COLOR = '#6366f1'

interface GemTypeEditorProps {
  projectId: string
  gemType: { name: string; icon: string; color: string; description?: string | null } | null
  editable?: boolean
}

// Gem-*type configuration* (name/icon/color on a Project) lives here in the
// projects feature -- it's project settings. Gem-*earning*/progress/balance
// display (GemBadge, GemProgress, GemBank) is what the gems feature owns.
export function GemTypeEditor({ projectId, gemType, editable = false }: GemTypeEditorProps) {
  const updateMutation = useUpdateProject(projectId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(gemType?.name ?? '')
  const [icon, setIcon] = useState(gemType?.icon ?? DEFAULT_ICON)
  const [color, setColor] = useState(gemType?.color ?? DEFAULT_COLOR)
  const [description, setDescription] = useState(gemType?.description ?? '')

  if (!editing) {
    return (
      <Card>
        <CardContent className="py-4 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Gem type</p>
          {gemType ? (
            <div className="flex items-center gap-3">
              <GemBadge icon={gemType.icon} color={gemType.color} />
              <div>
                <p className="text-sm font-medium">{gemType.name}</p>
                {gemType.description && <RichTextView html={gemType.description} className="text-xs text-muted-foreground" />}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No gem type set — this project won't earn gems yet.</p>
          )}
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {gemType ? 'Edit gem type' : 'Set up a gem type'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Gem type</p>
        <div className="flex gap-2 items-end">
          <Field label="Icon" className="w-16">
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="💎" voice={false} className="text-center" />
          </Field>
          <Field label="Gem name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gem name" voice={false} />
          </Field>
          <div className="space-y-1.5">
            <Label htmlFor="gem-type-color">Color</Label>
            <input
              id="gem-type-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 rounded border border-input-border bg-transparent"
            />
          </div>
        </div>
        <Field label="Description" hint="Optional">
          <SmartTextEditor value={description} onChange={setDescription} placeholder="Description (optional)" />
        </Field>
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={updateMutation.isPending}
            onClick={async () => {
              if (!name.trim() || !icon.trim() || !color.trim()) return
              try {
                await updateMutation.mutateAsync({
                  gemType: { name: name.trim(), icon: icon.trim(), color, description: stripHtml(description).length > 0 ? description : undefined },
                })
                toast.success('Gem type saved')
                setEditing(false)
              } catch {
                // handled by the global mutation error toast
              }
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
