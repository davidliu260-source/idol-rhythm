/**
 * YouTube Official Channel fetcher orchestrator (P2-A1).
 *
 * Orchestrates:
 *   1. Resolve crawler_sources row by source_key (parser_type must be
 *      'youtube_official_channel').
 *   2. Validate config.channelId (required) and config.uploadsPlaylistId
 *      (optional, recommended).
 *   3. Resolve uploads playlist ID:
 *        - If config.uploadsPlaylistId is present: use directly (saves 1 unit).
 *        - Else: call channels.list once and emit a warning in the run summary
 *          so admin can backfill the config.
 *   4. Call playlistItems.list (page 1, up to maxVideosPerRun, ceiling 50)
 *      with snippet only.
 *   5. Filter entries by publishedAt within publishedAfterHours.
 *   6. Call videos.list (batched, ≤50 ids) with
 *      snippet,contentDetails,liveStreamingDetails.
 *   7. Classify each video into A / B / C / unknown tiers
 *      (see youtubeOfficialChannel.classifyYoutubeVideo).
 *      - C and unknown are skipped (do not insert).
 *      - A and B build payload with content_priority recorded in raw_data.
 *   8. Dedup against event_candidates by source_hash (and source_url as a
 *      safety net).
 *   9. INSERT new candidates (pending, not approved, not published). On
 *      content drift (existing row + content_hash mismatch) flag
 *      needs_recheck (J7d-A flow).
 *
 * Never writes events. Never approves. Never publishes.
 *
 * Fail gracefully:
 *   - YOUTUBE_API_KEY missing → returns a clear error in the result
 *     (caller marks crawler_sources.last_status = error). Does not crash.
 *   - 403 quotaExceeded / dailyLimitExceeded on any YouTube API call →
 *     short-circuits this source with a quota_exceeded marker. The caller
 *     (runActiveCrawlerSources) continues to the next source unaffected.
 *   - Network / 4xx / 5xx on a single API call → returns error in run
 *     summary; single failure does not propagate to other sources.
 *
 * Quota cost per run (when uploadsPlaylistId is pre-resolved):
 *   playlistItems.list  (1 unit)  +  videos.list batch (1 unit)  =  2 units
 *   When uploadsPlaylistId missing add channels.list (+1 unit).
 *
 * parser_type:    youtube_official_channel
 * parser_version: 1
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  YOUTUBE_OFFICIAL_CHANNEL_PARSER_TYPE,
  buildChannelsListUrl,
  buildPlaylistItemsUrl,
  buildVideosListUrl,
  classifyYoutubeVideo,
  entryToCandidatePayload,
  parseIso8601DurationSeconds,
  parseYoutubeChannelConfig,
  pickThumbnailUrl,
  type ChannelsListResponse,
  type PlaylistItemsResponse,
  type VideosListResponse,
  type YoutubeApiError,
  type YoutubeCandidatePayload,
  type YoutubeSourceContext,
  type YoutubeVideoEntry,
} from './youtubeOfficialChannel'
import {
  getCrawlerSourceByKey,
  type RunStatus,
  updateRunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = YOUTUBE_OFFICIAL_CHANNEL_PARSER_TYPE
const FETCH_TIMEOUT_MS = 15_000

export interface FetcherOptions {
  sourceKey: string
  dryRun?: boolean
}

export interface FetcherResult {
  source: 'youtube-official-channel'
  sourceKey: string
  mode: 'insert' | 'dry-run'
  fetched: number
  classifiedA: number
  classifiedB: number
  classifiedC: number
  classifiedUnknown: number
  inserted: number
  wouldInsert: number
  skipped: number
  recheck: number
  quotaExceeded: boolean
  errors: string[]
  warnings: string[]
  crawlerSourceId: string | null
  sourceName: string | null
  status: number
}

interface FetchJsonResult<T> {
  ok: boolean
  status: number
  data: T | null
  isQuotaError: boolean
  errorMessage: string | null
}

async function fetchYoutubeJson<T extends { error?: YoutubeApiError }>(
  url: string,
  signal: AbortSignal,
): Promise<FetchJsonResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    let data: T | null = null
    try {
      data = (await res.json()) as T
    } catch {
      data = null
    }
    if (!res.ok) {
      // Inspect for quota-style errors
      const apiErr = data?.error
      const isQuota = isQuotaErrorResponse(apiErr, res.status)
      const msg =
        apiErr?.message ??
        `YouTube API HTTP ${res.status}`
      return {
        ok: false,
        status: res.status,
        data: data ?? null,
        isQuotaError: isQuota,
        errorMessage: msg,
      }
    }
    return {
      ok: true,
      status: res.status,
      data,
      isQuotaError: false,
      errorMessage: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      status: 0,
      data: null,
      isQuotaError: false,
      errorMessage: `fetch 拋出例外：${msg}`,
    }
  }
}

function isQuotaErrorResponse(
  apiErr: YoutubeApiError | undefined,
  httpStatus: number,
): boolean {
  if (httpStatus !== 403) return false
  if (!apiErr?.errors || apiErr.errors.length === 0) {
    // 403 without details — treat as quota to be safe and fail gracefully
    return /quota|limit/i.test(apiErr?.message ?? '')
  }
  for (const e of apiErr.errors) {
    const reason = (e.reason ?? '').toLowerCase()
    if (reason === 'quotaexceeded' || reason === 'dailylimitexceeded' || reason === 'ratelimitexceeded') {
      return true
    }
  }
  return false
}

export async function runYoutubeOfficialChannelFetcher(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<FetcherResult> {
  const dryRun = options.dryRun === true
  const mode: 'insert' | 'dry-run' = dryRun ? 'dry-run' : 'insert'
  const sourceKey = options.sourceKey

  const base = (extra: Partial<FetcherResult>): FetcherResult => ({
    source: 'youtube-official-channel',
    sourceKey,
    mode,
    fetched: 0,
    classifiedA: 0,
    classifiedB: 0,
    classifiedC: 0,
    classifiedUnknown: 0,
    inserted: 0,
    wouldInsert: 0,
    skipped: 0,
    recheck: 0,
    quotaExceeded: false,
    errors: [],
    warnings: [],
    crawlerSourceId: null,
    sourceName: null,
    status: 200,
    ...extra,
  })

  // ── Resolve crawler_sources row ──────────────────────────────────────────
  const { source, error: sourceError } = await getCrawlerSourceByKey(supabase, sourceKey)
  if (!source) {
    return base({ errors: [sourceError ?? '找不到 crawler_sources'], status: 500 })
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

  if (!source.idol_id) {
    const msg = `crawler_sources 缺少 idol_id：${source.name}（youtube_official_channel 必須對應一個 idol）`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── Parse + validate config ──────────────────────────────────────────────
  const { config, error: cfgError } = parseYoutubeChannelConfig(source.config)
  if (!config) {
    const msg = cfgError ?? 'config 解析失敗'
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── API key check (fail gracefully if missing) ───────────────────────────
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || ''
  if (!apiKey) {
    const msg = '缺少 YOUTUBE_API_KEY 環境變數；請在 .env.local 或 Vercel 設定後重試'
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }

  // ── Load idol meta (slug used in payload context) ────────────────────────
  const { data: idolRow, error: idolError } = await supabase
    .from('idols')
    .select('id, name, slug')
    .eq('id', source.idol_id)
    .eq('is_active', true)
    .maybeSingle()

  if (idolError || !idolRow) {
    const msg = `找不到對應 idol（id: ${source.idol_id}）：${idolError?.message ?? '無資料'}`
    await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
    return base({
      errors: [msg],
      crawlerSourceId: source.id,
      sourceName: source.name,
      status: 500,
    })
  }
  const idolSlug = (idolRow.slug as string | null) ?? ''

  // ── YouTube API calls ────────────────────────────────────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const errors: string[] = []
  const warnings: string[] = []
  let quotaExceeded = false
  const entries: YoutubeVideoEntry[] = []
  let uploadsPlaylistId = config.uploadsPlaylistId ?? null

  try {
    // Step 1 (optional): resolve uploads playlist via channels.list
    if (!uploadsPlaylistId) {
      warnings.push(
        `config.uploadsPlaylistId 未設定 — 本次呼叫 channels.list 解析（+1 quota unit）。建議將解析結果寫回 config 以節省下次 quota。`,
      )
      const chRes = await fetchYoutubeJson<ChannelsListResponse>(
        buildChannelsListUrl(config.channelId, apiKey),
        controller.signal,
      )
      if (!chRes.ok || !chRes.data) {
        if (chRes.isQuotaError) {
          quotaExceeded = true
          errors.push(`YouTube quota 已用盡（channels.list）：${chRes.errorMessage ?? ''}`)
        } else {
          errors.push(`channels.list 失敗：${chRes.errorMessage ?? '未知錯誤'}`)
        }
        return await earlyExit(
          quotaExceeded ? 200 : (chRes.status >= 400 ? chRes.status : 502),
        )
      }
      const upl = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
      if (!upl) {
        errors.push(`channels.list 回應未包含 uploads playlist id（channelId: ${config.channelId}）`)
        return await earlyExit(502)
      }
      uploadsPlaylistId = upl
      warnings.push(`解析到 uploadsPlaylistId = ${upl}（請寫回 crawler_sources.config）`)
    }

    // Step 2: playlistItems.list (latest uploads, page 1, ≤ maxVideosPerRun)
    const plRes = await fetchYoutubeJson<PlaylistItemsResponse>(
      buildPlaylistItemsUrl(uploadsPlaylistId, apiKey, config.maxVideosPerRun ?? 10),
      controller.signal,
    )
    if (!plRes.ok || !plRes.data) {
      if (plRes.isQuotaError) {
        quotaExceeded = true
        errors.push(`YouTube quota 已用盡（playlistItems.list）：${plRes.errorMessage ?? ''}`)
      } else {
        errors.push(`playlistItems.list 失敗：${plRes.errorMessage ?? '未知錯誤'}`)
      }
      return await earlyExit(
        quotaExceeded ? 200 : (plRes.status >= 400 ? plRes.status : 502),
      )
    }

    const cutoffMs = Date.now() - (config.publishedAfterHours ?? 25) * 3600 * 1000
    const rawItems = plRes.data.items ?? []
    const videoIds: string[] = []
    const snippetMap = new Map<
      string,
      {
        publishedAt: string
        title: string
        channelTitle: string | null
        thumbnailUrl: string | null
      }
    >()

    for (const item of rawItems) {
      const vid = item.snippet?.resourceId?.videoId
      const publishedAt = item.snippet?.publishedAt
      const title = item.snippet?.title ?? ''
      if (!vid || !publishedAt) continue
      const tMs = Date.parse(publishedAt)
      if (!Number.isFinite(tMs) || tMs < cutoffMs) continue
      videoIds.push(vid)
      snippetMap.set(vid, {
        publishedAt,
        title,
        channelTitle: item.snippet?.channelTitle ?? null,
        thumbnailUrl: pickThumbnailUrl(item.snippet?.thumbnails),
      })
    }

    if (videoIds.length === 0) {
      return await earlyExit(200)
    }

    // Step 3: videos.list (batch — videoIds.length ≤ 50 from playlistItems cap)
    const vRes = await fetchYoutubeJson<VideosListResponse>(
      buildVideosListUrl(videoIds, apiKey),
      controller.signal,
    )
    if (!vRes.ok || !vRes.data) {
      if (vRes.isQuotaError) {
        quotaExceeded = true
        errors.push(`YouTube quota 已用盡（videos.list）：${vRes.errorMessage ?? ''}`)
      } else {
        errors.push(`videos.list 失敗：${vRes.errorMessage ?? '未知錯誤'}`)
      }
      return await earlyExit(
        quotaExceeded ? 200 : (vRes.status >= 400 ? vRes.status : 502),
      )
    }

    const vItems = vRes.data.items ?? []
    for (const it of vItems) {
      const vid = it.id
      if (!vid) continue
      const fromSnippet = snippetMap.get(vid)
      const publishedAt = it.snippet?.publishedAt ?? fromSnippet?.publishedAt ?? null
      if (!publishedAt) continue
      entries.push({
        videoId: vid,
        title: it.snippet?.title ?? fromSnippet?.title ?? '',
        description: it.snippet?.description ?? null,
        publishedAt,
        channelId: it.snippet?.channelId ?? config.channelId,
        channelTitle: it.snippet?.channelTitle ?? fromSnippet?.channelTitle ?? null,
        thumbnailUrl: pickThumbnailUrl(it.snippet?.thumbnails) ?? fromSnippet?.thumbnailUrl ?? null,
        duration: it.contentDetails?.duration ?? null,
        durationSeconds: parseIso8601DurationSeconds(it.contentDetails?.duration),
        liveBroadcastContent: (() => {
          // videos.list does not return liveBroadcastContent in snippet for
          // VOD videos; rely on liveStreamingDetails presence
          const lsd = it.liveStreamingDetails
          if (!lsd) return 'none'
          if (lsd.actualEndTime) return 'none' // already ended → treat as VOD for classifier
          if (lsd.actualStartTime && !lsd.actualEndTime) return 'live'
          if (lsd.scheduledStartTime && !lsd.actualStartTime) return 'upcoming'
          return 'none'
        })(),
        scheduledStartTime: it.liveStreamingDetails?.scheduledStartTime ?? null,
        actualStartTime: it.liveStreamingDetails?.actualStartTime ?? null,
        actualEndTime: it.liveStreamingDetails?.actualEndTime ?? null,
      })
    }
  } finally {
    clearTimeout(timeout)
  }

  // ── Classify + build payloads ────────────────────────────────────────────
  let classifiedA = 0
  let classifiedB = 0
  let classifiedC = 0
  let classifiedUnknown = 0

  const sourceCtx: YoutubeSourceContext = {
    crawlerSourceId: source.id,
    sourceKey: source.source_key,
    sourceName: source.name,
    sourceType: source.source_type,
    parserType: source.parser_type,
    pageUrl: source.source_url,
    idolId: source.idol_id,
    idolSlug,
    channelId: config.channelId,
    uploadsPlaylistId,
  }

  type EnrichedEntry = { entry: YoutubeVideoEntry; payload: YoutubeCandidatePayload }
  const enriched: EnrichedEntry[] = []

  for (const entry of entries) {
    const cls = classifyYoutubeVideo({
      title: entry.title,
      channelTitle: entry.channelTitle,
      durationSeconds: entry.durationSeconds,
      liveBroadcastContent: entry.liveBroadcastContent,
      scheduledStartTime: entry.scheduledStartTime,
    })
    if (cls.tier === 'A') classifiedA += 1
    else if (cls.tier === 'B') classifiedB += 1
    else if (cls.tier === 'C') classifiedC += 1
    else classifiedUnknown += 1

    if (cls.tier === 'C' || cls.tier === 'unknown') continue
    enriched.push({ entry, payload: entryToCandidatePayload(entry, cls, sourceCtx) })
  }

  // ── Dedup query ──────────────────────────────────────────────────────────
  interface ExistingRow {
    id: string
    source_hash: string | null
    source_url: string | null
    content_hash: string | null
    reviewer_note: string | null
  }
  const existingByHash = new Map<string, ExistingRow>()
  const existingByUrl = new Map<string, ExistingRow>()

  if (enriched.length > 0) {
    const hashes = enriched.map((e) => e.payload.source_hash)
    const urls = enriched.map((e) => e.payload.source_url)
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
      errors.push(msg)
      await updateRunStatus(supabase, source.id, { last_status: 'error', last_error: msg })
      return base({
        fetched: entries.length,
        classifiedA,
        classifiedB,
        classifiedC,
        classifiedUnknown,
        errors,
        warnings,
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
  let inserted = 0
  let wouldInsert = 0
  let skipped = 0
  let recheck = 0

  for (const { entry, payload } of enriched) {
    const existing =
      existingByHash.get(payload.source_hash) ??
      existingByUrl.get(payload.source_url) ??
      null

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

    // Existing row — content-drift detection (J7d-A flow)
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

  const lastStatus: RunStatus =
    errors.length === 0 ? 'success' : 'partial_error'
  const lastError =
    errors.length === 0
      ? warnings.length > 0
        ? warnings.join('\n')
        : null
      : [...errors, ...(warnings.length > 0 ? warnings : [])].join('\n')
  await updateRunStatus(supabase, source.id, { last_status: lastStatus, last_error: lastError })

  return {
    source: 'youtube-official-channel',
    sourceKey,
    mode,
    fetched: entries.length,
    classifiedA,
    classifiedB,
    classifiedC,
    classifiedUnknown,
    inserted,
    wouldInsert,
    skipped,
    recheck,
    quotaExceeded,
    errors,
    warnings,
    crawlerSourceId: source.id,
    sourceName: source.name,
    status: 200,
  }

  // ─── Helper closure (only reachable on early API errors before classify) ─
  async function earlyExit(httpStatus: number): Promise<FetcherResult> {
    const last_status: RunStatus = quotaExceeded
      ? 'partial_error'
      : errors.length > 0
        ? 'error'
        : 'success'
    const last_error =
      errors.length === 0
        ? warnings.length > 0
          ? warnings.join('\n')
          : null
        : [...errors, ...(warnings.length > 0 ? warnings : [])].join('\n')
    await updateRunStatus(supabase, source!.id, { last_status, last_error })
    return {
      source: 'youtube-official-channel',
      sourceKey,
      mode,
      fetched: entries.length,
      classifiedA: 0,
      classifiedB: 0,
      classifiedC: 0,
      classifiedUnknown: 0,
      inserted: 0,
      wouldInsert: 0,
      skipped: 0,
      recheck: 0,
      quotaExceeded,
      errors,
      warnings,
      crawlerSourceId: source!.id,
      sourceName: source!.name,
      status: httpStatus,
    }
  }
}
