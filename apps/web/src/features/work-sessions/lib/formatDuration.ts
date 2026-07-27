// Exact HH:MM:SS for the review surface, where a user is confirming the
// authoritative stopped duration rather than watching a running stopwatch.
export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/**
 * A deliberately low-resolution elapsed estimate for active-work surfaces.
 * Exact duration remains server-authoritative and is shown during review.
 */
export function formatElapsedEstimate(totalSeconds: number) {
  const totalMinutes = Math.max(0, Math.floor(totalSeconds / 60))
  if (totalMinutes < 5) return 'Under 5 min'

  const roundedMinutes = Math.floor(totalMinutes / 5) * 5
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0) return `About ${minutes} min`
  if (minutes === 0) return `About ${hours} hr`
  return `About ${hours} hr ${minutes} min`
}
