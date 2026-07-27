import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useModalBehavior } from './modal/useModalBehavior'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible name for the panel (e.g. "Main menu") -- doesn't have to
   * duplicate a visible heading rendered in `children`, just describe it. */
  title: string
  side?: 'left' | 'right'
  children?: ReactNode
  className?: string
}

/**
 * Edge-anchored sibling to `Dialog` -- same modal behavior (Escape, focus
 * trap in/out, inert background, backdrop dismissal), different geometry:
 * a full-height slide-in panel instead of a centered card. Deliberately
 * unopinionated about its own header/content, same as `Dialog` -- the
 * caller (e.g. `Shell`'s hamburger menu) renders whatever it needs inside.
 */
export function Drawer({ open, onOpenChange, title, side = 'left', children, className }: DrawerProps) {
  const { containerRef } = useModalBehavior<HTMLDivElement>({ open, onOpenChange })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-30 flex">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-72 max-w-[85vw] flex-col bg-background',
          'focus-visible:outline-none',
          side === 'left' ? 'mr-auto' : 'ml-auto',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
