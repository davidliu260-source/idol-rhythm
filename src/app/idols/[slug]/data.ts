import { cache } from 'react'
import { getIdolBySlug, getPublishedEvents } from '@/lib/supabase/events'
import { listCurrentEvents } from '@/lib/upcomingEvents'

type IdolDetailOptions = boolean | { throwOnError?: boolean; throwOnQueryError?: boolean }

function resolveIdolDetailOptions(options: IdolDetailOptions = false) {
  if (typeof options === 'boolean') return { throwOnError: options, throwOnQueryError: false }
  return {
    throwOnError: Boolean(options.throwOnError),
    throwOnQueryError: Boolean(options.throwOnQueryError),
  }
}

export const getIdolDetail = cache(async (slug: string, options: IdolDetailOptions = false) => {
  const { throwOnError, throwOnQueryError } = resolveIdolDetailOptions(options)
  const idol = await getIdolBySlug(slug, { throwOnError, throwOnQueryError })
  if (!idol) return null

  const events = await getPublishedEvents({ throwOnError, throwOnQueryError })
  const idolEvents = events.filter(event => event.idolId === idol.id)
  const upcoming = listCurrentEvents(idolEvents)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return { idol, upcoming }
})
