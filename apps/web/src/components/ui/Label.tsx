import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  // jsx-a11y/label-has-associated-control can't see that `htmlFor` arrives
  // via `...props` -- every real caller goes through `Field`, which always
  // supplies it (or the caller passes it directly). The primitive itself
  // has nothing more to statically verify.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('block text-sm font-medium text-foreground', className)} {...props} />
}
