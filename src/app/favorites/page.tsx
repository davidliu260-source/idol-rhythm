export const dynamic = 'force-dynamic'

import { getPublishedEvents } from '@/lib/supabase/events'
import FavoritesClient from './FavoritesClient'

export default async function FavoritesPage() {
  const events = await getPublishedEvents()
  return <FavoritesClient events={events} />
}
