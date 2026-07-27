import { HttpError } from './errors'
import type { TenantContext } from './tenant'

export type TenantCapability =
  | 'team:manage'
  | 'project:manage'
  | 'session:manage'

export type Capability = TenantCapability | 'site:admin'

const ROLE_CAPABILITIES: Record<TenantContext['membershipRole'], ReadonlySet<TenantCapability>> = {
  OWNER: new Set(['team:manage', 'project:manage', 'session:manage']),
  ADMIN: new Set(['team:manage', 'project:manage', 'session:manage']),
  MEMBER: new Set(),
}

export function capabilitiesFor(auth: TenantContext): Capability[] {
  return [...ROLE_CAPABILITIES[auth.membershipRole]]
}

export function requireCapability(auth: TenantContext, capability: TenantCapability) {
  if (!ROLE_CAPABILITIES[auth.membershipRole].has(capability)) {
    throw new HttpError(403, 'Forbidden')
  }
}

export function hasCapability(auth: TenantContext, capability: TenantCapability) {
  return ROLE_CAPABILITIES[auth.membershipRole].has(capability)
}
