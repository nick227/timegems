import { DEFAULT_GEM } from '../lib/defaultGem'

interface GemBadgeProps {
  size?: 'sm' | 'md'
}

export function GemBadge({ size = 'md' }: GemBadgeProps) {
  const dimension = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-7 w-7 text-sm'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${dimension}`}
      style={{ backgroundColor: `${DEFAULT_GEM.color}33` }}
      aria-hidden="true"
    >
      {DEFAULT_GEM.icon}
    </span>
  )
}
