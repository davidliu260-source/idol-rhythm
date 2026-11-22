import { cache } from 'react'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'
import { listCurrentEvents } from '@/lib/upcomingEvents'

export const getIdolDetail = cache(async (slug: string, throwOnError = false) => {
  const idol = await getIdolBySlug(slug)
  if (!idol) return null

  const events = await getPublishedEvents({ throwOnError })
  const idolEvents = events.filter(event => event.idolId === idol.id)
  const upcoming = listCurrentEvents(idolEvents)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return { idol, upcoming }
})
