// Hand-curated, not generated -- an algorithmic combination of word lists
// risks producing something embarrassing or inappropriate once you multiply
// two large lists together. Small and vetted beats large and risky here.
const ADJECTIVES = [
  'Clever', 'Swift', 'Cheerful', 'Bold', 'Gentle', 'Curious', 'Bright',
  'Calm', 'Nimble', 'Jolly', 'Brave', 'Quiet', 'Sunny', 'Lucky', 'Sharp',
  'Steady', 'Witty', 'Breezy', 'Cosmic', 'Golden',
]

const NOUNS = [
  'Otter', 'Falcon', 'Panda', 'Fox', 'Heron', 'Badger', 'Lynx', 'Sparrow',
  'Dolphin', 'Koala', 'Raven', 'Beaver', 'Rabbit', 'Wombat', 'Puffin',
  'Gecko', 'Marmot', 'Cricket', 'Otterling', 'Comet',
]

/** e.g. "Clever Otter 47" -- collisions are fine, this is a display name, not an identifier. */
export function generateFunnyName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const suffix = Math.floor(Math.random() * 100)
  return `${adjective} ${noun} ${suffix}`
}
