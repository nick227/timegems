import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  titleAs?: 'p' | 'h1' | 'h2'
}

export function EmptyState({ icon: Icon, title, description, action, titleAs = 'p' }: EmptyStateProps) {
  const Title = titleAs
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
      {Icon && <Icon size={32} className="text-muted-foreground" />}
      <Title className="font-medium text-sm">{title}</Title>
      {description && (
        <p className="text-muted-foreground text-sm max-w-xs">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
