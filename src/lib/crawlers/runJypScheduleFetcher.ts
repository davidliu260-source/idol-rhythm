import type { SupabaseClient } from '@supabase/supabase-js'
import {
  entryToCandidatePayload,
  parseJypScheduleApiItems,
  type JypApiScheduleItem,
  type JypSourceContext,
} from './jypSchedule'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'jyp_schedule'
// Per-run cap on rows considered for INSERT. Sized for MONTHS_AHEAD = 12
// against a busy JYP artist (ITZY shows ~150 forward-looking items in a
// year). The slice is taken AFTER the past-event filter and BEFORE the
// dedup query, so a too-low cap would mean later events never reach the
// candidate pool even on subsequent cron runs.
const MAX_ENTRIES_PER_RUN = 200
const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT = 'IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)'
// Fetch this many months starting from the current month. 12 = roughly one
// year forward, which is enough to catch tours / fanmeets announced ahead.
// Past-dated rows inside the first month are filtered out at parse time.
const MONTHS_AHEAD = 12

export interface FetcherOptions {
  /** crawler_sources.source_key — required. Picks which JYP source to run. */
  sourceKey: string
  /** Skip INSERT loop; report wouldInsert. Still updates crawler_sources status. */
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'jyp-schedule'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  inserted: number
  wouldInsert: number
  skipped: number
  /** J7d-A: number of existing rows flagged needs_recheck this run. */
  recheck: number
  errors: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

/** ISO 8601 datetime string with local-offset, matching the JYP JS client. */
function formatIso(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const oh = pad(Math.floor(absMin / 60))
  const om = pad(absMin % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${oh}:${om}`
  )
}

function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 0)
  return { startDate: formatIso(start), endDate: formatIso(end) }
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

function originOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).origin
  } catch {
    return ''
  }
}

/**
 * JYP Schedule platform fetcher.
 *
 * Reads `crawler_sources` by `options.sourceKey`, expects parser_type =
 * 'jyp_schedule' and `config.groupId` populated, then calls the JYP JSON
 * API for the current month plus MONTHS_AHEAD-1 additional months, parses
 * schedule items, dedupes by source_hash + source_url, and inserts pending
 * rows into `event_candidates`.
 *
 * Updates crawler_sources.last_run_at / last_status / last_error in every
 * exit path. Never writes to events, never approves, never publishes.
 */
export async function runJypScheduleFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (
    extra: Partial<FetcherResult>,
  ): FetcherResult => ({
    source: 'jyp-schedule',
    sourceKey,
    mode,
    fetched: 0,
    inserted: 0,
    wouldInsert: 0,
    recheck: 0,
    skipped: 0,
    errors: [],
    crawlerSourceId: null,
    sourceName: null,
    status: 200,
    ...extra,
  })

  // ── Resolve crawler_sources row ──────────────────────────────────────────
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

  const config = source.config as { groupId?: unknown; artistSlug?: unknown }
  const configGroupId =
    typeof config.groupId === 'string' && config.groupId.length > 0
      ? config.groupId
      : null
  const artistSlug =
    typeof config.artistSlug === 'string' && config.artistSlug.length > 0
      ? config.artistSlug
      : null

  if (!configGroupId && !artistSlug) {
    const msg = `來源 config 缺少 groupId 與 artistSlug：${source.name}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  const pageUrl = source.source_url
  const apiOrigin = originOf(pageUrl)
  if (!apiOrigin) {
    const msg = `source_url 不是合法 URL：${pageUrl}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── Fetch JSON API ───────────────────────────────────────────────────────
  const allItems: JypApiScheduleItem[] = []
  const fetchErrors: string[] = []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let groupId: string
  try {
    if (configGroupId) {
      groupId = configGroupId
    } else if (artistSlug) {
      const groupData = await fetchJson<{ groupId: string; fansKey: string }>(
        `${apiOrigin}/api/groups/${encodeURIComponent(artistSlug)}`,
        controller.signal,
      )
      if (!groupData.groupId) throw new Error('JYP /api/groups 回傳的 groupId 為空')
      groupId = groupData.groupId
    } else {
      // Already validated above, but keep TS narrowing happy.
      throw new Error('來源 config 缺少 groupId 與 artistSlug')
    }

    // Fetch schedules month by month.
    const now = new Date()
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const { startDate, endDate } = monthRange(d.getFullYear(), d.getMonth() + 1)
      const url =
        `${apiOrigin}/api/schedules?groupId=${encodeURIComponent(groupId)}` +
        `&startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}`
      try {
        const data = await fetchJson<{ schedules: JypApiScheduleItem[] }>(
          url,
          controller.signal,
        )
        allItems.push(...(data.schedules ?? []))
      } catch (e) {
        fetchErrors.push(
          `行程 API 失敗 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}：${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
  } catch (e) {
    clearTimeout(timeout)
    const msg = `JYP API 失敗：${e instanceof Error ? e.message : String(e)}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 502,
    })
  } finally {
    clearTimeout(timeout)
  }

  // All months failed → hard error.
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

  // ── Parse ────────────────────────────────────────────────────────────────
  // Only keep events whose scheduledDate is today or later. JYP's monthly
  // window can include past-dated items (anniversaries, releases, etc.),
  // and the candidate pool is forward-looking by design — past rows would
  // just be noise for the admin reviewer. Already-stored candidates and
  // approved events are NOT touched; this filter only gates new INSERTs.
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const allEntries = parseJypScheduleApiItems(allItems, pageUrl)
  const entries = allEntries.filter(
    (e) => e.detectedDate !== null && e.detectedDate >= todayIso,
  )
  const limited = entries.slice(0, MAX_ENTRIES_PER_RUN)

  // ── Resolve idol id ──────────────────────────────────────────────────────
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
      console.warn('jyp-schedule: idol lookup fallback failed', error)
    } else if (data?.id) {
      idolId = data.id as string
    }
  }

  const sourceCtx: JypSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl,
    idolId,
    groupId,
    artistSlug,
  }

  const payloads = limited.map((entry) => ({
    entry,
    payload: entryToCandidatePayload(entry, sourceCtx),
  }))

  // ── Dedup query (J7d-A: also fetch id + content_hash + reviewer_note) ────
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

  // ── INSERT / RECHECK loop ────────────────────────────────────────────────
  // Per-row outcomes:
  //   - no existing row matching source_hash OR source_url → INSERT
  //   - existing row, content_hash IS NULL  → silent backfill (treat as
  //     unchanged; first post-J7d-A run for legacy rows)
  //   - existing row, content_hash equals payload → SKIP (unchanged)
  //   - existing row, content_hash differs  → FLAG needs_recheck=true,
  //     update content_hash to new value, append a note line. Never touch
  //     review_status, approved_event_id, or raw_* fields.
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

    // existing row matched
    if (existing.content_hash === null) {
      // First post-J7d-A capture for this legacy row — silently backfill
      // content_hash without flagging. Skipping the recheck path here is
      // intentional: we don't know whether the source changed, only that
      // we never recorded a hash before.
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

    // Content drift detected.
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

  const insertErrorCount = errors.length - fetchErrors.length
  const lastStatus: RunStatus = errors.length === 0 ? 'success' : 'partial_error'
  await updateRunStatus(supabase, source.id, {
    last_status: lastStatus,
    last_error: errors.length > 0 ? errors.join('\n') : null,
  })

  void insertErrorCount // kept for future logging

  return {
    source: 'jyp-schedule',
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
