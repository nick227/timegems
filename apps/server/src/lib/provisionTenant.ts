import { db } from '@timegems/db'
import { randomUUID } from 'crypto'

// Shared by every "brand new user" path (anonymous, email register, first
// Google login) -- each needs the same bundle (a personal Tenant + an OWNER
// Membership) so the person lands somewhere usable immediately instead of
// dead-ending at "you have no organization yet." Not reused by
// TenantService.create(), which is the explicit, user-chosen "create another
// tenant" action with a caller-supplied name/slug -- this one is implicit
// and always derives its own slug, since nobody typed one in.
function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  )
}

export function personalTenantName(displayName: string) {
  return `${displayName}'s workspace`
}

export async function provisionPersonalTenant(userId: string, displayName: string) {
  const tenant = await db.tenant.create({
    data: {
      name: personalTenantName(displayName),
      // Random suffix rather than a collision-retry loop -- short enough to
      // stay readable in a URL, long enough that a real collision never
      // happens in practice.
      slug: `${slugify(displayName)}-${randomUUID().slice(0, 8)}`,
      memberships: { create: { userId, role: 'OWNER' } },
    },
  })
  return tenant
}

// When a guest renames themselves (or claims Google and gets a real name),
// keep any still-default personal workspace in sync so Settings doesn't keep
// showing "Sunny Fox 43's workspace" after they've become "Alex".
// Only touches tenants that still match the previous auto name -- a manually
// renamed org is left alone.
export async function syncPersonalTenantName(
  userId: string,
  oldDisplayName: string,
  newDisplayName: string,
) {
  if (oldDisplayName === newDisplayName) return

  await db.tenant.updateMany({
    where: {
      name: personalTenantName(oldDisplayName),
      memberships: { some: { userId, role: 'OWNER' } },
    },
    data: { name: personalTenantName(newDisplayName) },
  })
}
