// Shared by WorkSessionService.stop() and GuestMergeService's forced
// finalize of a guest's still-running/paused/reviewing sessions -- both need
// the exact same "sum the ACTIVE intervals as of a point in time" math.
export function sumActiveSeconds(
  intervals: { kind: string; startedAt: Date; endedAt: Date | null }[],
  now: Date,
) {
  let total = 0
  for (const interval of intervals) {
    if (interval.kind !== 'ACTIVE') continue
    const end = interval.endedAt ?? now
    total += Math.max(0, Math.floor((end.getTime() - interval.startedAt.getTime()) / 1000))
  }
  return total
}
