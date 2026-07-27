// Renders a project's gem type. `icon` is a free-text glyph (an emoji is the
// expected input, e.g. "💎" or "🔴") rather than a lucide icon name -- there's
// no icon-name registry to keep in sync between the gem-type editor and this
// renderer, and an emoji picker is a native OS feature on every platform.
interface GemBadgeProps {
  icon: string
  color: string
  size?: 'sm' | 'md'
}

export function GemBadge({ icon, color, size = 'md' }: GemBadgeProps) {
  const dimension = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-7 w-7 text-sm'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${dimension}`}
      style={{ backgroundColor: `${color}33` }}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
}
