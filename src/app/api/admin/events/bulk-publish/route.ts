import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { inferTrustLevelFromSource } from '@/lib/admin/sourceReview'

type BulkAction = 'publish_auto' | 'unpublish' | 'delete_drafts'

interface BulkPublishRequest {
  ids: string[]
  action: BulkAction
}

interface BulkPublishResponse {
  ok: boolean
  action: BulkAction
  total: number
  affected: number
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<BulkPublishResponse | { ok: false; error: string }>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: '未授權：需要管理員身份' }, { status: 401 })
  }

  let body: BulkPublishRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '無效的請求格式' }, { status: 400 })
  }

  const { ids, action } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'ids 不可為空' }, { status: 400 })
  }
  if (!['publish_auto', 'unpublish', 'delete_drafts'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'action 不合法' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase 環境變數未設定' }, { status: 500 })
  }

  // ── delete_drafts: hard-delete unpublished events (RLS enforces is_published=false) ──
  if (action === 'delete_drafts') {
    const { data, error } = await supabase
      .from('events')
      .delete()
      .in('id', ids)
      .eq('is_published', false)
      .select('id')

    if (error) {
      return NextResponse.json(
        { ok: false, error: `刪除失敗：${error.code ? `[${error.code}] ` : ''}${error.message}` },
        { status: 500 },
      )
    }

    const affected = data?.length ?? 0
    revalidatePath('/admin/events')
    for (const id of ids) revalidatePath(`/admin/events/${id}`)

    return NextResponse.json({ ok: true, action, total: ids.length, affected })
  }

  if (action === 'publish_auto') {
    const { data: rows, error: fetchError } = await supabase
      .from('events')
      .select('id, event_sources(label, type, url)')
      .in('id', ids)
      .eq('is_published', false)

    if (fetchError) {
      return NextResponse.json(
        { ok: false, error: `讀取來源失敗：${fetchError.code ? `[${fetchError.code}] ` : ''}${fetchError.message}` },
        { status: 500 },
      )
    }

    let affected = 0
    const now = new Date().toISOString()

    for (const row of rows ?? []) {
      const source = Array.isArray(row.event_sources) ? row.event_sources[0] : null
      const trustLevel = inferTrustLevelFromSource({
        sourceName: source?.label ?? null,
        sourceType: source?.type ?? null,
        sourceUrl: source?.url ?? null,
      })

      if (trustLevel === 'pending') continue

      const { data, error } = await supabase
        .from('events')
        .update({
          is_published: true,
          published_at: now,
          trust_level: trustLevel,
        })
        .eq('id', row.id)
        .eq('is_published', false)
        .select('id')

      if (error) {
        return NextResponse.json(
          { ok: false, error: `批量發布失敗：${error.code ? `[${error.code}] ` : ''}${error.message}` },
          { status: 500 },
        )
      }

      affected += data?.length ?? 0
    }

    revalidatePath('/admin/events')
    revalidatePath('/')
    revalidatePath('/schedule')
    for (const id of ids) {
      revalidatePath(`/admin/events/${id}`)
      revalidatePath(`/events/${id}`)
    }

    return NextResponse.json({ ok: true, action, total: ids.length, affected })
  }

  // ── Build update payload + safety filter ────────────────────────────────────
  // unpublish: only operate on published rows.

  let query = supabase.from('events').update({ is_published: false, published_at: null })

  query = query.in('id', ids)
  query = query.eq('is_published', true)

  const { data, error } = await query.select('id')

  if (error) {
    return NextResponse.json(
      { ok: false, error: `批量操作失敗：${error.code ? `[${error.code}] ` : ''}${error.message}` },
      { status: 500 },
    )
  }

  const affected = data?.length ?? 0

  // Revalidate admin + public-facing pages
  revalidatePath('/admin/events')
  revalidatePath('/')
  revalidatePath('/schedule')
  for (const id of ids) {
    revalidatePath(`/admin/events/${id}`)
    revalidatePath(`/events/${id}`)
  }

  return NextResponse.json({
    ok: true,
    action,
    total: ids.length,
    affected,
  })
}
