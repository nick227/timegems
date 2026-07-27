// Fixed gem presentation — every project earns the same gem, always on.
// No per-project name/icon/color/description; GemType rows still exist as the
// ledger FK / award gate, but callers write these constants and UIs ignore
// anything else that might still be stored from older projects.
export const DEFAULT_GEM = {
  name: 'Gem',
  icon: '💎',
  color: '#6366f1',
} as const
