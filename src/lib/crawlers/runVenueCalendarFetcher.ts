import type { SupabaseClient } from '@supabase/supabase-js'
import { taipeiToday } from '../taipeiDate'
import { getCrawlerSourceByKey, updateRunStatus, type RunStatus } from './crawlerSource'
import { touchedFromPayload, type TouchedCandidate } from './touchedCandidate'
import {
  isKaoarenaLocation, KAOARENA_LIST_URL, parseVenueCalendarList, selectVenueEntries,
  venueCandidateFromDetail, type VenueIdol,
} from './venueCalendar'

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdolRhythm/0.1)', Accept: 'text/html' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}：${url}`)
  return response.text()
}

export async function runVenueCalendarFetcher(
  supabase: SupabaseClient,
  { sourceKey, dryRun }: { sourceKey: string; dryRun: boolean },
) {
  const result = {
    source: 'venue-calendar',
    sourceKey,
    sourceName: null as string | null,
    mode: dryRun ? 'dry-run' as const : 'insert' as const,
    fetched: 0,
    matched: 0,
    skipped_past: 0,
    skipped_unmatched: 0,
    skipped_category: 0,
    skipped_existing_event: 0,
    wouldInsert: 0,
    wouldInsertList: [] as { title: string; date: string; sourceUrl: string }[],
    inserted: 0,
    skipped: 0,
    recheck: 0,
    errors: [] as string[],
    touched: [] as TouchedCandidate[],
    status: 200,
  }

  const { source, error } = await getCrawlerSourceByKey(supabase, sourceKey)
  if (!source) {
    result.errors.push(error ?? '找不到 crawler_sources')
    result.status = 500
    return result
  }
  result.sourceName = source.name
  async function finish(status: RunStatus) {
    if (!dryRun && source) {
      await updateRunStatus(supabase, source.id, {
        last_status: status, last_error: result.errors.join('\n') || null,
      })
    }
    result.skipped += result.skipped_past + result.skipped_unmatched +
      result.skipped_category + result.skipped_existing_event
    return result
  }
  if (source.parser_type !== 'venue_calendar' || source.config.venueKey !== 'kaoarena' ||
      source.source_url !== KAOARENA_LIST_URL || source.source_type !== 'official_website') {
    result.status = 400
    result.errors.push('來源設定不符合高雄巨蛋官方行事曆')
    return result
  }
  if (!source.is_active) {
    result.errors.push(`來源已停用：${source.name}`)
    return finish('skipped')
  }

  const today = taipeiToday()
  const year = Number(today.slice(0, 4))
  const { data: idols, error: idolError } = await supabase.from('idols')
    .select('id, slug, name, alt_names').eq('is_active', true).order('id')
  if (idolError) {
    result.status = 500
    result.errors.push(`讀取 idols 失敗：${idolError.message}`)
    return finish('error')
  }

  const entries: ReturnType<typeof parseVenueCalendarList>['entries'] = []
  for (const calendarYear of [year, year + 1]) {
    const url = `${KAOARENA_LIST_URL}?year=${calendarYear}`
    try {
      const list = parseVenueCalendarList(await fetchHtml(url), url)
      result.fetched += list.fetched
      entries.push(...list.entries)
    } catch (error) {
      result.status = 502
      result.errors.push(String(error))
      return finish('error')
    }
  }

  const { eligible, ...counts } = selectVenueEntries(entries, (idols ?? []) as VenueIdol[], today)
  Object.assign(result, counts)
  let previousDetailFetched = false
  for (const { entry, idol } of eligible) {
    if (previousDetailFetched) await new Promise((resolve) => setTimeout(resolve, 300))
    previousDetailFetched = true
    try {
      const payload = venueCandidateFromDetail(await fetchHtml(entry.sourceUrl), entry, idol.id, source)
      if (payload.detected_date < today) {
        result.skipped_past++
        continue
      }

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
          .select('venue_name, address, location_name_zh, location')
          .eq('idol_id', idol.id).eq('date', payload.detected_date)
        if (error) throw new Error(error.message)
        if (events?.some((row) => isKaoarenaLocation(
          row.venue_name, row.address, row.location_name_zh, row.location,
        ))) {
          result.skipped_existing_event++
          continue
        }

        if (dryRun) {
          result.wouldInsert++
          result.wouldInsertList.push({ title: payload.raw_title, date: payload.detected_date, sourceUrl: entry.sourceUrl })
          continue
        }
        const { data, error: insertError } = await supabase.from('event_candidates')
          .insert(payload).select('id').single()
        if (insertError?.code === '23505') {
          result.skipped++
          continue
        }
        if (insertError) throw new Error(insertError.message)
        result.inserted++
        result.touched.push(touchedFromPayload(data.id, source.id, 'inserted', payload))
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
        const { error: updateError } = await supabase.from('event_candidates').update({
          content_hash: payload.content_hash,
          ...(backfill ? {} : {
            needs_recheck: true,
            reviewer_note: [existing.reviewer_note, note].filter(Boolean).join('\n'),
          }),
        }).eq('id', existing.id)
        if (updateError) throw new Error(updateError.message)
        result.touched.push(touchedFromPayload(existing.id, source.id, backfill ? 'backfilled_hash' : 'drift', payload))
      }
      if (backfill) result.skipped++
      else result.recheck++
    } catch (error) {
      result.errors.push(`${entry.title}：${String(error)}`)
    }
  }

  if (!dryRun) result.wouldInsert = result.inserted
  return finish(result.errors.length ? 'partial_error' : 'success')
}
