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

export async function provisionPersonalTenant(userId: string, displayName: string) {
  const tenant = await db.tenant.create({
    data: {
      name: `${displayName}'s workspace`,
      // Random suffix rather than a collision-retry loop -- short enough to
      // stay readable in a URL, long enough that a real collision never
      // happens in practice.
      slug: `${slugify(displayName)}-${randomUUID().slice(0, 8)}`,
      memberships: { create: { userId, role: 'OWNER' } },
    },
  })
  return tenant
}
