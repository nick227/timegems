import { usePresenceList, useCurrentUser } from '@timegems/sdk'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<string, string> = {
  working: 'bg-emerald-500',
  paused: 'bg-amber-500',
  online: 'bg-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  working: 'working',
  paused: 'paused',
  online: 'online',
}

const MAX_VISIBLE = 5

// Glanceable "who else is here" for the Work screen -- an overlapping
// avatar strip with a colored status dot per person (green = working,
// amber = paused, gray = online), self included and pinned first. No
// legend, no names by default: hover/tap an avatar for the detail.
//
// The name+status detail used to live only in a native `title` tooltip --
// invisible to screen readers (title isn't reliably announced) and
// unreachable without a mouse. Each entry is now a real Tab stop with its
// own accessible name carrying the same text, so both a screen reader and
// a keyboard-only sighted user (who won't see the tooltip either, but will
// see focus land and can pair that with the visible avatar/dot) can get at
// it -- title is kept alongside as a bonus for mouse users, not the only path.
export function PresenceStrip() {
  const presence = usePresenceList()
  const { data: me } = useCurrentUser()
  const currentUserId = me?.data?.user.id

  if (presence.length === 0) return null

  const sorted = [...presence].sort((a, b) => {
    if (a.userId === currentUserId) return -1
    if (b.userId === currentUserId) return 1
    return 0
  })
  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - visible.length

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Team presence" className="flex -space-x-2">
        {visible.map((entry) => {
          const label = `${entry.userId === currentUserId ? 'You' : entry.name} — ${STATUS_LABEL[entry.status] ?? entry.status}`
          /* eslint-disable jsx-a11y/no-noninteractive-tabindex --
             Deliberate: this info was previously reachable *only* via mouse
             hover (native `title`), with no keyboard path at all. A real
             interactive role (e.g. "button") would be more misleading --
             there's nothing to activate, it's a status display -- so this
             keeps the accurate "group" role and accepts the rule exception
             rather than lying about interactivity to satisfy it. */
          return (
            <div
              key={entry.userId}
              tabIndex={0}
              aria-label={label}
              title={label}
              className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar src={entry.avatarUrl} name={entry.name} size="sm" className="ring-2 ring-background" />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                  STATUS_DOT[entry.status],
                )}
              />
            </div>
          )
          /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
        })}
      </div>
      {overflow > 0 && <span className="text-xs text-muted-foreground">+{overflow} more</span>}
    </div>
  )
}
