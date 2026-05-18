export const dynamic = 'force-dynamic'

import { getActiveIdols, getPublishedEvents } from '@/lib/supabase/events'
import MeClient from './MeClient'

export default async function MePage() {
  const [idols, events] = await Promise.all([
    getActiveIdols(),
    getPublishedEvents(),
  ])

  return <MeClient idols={idols} events={events} />
}
