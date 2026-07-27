import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useModalBehavior } from './modal/useModalBehavior'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

/**
 * Low-level modal primitive -- overlay + centered panel, closes on Escape
 * or backdrop click. `ConfirmDialog` builds the yes/no confirm pattern on
 * top of this; use this one directly only if a confirm/cancel footer
 * doesn't fit what you need. Shares its focus/Escape/inert-background
 * behavior with any other "layer on top of the page" primitive via
 * `useModalBehavior` rather than reimplementing it (see that hook's own
 * comment for why).
 */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  const { containerRef } = useModalBehavior<HTMLDivElement>({ open, onOpenChange })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/10" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-sm rounded-lg border bg-surface text-surface-foreground p-4 space-y-3 shadow-lg',
          'focus-visible:outline-none',
          className,
        )}
      >
        <div className="space-y-1">
          <p className="font-medium text-sm">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
