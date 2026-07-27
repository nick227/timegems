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
 * Refreshes the elapsed estimate every five minutes while `active` is true.
 * Interval boundaries still cause an immediate authoritative recompute when
 * work starts, pauses, resumes, or enters review.
 */
export function useWorkTimer(intervals: WorkSessionInterval[] | undefined, active: boolean) {
  const [nowTick, setNowTick] = useState(() => Date.now())
  const activeIntervalId = intervals?.find((interval) => interval.kind === 'ACTIVE' && !interval.endedAt)?.id

  useEffect(() => {
    if (!active) return
    setNowTick(Date.now())
    const id = setInterval(() => setNowTick(Date.now()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [active, activeIntervalId])

  return computeActiveSeconds(intervals ?? [], nowTick)
}
