import { cn } from '@/lib/utils'

// Borderless by design -- separation from the page comes from the
// background/surface contrast (see index.css), not a hairline border. Part
// of the bold-minimal direction: fewer lines, more space.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg bg-surface text-surface-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}
