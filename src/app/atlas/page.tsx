export const dynamic = 'force-dynamic'

import { getPublishedEvents } from '@/lib/supabase/events'
import AtlasClient from './AtlasClient'

export default async function AtlasPage() {
  const events = await getPublishedEvents({ lookbackDays: null })
  return <AtlasClient events={events} />
}
