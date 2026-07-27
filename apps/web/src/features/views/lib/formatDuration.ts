// Human-readable "Xh Ym" rollup format -- distinct from work-sessions'
// stopwatch-style HH:MM:SS formatter; kept feature-local since each has
// exactly one caller today (see the plan notes on why these aren't merged).
export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
