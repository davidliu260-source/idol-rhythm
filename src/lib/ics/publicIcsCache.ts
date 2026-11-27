/**
 * Public idol ICS cache policy (Must #12).
 *
 * Setting only Cache-Control: s-maxage on a force-dynamic Route Handler was
 * not enough: Next.js treated the route as uncacheable, and when
 * Cache-Control is the only cache header Vercel also strips s-maxage from
 * the client response. CDN-Cache-Control / Vercel-CDN-Cache-Control are
 * what the Vercel CDN actually honours. The route may still be dynamic at
 * build time (it reads Supabase); the CDN headers are what apply the 1-hour
 * cache. Do not set force-static — that would also cache 404s.
 */
export const PUBLIC_ICS_REVALIDATE_SECONDS = 3600
export const PUBLIC_ICS_STALE_WHILE_REVALIDATE_SECONDS = 86400

export const PUBLIC_ICS_CACHE_CONTROL =
  `public, s-maxage=${PUBLIC_ICS_REVALIDATE_SECONDS}, stale-while-revalidate=${PUBLIC_ICS_STALE_WHILE_REVALIDATE_SECONDS}`

export const PUBLIC_ICS_CACHE_HEADERS = {
  'Cache-Control': PUBLIC_ICS_CACHE_CONTROL,
  'CDN-Cache-Control': PUBLIC_ICS_CACHE_CONTROL,
  'Vercel-CDN-Cache-Control': PUBLIC_ICS_CACHE_CONTROL,
} as const

/** 404 and 5xx: do not let an empty or failed feed sit on the CDN for an hour. */
export const PUBLIC_ICS_UNCACHEABLE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
} as const

export const PUBLIC_ICS_NOT_FOUND_HEADERS = PUBLIC_ICS_UNCACHEABLE_HEADERS

export function publicIdolIcsHeaders(slug: string): Record<string, string> {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${slug}.ics"`,
    ...PUBLIC_ICS_CACHE_HEADERS,
  }
}
