import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { AlertTriangle } from 'lucide-react'

interface ListPageShellProps {
  isLoading: boolean
  isEmpty: boolean
  skeletonCount?: number
  skeletonClassName?: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  isError?: boolean
  errorTitle?: string
  onRetry?: () => void
  children: ReactNode
}

/**
 * The loading-skeleton / empty-state / loaded-list branch every list page
 * repeats. Per-item rendering (Link-wrapped card, plain card, etc.) varies
 * enough per page that it stays the caller's job -- this only owns the
 * three-way branch, not the list markup itself.
 */
export function ListPageShell({
  isLoading,
  isEmpty,
  skeletonCount = 3,
  skeletonClassName = 'h-16 w-full',
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isError = false,
  errorTitle = 'Items could not be loaded',
  onRetry,
  children,
}: ListPageShellProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={skeletonClassName} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={errorTitle}
        description="Check your connection and try again."
        action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      />
    )
  }

  if (isEmpty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
  }

  return <>{children}</>
}
