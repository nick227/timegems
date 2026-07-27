// Hand-curated, same reasoning as funnyName.ts (auto-provisioned guest
// names): a small vetted list beats a large generated one that risks
// awkward combinations. Session-flavored rather than identity-flavored --
// these name a *session* (shown in the floating indicator, the project
// room, session history), not a person.
const ADJECTIVES = [
  'Quiet', 'Steady', 'Focused', 'Deep', 'Quick', 'Bright', 'Sharp', 'Calm',
  'Bold', 'Early', 'Late', 'Fresh', 'Solid', 'Smooth', 'Clear', 'Open',
  'Tight', 'Wide', 'Long', 'Short',
]

const NOUNS = [
  'Sprint', 'Session', 'Focus', 'Grind', 'Dive', 'Push', 'Flow', 'Streak',
  'Stretch', 'Run', 'Block', 'Pass', 'Loop', 'Sync', 'Build', 'Draft',
  'Round', 'Shift', 'Pace', 'Lap',
]

/** e.g. "Quiet Focus 12" -- collisions are fine, this is a display name, not an identifier. */
export function generateSessionName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const suffix = Math.floor(Math.random() * 100)
  return `${adjective} ${noun} ${suffix}`
}
