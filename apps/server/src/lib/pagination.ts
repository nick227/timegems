import { HttpError } from './errors'

type CursorPayload = {
  createdAt: string
  id: string
}

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid cursor')
  }
}

export function normalizeLimit(limit?: number, max = 100, fallback = 20) {
  return Math.min(Math.max(Number(limit ?? fallback), 1), max)
}

/**
 * Every list endpoint sorts by `(createdAt desc, id desc)` and pages by
 * "strictly before the last row seen" -- this is the where-clause half of
 * that convention, shared so the (createdAt, id) tie-break can't drift
 * between services.
 */
export function cursorWhere(cursor: CursorPayload | null) {
  if (!cursor) return {}
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ],
  }
}

/** The take-one-extra / slice / nextCursor half of the same convention. */
export function paginate<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null
  return { data: items, meta: { hasMore, nextCursor } }
}

/** Standard `orderBy` for the shared cursor convention above. */
export const cursorOrderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
