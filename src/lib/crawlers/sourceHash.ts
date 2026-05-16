/**
 * Canonical SHA-256 hash for event_candidates deduplication.
 *
 * Two inputs are supported:
 *   1. source_url present  → hash("source_url:" + normalizedUrl)
 *   2. source_url absent   → hash over fallback fields (title, date, idol,
 *                             source_name, source_type) joined by '|'
 *
 * The hash is the single column the DB unique index is built on
 * (migration 017). Callers must produce a stable hash across runs so
 * re-running a crawler over the same source yields the same key.
 *
 * Uses Node's built-in `node:crypto`. No new dependency.
 */

import { createHash } from 'node:crypto'

export interface HashInput {
  sourceUrl?: string | null
  rawTitle?: string | null
  detectedDate?: string | null
  detectedIdolId?: string | null
  sourceName?: string | null
  sourceType?: string | null
}

/** Lower-case, trim, collapse internal whitespace to a single space. */
function normalizeText(s: string | null | undefined): string {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Trim, lower-case, strip trailing slash. Query strings are kept as-is. */
function normalizeUrl(s: string | null | undefined): string {
  if (!s) return ''
  let u = s.trim().toLowerCase()
  // Strip ALL trailing slashes (defensive).
  u = u.replace(/\/+$/, '')
  return u
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Produce a canonical hash. Returns null only if there is literally nothing
 * to hash (no url and no title) — callers should treat that as a skipped row.
 */
export function computeSourceHash(input: HashInput): string | null {
  const url = normalizeUrl(input.sourceUrl)
  if (url) {
    return sha256Hex(`source_url:${url}`)
  }

  const title = normalizeText(input.rawTitle)
  if (!title) {
    // Nothing meaningful to hash — refuse rather than create a worthless key.
    return null
  }

  const parts = [
    'fallback',
    title,
    normalizeText(input.detectedDate),
    normalizeText(input.detectedIdolId),
    normalizeText(input.sourceName),
    normalizeText(input.sourceType),
  ]
  return sha256Hex(parts.join('|'))
}
