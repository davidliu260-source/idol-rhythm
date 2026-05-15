export const dynamic = 'force-dynamic'

import { MOCK_IDOLS } from '@/lib/mockIdols'
import { getActiveIdols } from '@/lib/supabase/events'
import IdolsClient from './IdolsClient'

export default async function IdolsPage() {
  const supabaseIdols = await getActiveIdols()
  const idols = supabaseIdols.length > 0 ? supabaseIdols : MOCK_IDOLS

  return <IdolsClient idols={idols} />
}
