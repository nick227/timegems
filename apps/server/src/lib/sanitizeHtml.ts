import sanitizeHtml from 'sanitize-html'

// Allowlist matches exactly what SmartTextEditor (apps/web) can actually
// produce: headings/links/lists/emphasis plus image/video/audio embeds.
// Anything else (script tags, event handler attributes, etc.) is stripped
// entirely rather than escaped, so stored content can be rendered with
// dangerouslySetInnerHTML on the read side without re-checking it there.
const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'img', 'video', 'audio', 'source', 'br']

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href'],
  img: ['src', 'alt'],
  video: ['src', 'controls'],
  audio: ['src', 'controls'],
  source: ['src', 'type'],
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https'],
  })
}

// Plain-text extraction for consumers that only need to read note content
// (e.g. AgentEmployeeService's keyword scanning) -- strips all markup
// rather than trying to reason about it.
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
}
