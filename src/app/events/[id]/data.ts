import { cache } from 'react'
import { getEventById as getMockEventById } from '@/lib/mockEvents'
import { getEventById } from '@/lib/supabase/events'

export const getPublicEvent = cache(getEventById)

export const getEventDetail = cache(async (id: string) => {
  const publishedEvent = await getPublicEvent(id)
  const event = publishedEvent ?? getMockEventById(id)
  return event ? { event, isDemoEvent: !publishedEvent } : null
})
