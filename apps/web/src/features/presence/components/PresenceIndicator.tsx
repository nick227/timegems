import { usePresenceList } from '@timegems/sdk'

const STATUS_DOT: Record<string, string> = {
  working: 'bg-emerald-500',
  paused: 'bg-amber-500',
  online: 'bg-muted-foreground',
}

export function PresenceIndicator({ userId }: { userId: string }) {
  const presence = usePresenceList()
  const entry = presence.find((p) => p.userId === userId)

  if (!entry) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-border" />
        Offline
      </span>
    )
  }

  const label =
    entry.status === 'working'
      ? `Working${entry.projectName ? ` — ${entry.projectName}` : ''}`
      : entry.status === 'paused'
        ? 'Paused'
        : 'Online'

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[entry.status]}`} />
      {label}
    </span>
  )
}
