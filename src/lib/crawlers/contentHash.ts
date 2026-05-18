/**
 * Canonical SHA-256 hash for event_candidates content-drift detection (J7d-A).
 *
 * Separate from `source_hash` (sourceHash.ts):
 *   - source_hash  identifies "this is the same source URL / capture key".
 *                  Used by the unique index to dedupe and by the crawler to
 *                  find the existing row.
 *   - content_hash identifies "this is the same actual event content".
 *                  Used by J7d-A to detect when the source mutated after
 *                  initial capture (e.g. JYP changes a tour date) so the
 *                  admin can re-review.
 *
 * The eight fields included here are the GPT-decided set of "decisive"
 * fields — what makes two captures the same event. Any other column
 * (ai_confidence, reviewer_note, created_at, etc.) is intentionally
 * excluded because it should not retrigger a recheck on its own.
 *
 * Uses Node's built-in node:crypto. No new dependency.
 */

import { createHash } from 'node:crypto'

export interface ContentHashInput {
  rawTitle: string | null | undefined
  rawContent: string | null | undefined
  detectedDate: string | null | undefined
  detectedEventType: string | null | undefined
  detectedIdolId: string | null | undefined
  sourceUrl: string | null | undefined
  sourceName: string | null | undefined
  sourceType: string | null | undefined
}

function normalizeText(s: string | null | undefined): string {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeUrl(s: string | null | undefined): string {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\/+$/, '')
}

/**
 * Always returns a hex string. Null/empty fields are normalised to '' so
 * a row that loses one field still produces a deterministic hash.
 */
export function computeContentHash(input: ContentHashInput): string {
  const parts = [
    'content_v1',
    normalizeText(input.rawTitle),
    normalizeText(input.rawContent),
    normalizeText(input.detectedDate),
    normalizeText(input.detectedEventType),
    normalizeText(input.detectedIdolId),
    normalizeUrl(input.sourceUrl),
    normalizeText(input.sourceName),
    normalizeText(input.sourceType),
  ]
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}
