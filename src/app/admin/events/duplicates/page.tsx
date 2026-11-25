export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Copy, Lock } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { groupPossibleDuplicates } from '@/lib/autoPublish/sameShow'
import { PUBLIC_TRUST_LEVELS } from '@/lib/trustLevels'
import { getTrustBadgeLabel } from '@/lib/eventDetailHero'
import { taipeiToday } from '@/lib/taipeiDate'

/**
 * T35 B-4：只讀「可能重複」清單——同藝人＋同日期＋同城市（城市不分語言）的已發布、未取消、
 * 今天以後的活動。只列出，不提供任何寫入；處理方式照舊（下架／封鎖其中一列）。
 */
interface Row {
  id: string
  idol_id: string
  idol_name: string
  title: string
  display_title_zh: string | null
  date: string
  start_date: string | null
  end_date: string | null
  city: string | null
  venue_name: string | null
  trust_level: string
  event_sources: Array<{ label: string | null; url: string | null }> | null
}

async function getGroups(): Promise<{ groups: Row[][]; error: string | null }> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return { groups: [], error: 'Supabase 環境變數未設定' }
  const { data, error } = await supabase
    .from('events')
    .select('id, idol_id, idol_name, title, display_title_zh, date, start_date, end_date, city, venue_name, trust_level, event_sources(label, url)')
    .eq('is_published', true)
    .in('trust_level', [...PUBLIC_TRUST_LEVELS])
    .neq('status', 'cancelled')
    .gte('date', taipeiToday())
    .order('date', { ascending: true })
  if (error) return { groups: [], error: `${error.code ? `[${error.code}] ` : ''}${error.message}` }
  return { groups: groupPossibleDuplicates((data ?? []) as Row[]), error: null }
}

export default async function AdminPossibleDuplicatesPage() {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return (
      <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
        <Link href="/admin/events" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base">
          <ArrowLeft className="h-3 w-3" />返回活動列表
        </Link>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-amber-300">需要管理員登入</p>
        </div>
      </div>
    )
  }
  const { groups, error } = await getGroups()
  return (
    <div className="flex flex-col pt-12 pb-6 px-4 gap-4">
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-base">
        <ArrowLeft className="h-3 w-3" />返回活動列表
      </Link>
      <div>
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5 text-violet-500" />
          <h1 className="text-xl font-bold text-text-base">可能重複的活動</h1>
        </div>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          只讀清單：同藝人＋同日期＋同城市（不分標題語言）的已發布活動。多藝人同台或同日雙場可能是正常情況，請人工判斷；本頁不會改任何資料。
        </p>
      </div>
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-3">
          <p className="text-xs font-semibold text-red-400 mb-1">載入失敗</p>
          <p className="text-xs text-red-400/80 break-all">{error}</p>
        </div>
      )}
      {!error && groups.length === 0 && (
        <div className="rounded-xl bg-card border border-card-border px-4 py-8 text-center">
          <p className="text-sm text-muted">目前沒有可能重複的活動</p>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.map((e) => e.id).join(',')} className="rounded-xl bg-card border border-card-border px-4 py-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted">{group[0].idol_name}・{group[0].start_date ?? group[0].date}・{group[0].city}</p>
          <ul className="flex flex-col gap-2">
            {group.map((e) => (
              <li key={e.id} className="rounded-lg border border-card-border px-3 py-2">
                <Link href={`/admin/events/${e.id}`} className="text-sm font-semibold text-text-base hover:underline break-words">
                  {e.display_title_zh || e.title}
                </Link>
                <p className="text-[11px] text-muted mt-0.5 break-words">
                  {getTrustBadgeLabel(e.trust_level) ?? e.trust_level}・{e.venue_name ?? '場館未填'}・來源：{(e.event_sources ?? []).map((s) => s.label).filter(Boolean).join('、') || '無'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
