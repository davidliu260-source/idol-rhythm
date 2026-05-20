import type { SupabaseClient } from '@supabase/supabase-js'
import {
  entryToCandidatePayload,
  parseYgScheduleItems,
  type YgApiScheduleItem,
  type YgSourceContext,
} from './ygArtistSchedule'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'yg_artist_schedule'
const MAX_ENTRIES_PER_RUN = 200
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'
const MONTHS_AHEAD = 12

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'yg-artist-schedule'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

function apiBaseOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).origin
  } catch {
    return ''
  }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function monthKey(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export async function runYgArtistScheduleFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    source: 'yg-artist-schedule',
    sourceKey,
    mode,
    fetched: 0,
    inserted: 0,
    wouldInsert: 0,
    skipped: 0,
    recheck: 0,
    errors: [],
    crawlerSourceId: null,
    sourceName: null,
    status: 200,
    ...extra,
  })

  const { source, error: sourceError } = await getCrawlerSourceByKey(
    supabase,
    sourceKey,
  )
  if (!source) {
    return base({
      errors: [sourceError ?? '找不到 crawler_sources'],
      status: 500,
    })
  }

  if (source.parser_type !== EXPECTED_PARSER_TYPE) {
    const msg = `parser_type 不符：crawler_sources=${source.parser_type}，預期=${EXPECTED_PARSER_TYPE}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  if (!source.is_active) {
    const msg = `來源已停用：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'skipped', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 200,
    })
  }

  const config = source.config as { artistId?: unknown; artistSlug?: unknown }
  const artistId =
    typeof config.artistId === 'number'
      ? config.artistId
      : typeof config.artistId === 'string' && /^\d+$/.test(config.artistId)
        ? Number(config.artistId)
        : null
  const artistSlug =
    typeof config.artistSlug === 'string' && config.artistSlug.length > 0
      ? config.artistSlug
      : null

  if (artistId === null) {
    const msg = `來源 config 缺少 artistId：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const pageUrl = source.source_url
  const apiBase = apiBaseOf(pageUrl)
  if (!apiBase) {
    const msg = `source_url 不是合法 URL：${pageUrl}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const allItems: YgApiScheduleItem[] = []
  const fetchErrors: string[] = []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const now = new Date()
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const { year, month } = monthKey(d)
      const url = `${apiBase}/api/artist/schedule/list/${artistId}/${year}/${month}`
      try {
        const data = await fetchJson<YgApiScheduleItem[]>(url, controller.signal)
        allItems.push(...(data ?? []))
      } catch (e) {
        fetchErrors.push(
          `YG schedule API 失敗 ${year}-${String(month).padStart(2, '0')}：${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  if (allItems.length === 0 && fetchErrors.length === MONTHS_AHEAD) {
    await updateRunStatus(supabase, source.id, {
      last_status: 'error',
      last_error: fetchErrors.join(' | '),
    })
    return base({
      errors: fetchErrors,
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    })
  }

  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const allEntries = parseYgScheduleItems(allItems, pageUrl)
  const entries = allEntries.filter(
    (e) => e.detectedDate === null || e.detectedDate >= todayIso,
  )
  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)

  let idolId: string | null = source.idol_id
  if (!idolId && artistSlug) {
    const { data, error } = await supabase
      .from('idols')
      .select('id')
      .eq('slug', artistSlug)
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('yg-artist-schedule: idol lookup fallback failed', error)
    } else if (data?.id) {
      idolId = data.id as string
    }
  }

  const sourceCtx: YgSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
    idolId,
    artistId,
    artistSlug,
  }

  const payloads = limited.map((entry) => ({
    entry,
    payload: entryToCandidatePayload(entry, sourceCtx),
  }))

  interface ExistingRow {
    id: string
    source_hash: string | null
    source_url: string | null
    content_hash: string | null
    reviewer_note: string | null
  }
  const existingByHash = new Map<string, ExistingRow>()
  const existingByUrl = new Map<string, ExistingRow>()

  if (limited.length > 0) {
    const hashes = payloads.map((p) => p.payload.source_hash)
    const urls = payloads.map((p) => p.entry.sourceUrl)
    const [hashRes, urlRes] = await Promise.all([
      supabase
        .from('event_candidates')
        .select('id, source_hash, source_url, content_hash, reviewer_note')
        .in('source_hash', hashes),
      supabase
        .from('event_candidates')
        .select('id, source_hash, source_url, content_hash, reviewer_note')
        .in('source_url', urls),
    ])
    if (hashRes.error || urlRes.error) {
      const err = hashRes.error ?? urlRes.error
      const msg = `去重查詢失敗：${err?.code ? `[${err.code}] ` : ''}${err?.message ?? '未知錯誤'}`
      await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
      return base({
        fetched: limited.length,
        errors: [msg, ...fetchErrors],
        crawlerSourceId: source.id,
        sourceName: source.name,
        status: 500,
      })
    }
    for (const row of (hashRes.data ?? []) as ExistingRow[]) {
      if (row.source_hash) existingByHash.set(row.source_hash, row)
    }
    for (const row of (urlRes.data ?? []) as ExistingRow[]) {
      if (row.source_url) existingByUrl.set(row.source_url, row)
    }
  }

  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  let recheck = 0
  const errors: string[] = [...fetchErrors]

  for (const { entry, payload } of payloads) {
    const existing =
      existingByHash.get(payload.source_hash) ?? existingByUrl.get(entry.sourceUrl) ?? null

    if (!existing) {
      if (dryRun) {
        wouldInsert += 1
        continue
      }
      const { error } = await supabase.from('event_candidates').insert(payload)
      if (error) {
        if (error.code === '23505') {
          skipped += 1
          continue
        }
        errors.push(
          `${entry.title}: insert 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
        )
        continue
      }
      inserted += 1
      continue
    }

    if (existing.content_hash === null) {
      if (!dryRun) {
        const { error } = await supabase
          .from('event_candidates')
          .update({ content_hash: payload.content_hash })
          .eq('id', existing.id)
        if (error) {
          errors.push(
            `${entry.title}: content_hash backfill 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
          )
          continue
        }
      }
      skipped += 1
      continue
    }

    if (existing.content_hash === payload.content_hash) {
      skipped += 1
      continue
    }

    if (dryRun) {
      recheck += 1
      continue
    }

    const noteSuffix = `[${new Date().toISOString()}] content changed after capture`
    const newNote = existing.reviewer_note
      ? `${existing.reviewer_note}\n${noteSuffix}`
      : noteSuffix

    const { error } = await supabase
      .from('event_candidates')
      .update({
        needs_recheck: true,
        content_hash: payload.content_hash,
        reviewer_note: newNote,
      })
      .eq('id', existing.id)
    if (error) {
      errors.push(
        `${entry.title}: recheck flag 失敗 ${error.code ? `[${error.code}] ` : ''}${error.message}`,
      )
      continue
    }
    recheck += 1
  }

  if (!dryRun) wouldInsert = inserted

  const lastStatus: RunStatus = errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  return {
    source: 'yg-artist-schedule',
    sourceKey,
    mode,
    fetched: limited.length,
    inserted,
    wouldInsert,
    skipped,
    recheck,
    errors,
    crawlerSourceId: source.id,
    sourceName: source.name,
    status: 200,
  }
}
