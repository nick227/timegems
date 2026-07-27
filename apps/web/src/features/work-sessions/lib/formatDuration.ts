// Stopwatch-style HH:MM:SS -- distinct from the "Xh Ym" human-readable
// format used by the views feature; the two have different audiences
// (a live ticking timer vs. a rollup summary) so they're kept separate
// rather than merged into one shared formatter.
export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
