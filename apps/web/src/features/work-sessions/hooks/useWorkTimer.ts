import { useEffect, useState } from 'react'
import type { components } from '@timegems/sdk'

type WorkSessionInterval = components['schemas']['WorkSessionInterval']

function computeActiveSeconds(intervals: WorkSessionInterval[], now: number) {
  let total = 0
  for (const interval of intervals) {
    if (interval.kind !== 'ACTIVE') continue
    const end = interval.endedAt ? new Date(interval.endedAt).getTime() : now
    total += Math.max(0, Math.floor((end - new Date(interval.startedAt).getTime()) / 1000))
  }
  return total
}

/**
 * Ticks once a second while `active` is true and returns the live elapsed
 * ACTIVE-interval seconds for a work session. Stops ticking (freezing the
 * last computed value) once `active` goes false, e.g. entering stop-review.
 */
export function useWorkTimer(intervals: WorkSessionInterval[] | undefined, active: boolean) {
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  return computeActiveSeconds(intervals ?? [], nowTick)
}
