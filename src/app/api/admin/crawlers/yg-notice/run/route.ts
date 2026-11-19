import { NextResponse } from 'next/server'
import { runYgNoticeFetcher } from '@/lib/crawlers/runYgNoticeFetcher'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json({ ok: false, errors: ['未授權：需要管理員身份'] }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const sourceKey = typeof body?.sourceKey === 'string' ? body.sourceKey.trim() : ''
  if (!sourceKey || (body.dryRun !== undefined && typeof body.dryRun !== 'boolean')) {
    return NextResponse.json({ ok: false, errors: ['請提供 sourceKey，dryRun 須為布林值'] }, { status: 400 })
  }

  try {
    const { touched, status, ...result } = await runYgNoticeFetcher(getSupabaseServiceClient(), {
      sourceKey,
      dryRun: body.dryRun,
    })
    return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status })
  } catch (error) {
    console.error('yg-notice run failed:', error)
    return NextResponse.json({ ok: false, errors: ['YG 公告執行失敗'] }, { status: 500 })
  }
}
