export const dynamic = 'force-dynamic'

import { MOCK_IDOLS } from '@/lib/mockIdols'
import { getVisibleEvents, type Event } from '@/lib/mockEvents'
import { getActiveIdols } from '@/lib/supabase/events'
import { getPublishedEvents } from '@/lib/supabase/events'
import MeClient from './MeClient'

export default async function MePage() {
  const [supabaseIdols, supabaseEvents] = await Promise.all([
    getActiveIdols(),
    getPublishedEvents(),
  ])

  const idols = supabaseIdols.length > 0 ? supabaseIdols : MOCK_IDOLS
  const events: Event[] = supabaseEvents.length > 0 ? supabaseEvents : getVisibleEvents()

  return <MeClient idols={idols} events={events} />
}
