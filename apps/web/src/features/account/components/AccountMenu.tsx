import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthorization } from '@/lib/Authorization'

// Persistent, upper-right, visible on every protected screen including
// Work/Idle -- the whole point is that identity/guest status is impossible
// to miss *before* someone starts working, not just discoverable later in
// Settings. Deliberately a single link, not a dropdown: there's exactly one
// destination (Settings), just two different framings of it depending on
// isAnonymous.
//
// For a guest, this must NOT link to /login -- that page signs into a
// *different* account (Google or a fresh email/password), which would
// abandon this session's guest identity (and its work) rather than attach
// credentials to it. Settings is where the actual in-place claim flow
// (ClaimAccountCard) lives, so that's always the destination; only the
// label changes.
export function AccountMenu() {
  const { user } = useAuthorization()
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      className="fixed top-4 right-4 z-20 flex h-12 items-center gap-2 rounded-full bg-surface pl-1.5 pr-4 text-surface-foreground hover:bg-accent transition-colors"
    >
      <Avatar src={user.avatarUrl} name={user.name} size="sm" />
      <span className="flex flex-col items-start leading-tight">
        <span className="max-w-[8rem] truncate text-sm font-medium">{user.name}</span>
        {user.isAnonymous && <span className="text-xs text-muted-foreground">Guest — Sign in</span>}
      </span>
    </button>
  )
}
