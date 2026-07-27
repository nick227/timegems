import { GemBadge } from './GemBadge'

const SECONDS_PER_GEM = 3600

interface GemProgressProps {
  gemType: { name: string; icon: string; color: string }
  carryInSec: number
  elapsedSeconds: number
}

export function GemProgress({ gemType, carryInSec, elapsedSeconds }: GemProgressProps) {
  const totalSec = carryInSec + elapsedSeconds
  const gemsToEarn = Math.floor(totalSec / SECONDS_PER_GEM)
  const remainderSec = totalSec % SECONDS_PER_GEM
  const remainderMin = Math.floor(remainderSec / 60)
  const progressPct = Math.min(100, (remainderSec / SECONDS_PER_GEM) * 100)

  // The one spot of color on an otherwise monochrome screen -- the gem's own
  // color is used directly for the earned count and the fill, so the reward
  // moment is unmistakable without any other accent competing for attention.
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <GemBadge icon={gemType.icon} color={gemType.color} />
        {gemsToEarn > 0 && (
          <span className="text-2xl font-bold tabular-nums" style={{ color: gemType.color }}>
            +{gemsToEarn}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {gemsToEarn > 0 ? `${gemType.name} earned` : `${remainderMin}m into next ${gemType.name}`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progressPct}%`, backgroundColor: gemType.color }}
        />
      </div>
    </div>
  )
}
