export function requireTenantId(request: any): string {
  if (!request.tenantId) {
    throw { statusCode: 400, message: 'No active tenant selected. Call POST /tenants/{tenantId}/select first.' }
  }
  return request.tenantId
}
