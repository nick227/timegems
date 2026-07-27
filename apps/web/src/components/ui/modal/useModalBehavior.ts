import { useEffect, useRef } from 'react'

// [contenteditable="true"] covers SmartTextEditor's Tiptap root -- it's
// natively part of the browser's tab order without needing an explicit
// tabindex (same as a real <textarea>), but wasn't in this query, so a
// dialog where a rich-text field is the first/last focusable thing (e.g.
// SessionCorrectionDialog's note editors) computed the wrong wrap boundary.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

interface UseModalBehaviorOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  dismissOnEscape?: boolean
}

/**
 * The behavior every "layer on top of the page that owns input focus while
 * open" primitive needs, regardless of how it looks: Escape-to-close, focus
 * moved in on open and restored to the trigger on close, Tab contained
 * inside (a real focus trap, not just visual layering), the rest of the app
 * marked `inert`/`aria-hidden` so a screen reader can't wander into it, and
 * background scroll locked. `Dialog` (centered, confirm-style) builds on
 * this instead of hand-rolling its own subset of it -- that kind of
 * duplication (and the drift between copies) is what caused the app's old
 * hamburger drawer to end up with none of this despite `Dialog` already
 * having it. The drawer itself was retired when the hamburger nav was
 * removed in favor of tabs inside /settings, but the lesson (share this
 * behavior, don't re-derive it) still applies to any future modal-like
 * primitive.
 *
 * Returns a `containerRef` the primitive must attach to its outermost
 * focusable panel element (given `tabIndex={-1}` by the caller so it's a
 * valid focus target even though it's not naturally focusable).
 */
export function useModalBehavior<T extends HTMLElement = HTMLDivElement>({
  open,
  onOpenChange,
  dismissOnEscape = true,
}: UseModalBehaviorOptions) {
  const containerRef = useRef<T | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    // Move focus into the modal so screen readers announce it and Tab
    // starts from inside, not wherever focus happened to be on the page.
    const container = containerRef.current
    const firstFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? container)?.focus()

    // The rest of the app is unreachable to both pointer and assistive
    // tech while a modal is open -- `inert` covers both in one attribute
    // in modern browsers; `aria-hidden` is kept alongside it as a fallback
    // for the few that don't yet support `inert`.
    const appRoot = document.getElementById('root')
    appRoot?.setAttribute('inert', '')
    appRoot?.setAttribute('aria-hidden', 'true')

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (dismissOnEscape && e.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab' || !container) return

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      appRoot?.removeAttribute('inert')
      appRoot?.removeAttribute('aria-hidden')
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [open, onOpenChange, dismissOnEscape])

  return { containerRef }
}
