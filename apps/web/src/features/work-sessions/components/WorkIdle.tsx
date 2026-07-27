import { Button } from '@/components/ui/Button'

// Idle is the single most important screen in the product -- one huge,
// unmissable button in open space, nothing else to look at or decide.
export function WorkIdle({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Visually hidden -- a visible heading would fight the "nothing else
          to look at" intent above, but every page needs exactly one real
          h1 for screen reader / page-structure navigation (axe's
          page-has-heading-one caught this screen having none at all). */}
      <h1 className="sr-only">Work</h1>
      <Button
        size="lg"
        loading={loading}
        onClick={onStart}
        className="h-20 px-14 rounded-full text-2xl font-bold"
      >
        Start Work
      </Button>
    </div>
  )
}
