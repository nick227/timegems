import { GemBadge } from './GemBadge'
import { DEFAULT_GEM } from '../lib/defaultGem'

const SECONDS_PER_GEM = 3600

interface GemProgressProps {
  carryInSec: number
  elapsedSeconds: number
}

export function GemProgress({ carryInSec, elapsedSeconds }: GemProgressProps) {
  const totalSec = carryInSec + elapsedSeconds
  const gemsToEarn = Math.floor(totalSec / SECONDS_PER_GEM)
  const remainderSec = totalSec % SECONDS_PER_GEM
  const remainderMin = Math.floor(remainderSec / 60)
  const progressPct = Math.min(100, (remainderSec / SECONDS_PER_GEM) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <GemBadge />
        {gemsToEarn > 0 && (
          <span className="text-2xl font-bold tabular-nums" style={{ color: DEFAULT_GEM.color }}>
            +{gemsToEarn}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {gemsToEarn > 0 ? 'gems earned' : `${remainderMin}m into next gem`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progressPct}%`, backgroundColor: DEFAULT_GEM.color }}
        />
      </div>
    </div>
  )
}
