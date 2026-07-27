import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface RichTextViewProps {
  html: string
  className?: string
}

const EXTERNAL_HREF = /^([a-z]+:)?\/\//i

// Renders content that was already sanitized server-side on write (see
// apps/server/src/lib/sanitizeHtml.ts) -- dangerouslySetInnerHTML is safe
// here specifically *because* nothing reaches storage without going
// through that allowlist first, not because HTML is inherently safe to
// skip re-checking on the read side too.
//
// Reuses the ".ProseMirror" class from index.css (SmartTextEditor's own
// styling) so saved content renders with the same typography it was
// authored with, without duplicating those CSS rules.
export function RichTextView({ html, className }: RichTextViewProps) {
  const navigate = useNavigate()

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    // Absolute/external links (including uploaded media pointing at the API
    // origin) get normal browser handling; only same-origin relative paths
    // (mentions: /projects/:id, /users/:id) are SPA-navigated.
    if (!href || EXTERNAL_HREF.test(href)) return
    e.preventDefault()
    navigate(href)
  }

  // The div's onClick only intercepts clicks that bubble up from a real
  // <a> inside the sanitized HTML -- those anchors are already natively
  // focusable/keyboard-operable (Enter activates them, the browser fires
  // the same click event this handler reads e.target from), so the div
  // itself doesn't need its own keyboard handler or interactive role; it's
  // a delegation target, not a second interactive element.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
  return <div className={cn('ProseMirror text-sm', className)} onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
}
