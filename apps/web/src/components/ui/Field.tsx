import { cloneElement, isValidElement, useId, type ReactElement } from 'react'
import { Label } from './Label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  /** A single form control (Input, Textarea, SmartTextEditor, ...). Gets
   * `id`/`aria-describedby`/`aria-invalid` wired onto it automatically --
   * pass your own `id` on the child only if something else already
   * references it; otherwise Field generates one. */
  children: ReactElement
  className?: string
}

/**
 * Connects a visible label to its control via htmlFor/id, wires up an
 * optional hint/error via aria-describedby, and sets aria-invalid when
 * there's an error -- the one thing every current form field in this app
 * was missing (placeholder-only fields with no real label). Deliberately
 * not a prop on Input/Textarea themselves: a `label` prop there would force
 * one layout and make every consumer that doesn't want a stacked
 * label-above-control fight it. This wraps any single control instead.
 */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const generatedId = useId()
  const existingProps = children.props as Record<string, unknown>
  const id = (existingProps.id as string | undefined) ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      } as Record<string, unknown>)
    : children

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
