import type { SupabaseClient } from '@supabase/supabase-js'
import { taipeiToday } from '../taipeiDate'
import { getCrawlerSourceByKey, updateRunStatus, type RunStatus } from './crawlerSource'
import { buildIdolMatchIndex, type IdolForMatching } from './idolMatcher'
import { touchedFromPayload, type TouchedCandidate } from './touchedCandidate'
import {
  isYgConcertNotice, matchYgNotice, parseYgNoticeDetail, parseYgNoticeList,
  YG_NOTICE_ROSTER, YG_NOTICE_URL, ygNoticeCandidates,
} from './ygNotice'

type RosterIdol = IdolForMatching & { slug: string }
type Candidate = ReturnType<typeof ygNoticeCandidates>[number]
type NoticeSource = Parameters<typeof ygNoticeCandidates>[3]

let requestQueue: Promise<unknown> = Promise.resolve()

function fetchHtml(url: string) {
  const request = requestQueue.then(async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'IdolRhythm/0.1', Accept: 'text/html' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}：${url}`)
    return response.text()
  })
  const delay = () => new Promise((resolve) => setTimeout(resolve, 320))
  requestQueue = request.then(delay, delay)
  return request
}

export async function crawlYgNotices(
  source: NoticeSource, idols: RosterIdol[], today: string, maxPages: number,
  getHtml = fetchHtml,
) {
  const result = {
    pages: 0, fetched: 0, matched: 0, skipped_past: 0, skipped_unmatched: 0,
    skipped_no_date: 0, skipped_category: 0, errors: [] as string[],
    listFailed: false, candidates: [] as Candidate[],
    matchedGDragon: [] as { title: string; noticeId: string }[],
  }
  const index = buildIdolMatchIndex(idols)
  const seen = new Set<string>()
  let page: number | null = 1
  for (let count = 0; page !== null && count < maxPages; count++) {
    const url = `${YG_NOTICE_URL}?page=${page}`
    let list: ReturnType<typeof parseYgNoticeList>
    try {
      list = parseYgNoticeList(await getHtml(url))
      if (list.currentPage !== page) throw new Error(`YG 公告分頁錯誤：${url}`)
    } catch (error) {
      result.errors.push(String(error))
      result.listFailed = true
      break
    }
    result.pages++
    for (const entry of list.entries) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      result.fetched++
      const match = matchYgNotice(entry.title, index)
      if (!match) {
        result.skipped_unmatched++
        continue
      }
      result.matched++
      if (idols.find(({ id }) => id === match.idol.id)?.slug === 'g-dragon') {
        result.matchedGDragon.push({ title: entry.title, noticeId: entry.id })
      }
      if (!isYgConcertNotice(entry.title)) {
        result.skipped_category++
        continue
      }
      try {
        const detail = parseYgNoticeDetail(await getHtml(`${YG_NOTICE_URL}/${entry.id}`), entry)
        if (!detail.performances.length) result.skipped_no_date++
        for (const candidate of ygNoticeCandidates(detail, entry, match.idol.id, source)) {
          if (candidate.detected_date < today) result.skipped_past++
          else result.candidates.push(candidate)
        }
      } catch (error) {
        result.errors.push(`${entry.id}：${String(error)}`)
      }
    }
    page = list.nextPage && list.nextPage > page ? list.nextPage : null
  }
  return result
}

const venueAliases = [
  ['Kaohsiung National Stadium', 'National Stadium Kaohsiung', '高雄國家體育場', '高雄國家體育場（世運主場館）', '世運主場館', '高雄世運主場館', '世運大道100號', '高雄市左營區世運大道100號'],
  ['Taipei Dome', '台北大巨蛋', '臺北大巨蛋', '大巨蛋'],
  ['Kai Tak Stadium', '啟德主場館', '啟德體育園主場館'],
  ['SoFi Stadium', 'SoFi體育場', 'SoFi體育館'],
]
const locationKey = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(new RegExp('[^\\p{L}\\p{N}]', 'gu'), '')
const aliasKeys = venueAliases.map((aliases) => aliases.map(locationKey))

export function isSameYgEventLocation(
  candidate: Candidate,
  event: {
    city: string | null; venue_name: string | null; address: string | null
    location_name_zh: string | null; location: string | null
  },
) {
  const key = (value: string) => {
    const normalized = locationKey(value)
    return aliasKeys.find((aliases) => aliases.includes(normalized))?.[0] ?? normalized
  }
  const venue = candidate.detected_venue_name
  const city = candidate.detected_city
  const locationKeys = [venue, candidate.detected_address, city && venue && `${city}${venue}`,
    city && venue && `${venue}${city}`].flatMap((value) => value ? [key(value)] : []).filter(Boolean)
  return [event.venue_name, event.address, event.location_name_zh, event.location,
    event.city && event.venue_name && `${event.city}${event.venue_name}`]
    .some((value) => value && locationKeys.includes(key(value)))
}

export function ygNoticePreviewItem(candidate: Candidate) {
  return {
    title: candidate.raw_title, date: candidate.detected_date, city: candidate.detected_city,
    venue: candidate.detected_venue_name, noticeId: candidate.raw_data.notice_id,
  }
}

export async function runYgNoticeFetcher(
  supabase: SupabaseClient,
  { sourceKey, dryRun: requestedDryRun, sourceId }: { sourceKey: string; dryRun?: boolean; sourceId?: string },
) {
  const dryRun = requestedDryRun !== false
  const result = {
    source: 'yg-notice', sourceKey, sourceName: null as string | null,
    mode: dryRun ? 'dry-run' as const : 'insert' as const,
    pages: 0, fetched: 0, matched: 0, skipped_past: 0, skipped_unmatched: 0,
    skipped_no_date: 0, skipped_category: 0, skipped_existing_event: 0,
    wouldInsert: 0, wouldInsertList: [] as ReturnType<typeof ygNoticePreviewItem>[],
    inserted: 0, skipped: 0, recheck: 0, errors: [] as string[],
    touched: [] as TouchedCandidate[], status: 200,
  }
  let statusSourceId = sourceId
  async function finish(status: RunStatus) {
    if (statusSourceId) {
      const statusError = await updateRunStatus(supabase, statusSourceId, {
        last_status: status, last_error: result.errors.join('\n') || null,
      })
      if (statusError) result.errors.push(statusError)
    }
    result.skipped += result.skipped_past + result.skipped_unmatched +
      result.skipped_category + result.skipped_no_date + result.skipped_existing_event
    return result
  }

  try {
    const { source, error, configType } = await getCrawlerSourceByKey(supabase, sourceKey)
    if (!source) {
      result.errors.push(error ?? '找不到 crawler_sources')
      result.status = 500
      return finish('error')
    }
    statusSourceId = source.id
    result.sourceName = source.name
    const { config } = source
    const { locale, maxPages, memberSlugs } = config
    if (source.parser_type !== 'yg_notice' || source.source_type !== 'official_website' ||
        ![YG_NOTICE_URL, YG_NOTICE_URL.replace('://', '://www.')].includes(source.source_url) ||
        locale !== 'ko' || typeof maxPages !== 'number' ||
        !Number.isInteger(maxPages) || maxPages < 5 || maxPages > 10 ||
        !Array.isArray(memberSlugs) || !memberSlugs.every((slug) => typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug))) {
      result.status = 400
      result.errors.push(
        `來源設定不符合 YG 官方公告（parser_type=${source.parser_type}, source_url=${source.source_url}, source_type=${source.source_type}, config 型別=${configType}, locale=${JSON.stringify(locale)}, maxPages=${JSON.stringify(maxPages)}, memberSlugs=${JSON.stringify(memberSlugs)}）`,
      )
      return finish('error')
    }
    if (!source.is_active) {
      result.errors.push(`來源已停用：${source.name}`)
      return finish('skipped')
    }

    const { data: idols, error: idolError } = await supabase.from('idols')
      .select('id, slug, name, alt_names').in('slug', [...YG_NOTICE_ROSTER, ...memberSlugs]).order('id')
    if (idolError || !idols?.some((idol) => idol.slug === 'bigbang' && idol.id === source.idol_id)) {
      result.status = 500
      result.errors.push(idolError ? `讀取 idols 失敗：${idolError.message}` : '來源 idol_id 未連結 BIGBANG')
      return finish('error')
    }
    const { candidates, listFailed, matchedGDragon, ...counts } = await crawlYgNotices(
      source, idols, taipeiToday(), maxPages,
    )
    Object.assign(result, counts)
    if (listFailed && !result.pages) {
      result.status = 502
      return finish('error')
    }

    for (const payload of candidates) {
      try {
        const [byHash, byUrl] = await Promise.all([
          supabase.from('event_candidates').select('id, content_hash, reviewer_note')
            .eq('source_hash', payload.source_hash).limit(1).maybeSingle(),
          supabase.from('event_candidates').select('id, content_hash, reviewer_note')
            .eq('source_url', payload.source_url).order('created_at').order('id').limit(1).maybeSingle(),
        ])
        if (byHash.error || byUrl.error) throw new Error((byHash.error ?? byUrl.error)!.message)
        const existing = byHash.data ?? byUrl.data
        if (!existing) {
          const { data: events, error } = await supabase.from('events')
            .select('city, venue_name, address, location_name_zh, location')
            .eq('idol_id', payload.detected_idol_id).eq('date', payload.detected_date)
          if (error) throw new Error(error.message)
          if (events?.some((event) => isSameYgEventLocation(payload, event))) {
            result.skipped_existing_event++
            continue
          }

          if (!dryRun) {
            const { data, error: insertError } = await supabase.from('event_candidates')
              .insert(payload).select('id').single()
            if (insertError?.code === '23505') {
              result.skipped++
              continue
            }
            if (insertError) throw new Error(insertError.message)
            result.inserted++
            result.touched.push(touchedFromPayload(data.id, source.id, 'inserted', payload))
          }
          result.wouldInsert++
          result.wouldInsertList.push(ygNoticePreviewItem(payload))
          continue
        }

        if (existing.content_hash === payload.content_hash) {
          result.skipped++
          if (!dryRun) result.touched.push(touchedFromPayload(existing.id, source.id, 'unchanged', payload))
          continue
        }
        const backfill = existing.content_hash === null
        if (!dryRun) {
          const note = `[${new Date().toISOString()}] content changed after capture`
          const query = supabase.from('event_candidates').update({
            content_hash: payload.content_hash,
            ...(backfill ? {} : {
              needs_recheck: true,
              reviewer_note: [existing.reviewer_note, note].filter(Boolean).join('\n'),
            }),
          }).eq('id', existing.id)
          // Guard against another run updating this capture while we were reading it.
          const { data, error } = await (backfill ? query.is('content_hash', null)
            : query.eq('content_hash', existing.content_hash)).select('id').maybeSingle()
          if (error) throw new Error(error.message)
          if (!data) {
            result.skipped++
            continue
          }
          result.touched.push(touchedFromPayload(existing.id, source.id, backfill ? 'backfilled_hash' : 'drift', payload))
        }
        if (backfill) result.skipped++
        else result.recheck++
      } catch (error) {
        result.errors.push(`${payload.source_url}：${String(error)}`)
      }
    }
    return finish(result.errors.length ? 'partial_error' : 'success')
  } catch (error) {
    result.status = 500
    result.errors.push(error instanceof Error ? error.message : String(error))
    return finish('error')
  }
}
