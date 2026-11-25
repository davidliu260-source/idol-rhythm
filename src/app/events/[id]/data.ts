import { cache } from 'react'
import { getEventById as getMockEventById } from '@/lib/mockEvents'
import { getEventById, getEventTicketSales } from '@/lib/supabase/events'

export const getPublicEvent = cache(getEventById)

export const getEventDetail = cache(async (id: string) => {
  const publishedEvent = await getPublicEvent(id)
  const event = publishedEvent ?? getMockEventById(id)
  return event ? { event, isDemoEvent: !publishedEvent } : null
})

/** T35：詳情頁售票階段。Demo 活動沒有 DB 列，直接回空陣列。 */
export const getEventTicketSalesForDetail = cache(async (id: string, isDemoEvent: boolean) =>
  isDemoEvent ? [] : getEventTicketSales(id))
