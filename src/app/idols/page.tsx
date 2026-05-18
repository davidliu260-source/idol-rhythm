export const dynamic = 'force-dynamic'

import { getActiveIdols } from '@/lib/supabase/events'
import IdolsClient from './IdolsClient'

export default async function IdolsPage() {
  const idols = await getActiveIdols()
  return <IdolsClient idols={idols} />
}
