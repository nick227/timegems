import { Gem } from 'lucide-react'
import { GemBadge } from './GemBadge'
import { DEFAULT_GEM } from '../lib/defaultGem'

const SECONDS_PER_GEM = 3600

interface GemProgressProps {
  carryInSec: number
  elapsedSeconds: number
}

function formatMinutesToNext(remainderSec: number): string {
  const minToNext = Math.floor((SECONDS_PER_GEM - remainderSec) / 60)
  if (minToNext <= 0 && remainderSec > 0) return '<1m to next gem'
  return `${minToNext}m to next gem`
}

export function GemProgress({ carryInSec, elapsedSeconds }: GemProgressProps) {
  const totalSec = carryInSec + elapsedSeconds
  const gemsToEarn = Math.floor(totalSec / SECONDS_PER_GEM)
  const remainderSec = totalSec % SECONDS_PER_GEM
  const progressPct = Math.min(100, (remainderSec / SECONDS_PER_GEM) * 100)
  const timeLabel = formatMinutesToNext(remainderSec)
  const statusLabel =
    gemsToEarn > 0
      ? remainderSec > 0
        ? `gems earned · ${timeLabel}`
        : 'gems earned'
      : timeLabel

  const markerLeft = `calc((100% - 1rem) * ${progressPct / 100} + 0.5rem)`
  const fillWidth = `calc((100% - 1rem) * ${progressPct / 100})`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <GemBadge />
        {gemsToEarn > 0 && (
          <span className="text-2xl font-bold tabular-nums" style={{ color: DEFAULT_GEM.color }}>
            +{gemsToEarn}
          </span>
        )}
        <span className="text-sm text-muted-foreground">{statusLabel}</span>
      </div>

      <div className="relative h-6 w-full" aria-hidden>
        <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted/80 ring-1 ring-inset ring-border/40" />
        <div
          className="absolute left-2 top-1/2 h-2 -translate-y-1/2 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: fillWidth,
            background: `linear-gradient(90deg, ${DEFAULT_GEM.color}99, ${DEFAULT_GEM.color})`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500 ease-out"
          style={{ left: markerLeft }}
        >
          <Gem
            className="size-4 drop-shadow-sm"
            style={{ color: DEFAULT_GEM.color, fill: DEFAULT_GEM.color }}
            strokeWidth={1.25}
          />
        </div>
        </div>
    </div>
  )
}
