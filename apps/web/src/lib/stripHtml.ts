// Lightweight, display-only plain-text extraction (e.g. building a
// suggestion-chip preview label from a stored note body). Not a security
// boundary -- sanitization happens server-side on write
// (apps/server/src/lib/sanitizeHtml.ts); this is just for showing a preview.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
