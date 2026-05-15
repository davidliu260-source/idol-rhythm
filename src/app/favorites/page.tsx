export const dynamic = 'force-dynamic'

import { getVisibleEvents, type Event } from '@/lib/mockEvents'
import { getPublishedEvents } from '@/lib/supabase/events'
import FavoritesClient from './FavoritesClient'

export default async function FavoritesPage() {
  const supabaseEvents = await getPublishedEvents()
  const events: Event[] = supabaseEvents.length > 0 ? supabaseEvents : getVisibleEvents()

  return <FavoritesClient events={events} />
}
