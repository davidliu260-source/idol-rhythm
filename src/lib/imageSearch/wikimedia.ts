/**
 * Wikimedia / Wikipedia image search client (I1b-B 第一版).
 *
 * Why Wikimedia first
 * ───────────────────
 * - No API key, no rate-limit signup, works today.
 * - K-pop majors all have Wikipedia pages with infobox / lead images
 *   (Commons-hosted, usually CC-licensed).
 * - License attribution is queryable via Commons API → admin can verify.
 *
 * Strategy
 * ────────
 * 1. Search Wikipedia for the artist name (English first, Korean fallback).
 *    Use the "generator=search" + "prop=pageimages|images" combo so we get
 *    each page's lead image + thumbnail in a single round-trip.
 * 2. For pages with explicit Commons images, also fetch the top few inline
 *    images on that page (often promo / live shots).
 * 3. Dedupe by underlying file URL, return up to N candidates.
 *
 * What this DOES NOT do
 * ─────────────────────
 * - No fuzzy disambiguation. "IVE" might return both the K-pop group and
 *   unrelated entries — admin must visually pick the right one.
 * - No automatic best-match. Always returns a list; selection is manual.
 * - No license parsing yet (Commons API has it but we just surface the
 *   source URL and let admin verify via the "請確認版權" warning).
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WIKI_KO_API = 'https://ko.wikipedia.org/w/api.php'
const USER_AGENT = 'IdolRhythm-Admin-Bot/0.1 (+https://idol-rhythm.vercel.app)'
const FETCH_TIMEOUT_MS = 8_000
const MAX_CANDIDATES = 10

export interface ImageCandidate {
  /** Full-resolution image URL (used for download → resize → upload). */
  imageUrl: string
  /** Smaller thumbnail for grid display in the modal (faster preview). */
  thumbnailUrl: string
  /** Wikipedia / Commons page URL — admin clicks to verify context + license. */
  sourceUrl: string
  /** Human-readable page title (the article the image was found on). */
  title: string
  /** Original width × height if Wikimedia returned it; null if unknown. */
  width: number | null
  height: number | null
  /** Provider tag for future multi-source support ('wikimedia' for now). */
  provider: 'wikimedia'
}

export interface SearchResult {
  candidates: ImageCandidate[]
  /** Optional human-readable diagnostic for the modal (counts per stage). */
  diagnostics: {
    queriedEn: number
    queriedKo: number
    rawHits: number
    afterDedupe: number
  }
}

interface WikiPage {
  pageid: number
  title: string
  fullurl?: string
  canonicalurl?: string
  thumbnail?: { source: string; width: number; height: number }
  original?: { source: string; width: number; height: number }
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiPage>
  }
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run a Wikipedia search → for each result, ask for its lead image (original
 * + thumbnail). Returns up to `limit` pages with images.
 */
async function searchPagesWithLeadImage(
  apiBase: string,
  query: string,
  limit: number,
): Promise<ImageCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: '320',
    inprop: 'url',
  })
  const url = `${apiBase}?${params.toString()}`

  let raw: unknown
  try {
    raw = await fetchJsonWithTimeout(url)
  } catch {
    return []
  }

  const pages = (raw as WikiQueryResponse).query?.pages
  if (!pages) return []

  const out: ImageCandidate[] = []
  for (const p of Object.values(pages)) {
    if (!p.original?.source || !p.thumbnail?.source) continue
    out.push({
      imageUrl: p.original.source,
      thumbnailUrl: p.thumbnail.source,
      sourceUrl: p.fullurl ?? p.canonicalurl ?? '',
      title: p.title,
      width: p.original.width ?? null,
      height: p.original.height ?? null,
      provider: 'wikimedia',
    })
  }
  return out
}

/**
 * Public entry — search Wikimedia for images of `name` (with `koreanName`
 * fallback) and return up to MAX_CANDIDATES deduped candidates.
 *
 * Errors are swallowed and surface as empty `candidates` array; callers should
 * branch on `candidates.length === 0` to render the "找不到合適圖片" message.
 */
export async function searchIdolImages(
  name: string,
  koreanName: string | null,
): Promise<SearchResult> {
  // Run both queries in parallel — combined search-space is small and
  // latency-dominated by the slower of the two.
  const trimmedName = name.trim()
  const trimmedKo = (koreanName ?? '').trim()

  const [enHits, koHits] = await Promise.all([
    trimmedName ? searchPagesWithLeadImage(WIKI_API, trimmedName, 8) : Promise.resolve([]),
    trimmedKo ? searchPagesWithLeadImage(WIKI_KO_API, trimmedKo, 6) : Promise.resolve([]),
  ])

  // Dedupe by imageUrl — same Commons file commonly shared across en/ko.
  const seen = new Set<string>()
  const merged: ImageCandidate[] = []
  for (const c of [...enHits, ...koHits]) {
    if (seen.has(c.imageUrl)) continue
    seen.add(c.imageUrl)
    merged.push(c)
    if (merged.length >= MAX_CANDIDATES) break
  }

  return {
    candidates: merged,
    diagnostics: {
      queriedEn: enHits.length,
      queriedKo: koHits.length,
      rawHits: enHits.length + koHits.length,
      afterDedupe: merged.length,
    },
  }
}
