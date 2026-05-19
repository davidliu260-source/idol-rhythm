import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { searchIdolImages, type ImageCandidate } from '@/lib/imageSearch/wikimedia'

export const dynamic = 'force-dynamic'

interface OkResponse {
  ok: true
  idolId: string
  query: { name: string; koreanName: string | null }
  candidates: ImageCandidate[]
  diagnostics: {
    queriedEn: number
    queriedKo: number
    rawHits: number
    afterDedupe: number
  }
}

interface ErrResponse {
  ok: false
  error: string
}

type Response = OkResponse | ErrResponse

/**
 * GET /api/admin/idols/[id]/ai-search-image
 *
 * Admin-only. Looks up the idol's name + korean_name from the DB and runs
 * Wikimedia image search. Returns up to 10 candidates for the AI search
 * modal to render. Does NOT touch Storage or idols.avatar_url — that's the
 * follow-up uploadIdolAvatarFromUrl server action.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<Response>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: '需要管理員身份才能使用 AI 搜圖。' },
      { status: 401 },
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase 未設定，請檢查環境變數。' },
      { status: 500 },
    )
  }

  const idolId = params.id
  const { data: idol, error } = await supabase
    .from('idols')
    .select('id, name, korean_name')
    .eq('id', idolId)
    .single<{ id: string; name: string; korean_name: string | null }>()

  if (error || !idol) {
    return NextResponse.json(
      { ok: false, error: `找不到偶像（id=${idolId}）：${error?.message ?? 'unknown'}` },
      { status: 404 },
    )
  }

  try {
    const result = await searchIdolImages(idol.name, idol.korean_name)
    return NextResponse.json({
      ok: true,
      idolId: idol.id,
      query: { name: idol.name, koreanName: idol.korean_name },
      candidates: result.candidates,
      diagnostics: result.diagnostics,
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `搜尋失敗：${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 502 },
    )
  }
}
