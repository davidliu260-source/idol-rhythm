/**
 * Generic webpage fetcher orchestrator (P1-B1, preview-only).
 *
 * Flow:
 *   1. Resolve crawler_sources row by source_key (parser_type must be
 *      'generic_webpage').
 *   2. If source has idol_id, look up the idol name as a Claude prompt hint
 *      (display only; LLM is told it is a hint, not a constraint).
 *   3. fetchPublicHtml(source.source_url) — strict timeout / byte limits;
 *      fail gracefully on 403 / 429 / Cloudflare. Never bypass.
 *   4. cleanHtmlToText(html) — strip non-content nodes, take title +
 *      meta description + main body, cap at MAX_TEXT_LENGTH.
 *   5. parseWebpageWithClaude(...) — Claude Haiku JSON-only call.
 *
 * P1-B1 boundary: NEVER writes to event_candidates. NEVER writes to events.
 * NEVER calls service-role beyond crawler_sources status update. The
 * returned PreviewResult is purely informational for the admin.
 *
 * P1-B2 (separate PR, separate GPT audit) will add the commit path that
 * writes to event_candidates with dedupe / confidence threshold / max
 * candidates per run.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cleanHtmlToText,
  fetchPublicHtml,
  parseWebpageWithClaude,
  type CleanedPage,
  type ClaudeParseResult,
  type PreviewEvent,
} from './genericWebpage'
import {
  getCrawlerSourceByKey,
  updateRunStatus,
  type RunStatus,
} from './crawlerSource'

const EXPECTED_PARSER_TYPE = 'generic_webpage'

export interface FetcherOptions {
  sourceKey: string
}

export interface PreviewResult {
  source: 'generic-webpage'
  mode: 'preview'
  sourceKey: string
  sourceName: string | null
  crawlerSourceId: string | null
  sourceUrl: string | null
  finalUrl: string | null
  httpStatus: number
  bytesRead: number
  wasByteTruncated: boolean
  pageTitle: string | null
  metaDescription: string | null
  bodyTextLength: number
  bodyTextTruncated: boolean
  hintIdolName: string | null
  pageRelevance: 'high' | 'medium' | 'low' | 'none' | null
  parserNote: string | null
  events: PreviewEvent[]
  truncatedEvents: number
  model: string | null
  errors: string[]
  warnings: string[]
  status: number
}

function base(
  sourceKey: string,
  extra: Partial<PreviewResult>,
): PreviewResult {
  return {
    source: 'generic-webpage',
    mode: 'preview',
    sourceKey,
    sourceName: null,
    crawlerSourceId: null,
    sourceUrl: null,
    finalUrl: null,
    httpStatus: 0,
    bytesRead: 0,
    wasByteTruncated: false,
    pageTitle: null,
    metaDescription: null,
    bodyTextLength: 0,
    bodyTextTruncated: false,
    hintIdolName: null,
    pageRelevance: null,
    parserNote: null,
    events: [],
    truncatedEvents: 0,
    model: null,
    errors: [],
    warnings: [],
    status: 200,
    ...extra,
  }
}

async function lookupIdolName(
  supabase: SupabaseClient,
  idolId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('idols')
    .select('name')
    .eq('id', idolId)
    .maybeSingle()
  if (error || !data) return null
  const name = (data as { name?: unknown }).name
  return typeof name === 'string' && name.trim().length > 0
    ? name.trim()
    : null
}

export async function runGenericWebpagePreview(
  supabase: SupabaseClient,
  options: FetcherOptions,
): Promise<PreviewResult> {
  const sourceKey = options.sourceKey

  // ── Resolve crawler_sources row ─────────────────────────────────────────
  const { source, error: srcErr } = await getCrawlerSourceByKey(
    supabase,
    sourceKey,
  )
  if (srcErr || !source) {
    return base(sourceKey, {
      errors: [srcErr ?? `找不到 crawler_sources：${sourceKey}`],
      status: 404,
    })
  }
  if (source.parser_type !== EXPECTED_PARSER_TYPE) {
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url,
      errors: [
        `parser_type 不符：expected '${EXPECTED_PARSER_TYPE}', got '${source.parser_type}'`,
      ],
      status: 400,
    })
  }

  const sourceUrl = source.source_url?.trim() ?? ''
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.source_url ?? null,
      errors: ['source_url 缺漏或不是 http(s) URL'],
      status: 400,
    })
  }

  // ── Optional: idol hint (display only) ─────────────────────────────────
  const hintIdolName = source.idol_id
    ? await lookupIdolName(supabase, source.idol_id)
    : null

  // ── 1. Fetch ────────────────────────────────────────────────────────────
  const fetched = await fetchPublicHtml(sourceUrl)
  if (!fetched.ok || !fetched.html) {
    // Best-effort status update; do not propagate failures.
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: fetched.error ?? `fetch failed (status ${fetched.status})`,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      hintIdolName,
      errors: [fetched.error ?? `fetch failed (status ${fetched.status})`],
      status: 502,
    })
  }

  const warnings: string[] = []
  if (fetched.wasByteTruncated) {
    warnings.push(`response body exceeded ${500 * 1024} bytes and was truncated`)
  }

  // ── 2. Clean ────────────────────────────────────────────────────────────
  let cleaned: CleanedPage
  try {
    cleaned = cleanHtmlToText(fetched.html)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: `HTML 清理失敗：${msg}`,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      hintIdolName,
      errors: [`HTML 清理失敗：${msg}`],
      warnings,
      status: 500,
    })
  }

  if (cleaned.wasTruncated) {
    warnings.push('extracted body text exceeded 8000 chars and was truncated')
  }

  // ── 3. Claude parse ─────────────────────────────────────────────────────
  let parseResult: ClaudeParseResult
  try {
    parseResult = await parseWebpageWithClaude({
      sourceUrl,
      page: cleaned,
      hintIdolName,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateRunStatus(supabase, source.id, {
      last_status: 'error' as RunStatus,
      last_error: msg,
    })
    return base(sourceKey, {
      crawlerSourceId: source.id,
      sourceName: source.name,
      sourceUrl,
      finalUrl: fetched.finalUrl,
      httpStatus: fetched.status,
      bytesRead: fetched.bytesRead,
      wasByteTruncated: fetched.wasByteTruncated,
      pageTitle: cleaned.pageTitle || null,
      metaDescription: cleaned.metaDescription || null,
      bodyTextLength: cleaned.bodyText.length,
      bodyTextTruncated: cleaned.wasTruncated,
      hintIdolName,
      errors: [msg],
      warnings,
      status: 502,
    })
  }

  if (parseResult.truncatedEvents > 0) {
    warnings.push(
      `Claude returned ${parseResult.events.length + parseResult.truncatedEvents} events; truncated to ${parseResult.events.length} (preview cap)`,
    )
  }

  // ── Success status write-back ──────────────────────────────────────────
  await updateRunStatus(supabase, source.id, {
    last_status: 'success' as RunStatus,
    last_error: null,
  })

  return base(sourceKey, {
    crawlerSourceId: source.id,
    sourceName: source.name,
    sourceUrl,
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    bytesRead: fetched.bytesRead,
    wasByteTruncated: fetched.wasByteTruncated,
    pageTitle: cleaned.pageTitle || null,
    metaDescription: cleaned.metaDescription || null,
    bodyTextLength: cleaned.bodyText.length,
    bodyTextTruncated: cleaned.wasTruncated,
    hintIdolName,
    pageRelevance: parseResult.pageRelevance,
    parserNote: parseResult.parserNote,
    events: parseResult.events,
    truncatedEvents: parseResult.truncatedEvents,
    model: parseResult.model,
    errors: [],
    warnings,
    status: 200,
  })
}
