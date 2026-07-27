import { useEffect, useState } from 'react'
import { useUpdateProfile } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { useAuthorization } from '@/lib/Authorization'

export function ProfileCard() {
  const { user } = useAuthorization()
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(user.name)

  useEffect(() => {
    setName(user.name)
  }, [user.name])

  const dirty = name.trim() !== user.name
  const canSave = dirty && name.trim().length > 0 && !updateProfile.isPending

  async function handleSave() {
    const trimmed = name.trim()
    try {
      await updateProfile.mutateAsync({ name: trimmed })
      setName(trimmed)
      toast.success('Username updated')
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size="lg" />
          <div className="min-w-0 flex-1">
            {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
            <label className="block text-xs font-medium text-muted-foreground mt-1 mb-1" htmlFor="display-name">
              Username
            </label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) void handleSave()
                }}
              />
              <Button size="sm" disabled={!canSave} loading={updateProfile.isPending} onClick={() => void handleSave()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
