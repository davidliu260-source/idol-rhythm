import type { MetadataRoute } from 'next'
import { buildSitemapEntries } from '@/lib/seo/sitemap'
import { getActiveIdols, getPublishedEvents } from '@/lib/supabase/events'

// Query on request so builds can run without Supabase and P5 uses the current date.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  try {
    const [idols, events] = await Promise.all([
      getActiveIdols({ throwOnError: true }),
      getPublishedEvents({ throwOnError: true }),
    ])
    return buildSitemapEntries({ idols, events, now })
  } catch {
    return buildSitemapEntries({ idols: [], events: [], now })
  }
}
