import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'

interface CleanupResponse {
  ok: boolean
  affected: number
}

/**
 * Marks expired pending candidates as rejected with a sentinel note.
 *
 *   review_status='pending' AND detected_date < today AND detected_date IS NOT NULL
 *
 * Behaviour notes:
 *   - No DELETE. Rows stay for audit; reviewer_note='auto-expired' is the marker.
 *   - Candidates with detected_date=NULL are NOT touched — they could still be
 *     forward-dated events with missing date metadata.
 *   - Idempotent: re-running after all expired rows are already rejected
 *     returns affected=0.
 */
export async function POST(
  _request: NextRequest,
): Promise<NextResponse<CleanupResponse | { ok: false; error: string }>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: '未授權：需要管理員身份' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase 環境變數未設定' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('event_candidates')
    .update({
      review_status: 'rejected',
      reviewer_note: 'auto-expired',
    })
    .eq('review_status', 'pending')
    .lt('detected_date', today)
    .not('detected_date', 'is', null)
    .select('id')

  if (error) {
    return NextResponse.json(
      { ok: false, error: `清理失敗：${error.code ? `[${error.code}] ` : ''}${error.message}` },
      { status: 500 },
    )
  }

  revalidatePath('/admin/event-candidates')

  return NextResponse.json({ ok: true, affected: data?.length ?? 0 })
}
