import { HttpError } from './errors'

export type IdentityContext = {
  userId: string
  sessionId: string
}

export type TenantContext = IdentityContext & {
  tenantId: string
  membershipId: string
  membershipRole: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export function requireTenantContext(request: any): TenantContext {
  const auth = request.auth
  if (auth?.tenantAccessRevoked) {
    throw new HttpError(403, 'Tenant access revoked')
  }
  if (!auth?.tenantId || !auth.membershipId || !auth.membershipRole) {
    throw new HttpError(400, 'No active tenant selected. Call POST /tenants/{tenantId}/select first.')
  }
  return auth as TenantContext
}

export function requireTenantId(request: any): string {
  return requireTenantContext(request).tenantId
}
