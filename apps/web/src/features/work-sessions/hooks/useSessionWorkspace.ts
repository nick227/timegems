import { useEffect, useRef } from 'react'
import { useSelectActiveTenant } from '@timegems/sdk'
import type { components } from '@timegems/sdk'

type WorkSessionDetail = components['schemas']['WorkSessionDetail']

// A shared /work/:id link may belong to a workspace the viewer is a member of
// but doesn't currently have selected. Presence and project-room broadcasts are
// tenant-scoped, so switch once when it is safe (no active work in another
// tenant blocks the switch server-side).
export function useSessionWorkspace(session: WorkSessionDetail | null, activeTenantId: string | undefined) {
  const selectTenant = useSelectActiveTenant()
  const attemptedForSession = useRef<string | null>(null)

  useEffect(() => {
    if (!session || !activeTenantId || session.tenantId === activeTenantId) return
    if (attemptedForSession.current === session.id) return
    attemptedForSession.current = session.id
    selectTenant.mutate(session.tenantId)
  }, [session, activeTenantId, selectTenant])
}
