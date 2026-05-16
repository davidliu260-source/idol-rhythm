import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import {
  parseCandidateWithClaude,
  type ParsedCandidate,
  type KnownIdol,
} from '@/lib/ai/parseCandidate'

export const dynamic = 'force-dynamic'

interface OkResponse {
  ok: true
  parsed: ParsedCandidate
  /** Names returned for UI display only — never used as DB keys. */
  idol_name: string | null
}

interface ErrResponse {
  ok: false
  error: string
}

/**
 * POST /api/admin/ai/parse-candidate
 *
 * Body: { rawText: string }
 *
 * Admin-only. Calls Claude to extract structured fields from a free-text
 * announcement and returns the (server-validated) result. Does NOT write
 * to the database — that happens via the separate commit server action.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<OkResponse | ErrResponse>> {
  // ── Admin guard ──────────────────────────────────────────────────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: '未授權：需要管理員身份' },
      { status: 401 },
    )
  }

  // ── Body parsing ─────────────────────────────────────────────────────────
  let body: { rawText?: unknown }
  try {
    body = (await request.json()) as { rawText?: unknown }
  } catch {
    return NextResponse.json(
      { ok: false, error: '請求格式錯誤（無法解析 JSON）' },
      { status: 400 },
    )
  }

  if (typeof body.rawText !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'rawText 必須是字串' },
      { status: 400 },
    )
  }
  const rawText = body.rawText

  // ── Fetch known idols (slug + name + id) ─────────────────────────────────
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase 未設定' },
      { status: 500 },
    )
  }

  const { data: idolRows, error: idolError } = await supabase
    .from('idols')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('name')

  if (idolError) {
    return NextResponse.json(
      {
        ok: false,
        error: `偶像清單查詢失敗：${idolError.code ? `[${idolError.code}] ` : ''}${idolError.message}`,
      },
      { status: 500 },
    )
  }

  const knownIdols: KnownIdol[] = (idolRows ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
  }))

  // ── Call Claude ──────────────────────────────────────────────────────────
  let parsed: ParsedCandidate
  try {
    parsed = await parseCandidateWithClaude({ rawText, knownIdols })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const idolName =
    parsed.detected_idol_slug != null
      ? (knownIdols.find((i) => i.slug === parsed.detected_idol_slug)?.name ?? null)
      : null

  return NextResponse.json({ ok: true, parsed, idol_name: idolName })
}
