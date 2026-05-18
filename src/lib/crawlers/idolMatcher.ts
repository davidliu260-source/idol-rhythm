/**
 * Idol name matcher for aggregator-style crawlers (M1a-B).
 *
 * Aggregator sources like kpopofficial.com list events for many artists on
 * one page. The fetcher loads every active idol once, builds an index of
 * normalized name + alt_names, then maps each crawled event title to an
 * idol id (or null = skip).
 *
 * Hard rules (per the M1a ruling):
 *   - Exact match only after normalization. No fuzzy match, no Levenshtein,
 *     no substring search.
 *   - Try title prefixes from longest to shortest so multi-word names
 *     ("Stray Kids") win over a coincidental shorter match.
 *   - Skip when no prefix matches. Never store an unmatched event.
 *
 * Normalization rules:
 *   - lowercase
 *   - en-dash (U+2013) and em-dash (U+2014) are treated as separators (→ space)
 *   - hyphen-minus (`-`) is preserved (it can be part of names like "i-dle",
 *     "G-Dragon")
 *   - all other punctuation and symbols are stripped (typographic quotes,
 *     commas, parentheses, exclamation marks, etc.)
 *   - whitespace collapsed to single spaces, leading/trailing trimmed
 *
 * This module is parser-agnostic. Any future aggregator (Songkick,
 * kpoptracker, …) can reuse the same matcher.
 */

export interface IdolForMatching {
  id: string
  name: string
  alt_names: string[]
}

/**
 * Normalize a name fragment to a canonical comparison key.
 *
 * Examples:
 *   "Stray Kids"           → "stray kids"
 *   "STRAY  KIDS  "        → "stray kids"
 *   "i-dle"                → "i-dle"
 *   "G-Dragon"             → "g-dragon"
 *   '"SHOW WHAT I AM"'     → "show what i am"
 *   "BLACKPINK – Goyang"   → "blackpink   goyang"  (caller splits further)
 */
// Build via constructor so the Unicode `u` flag and \p{...} property escapes
// don't fail TypeScript's literal-regex ES-version check (project tsconfig
// leaves `target` at its default, which predates ES2018 regex features).
// Runtime is modern Node / Vercel Edge, both of which support `u` natively.
const NON_NAME_CHAR_RE = new RegExp('[^\\p{L}\\p{N}\\s-]', 'gu')

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .replace(NON_NAME_CHAR_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Index built once per crawler run. Maps each normalized name / alias
 * back to its idol row. When a name and an alias collide across two
 * different idols, the FIRST insert wins — collisions are extremely
 * unlikely in practice and require admin attention; we surface them
 * via a console.warn so the next run logs make it obvious.
 */
export interface IdolMatchIndex {
  byNormalized: Map<string, IdolForMatching>
  /**
   * Maximum word count across all known idol names / aliases. The matcher
   * uses this as the upper bound for prefix iteration so long event titles
   * don't trigger N-word comparisons unnecessarily.
   */
  maxWords: number
}

export function buildIdolMatchIndex(idols: IdolForMatching[]): IdolMatchIndex {
  const byNormalized = new Map<string, IdolForMatching>()
  let maxWords = 1

  const tryAdd = (raw: string, idol: IdolForMatching) => {
    const key = normalizeName(raw)
    if (key.length === 0) return
    const existing = byNormalized.get(key)
    if (existing && existing.id !== idol.id) {
      // eslint-disable-next-line no-console
      console.warn(
        `idolMatcher: alias "${key}" collision between idol ${existing.id} (${existing.name}) and ${idol.id} (${idol.name}); keeping first.`,
      )
      return
    }
    byNormalized.set(key, idol)
    const w = key.split(' ').length
    if (w > maxWords) maxWords = w
  }

  for (const idol of idols) {
    tryAdd(idol.name, idol)
    for (const alt of idol.alt_names ?? []) {
      tryAdd(alt, idol)
    }
  }

  return { byNormalized, maxWords }
}

export interface IdolMatchResult {
  idol: IdolForMatching
  /** Normalized title prefix that produced the match. */
  matchedKey: string
  /** Whether the matched key came from idol.name (true) or an alias (false). */
  viaPrimaryName: boolean
}

/**
 * Try to match an event title to an idol by attempting normalized prefixes
 * of the title from longest (capped at index.maxWords) down to one word.
 *
 * Returns null when no prefix matches an indexed name/alias.
 */
export function matchIdolFromTitle(
  title: string,
  index: IdolMatchIndex,
): IdolMatchResult | null {
  const normalized = normalizeName(title)
  if (normalized.length === 0) return null

  const tokens = normalized.split(' ')
  const upper = Math.min(tokens.length, index.maxWords)

  for (let n = upper; n >= 1; n--) {
    const prefix = tokens.slice(0, n).join(' ')
    const hit = index.byNormalized.get(prefix)
    if (hit) {
      return {
        idol: hit,
        matchedKey: prefix,
        viaPrimaryName: normalizeName(hit.name) === prefix,
      }
    }
  }
  return null
}
