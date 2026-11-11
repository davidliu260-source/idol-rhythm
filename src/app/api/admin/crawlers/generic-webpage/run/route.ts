import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import {
  runGenericWebpageCommit,
  runGenericWebpagePreview,
  type CommitSummary,
} from '@/lib/crawlers/runGenericWebpageFetcher'
import type { PreviewEvent } from '@/lib/crawlers/genericWebpage'

export const dynamic = 'force-dynamic'

// ── Response shapes (preview vs commit are strictly separate) ──────────────

interface BaseResponseFields {
  ok: boolean
  source: 'generic-webpage'
  sourceKey: string | null
  errors: string[]
}

interface PreviewResponse extends BaseResponseFields {
  mode: 'preview'
  sourceName: string | null
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
  warnings: string[]
}

interface CommitResponse extends BaseResponseFields {
  mode: 'commit'
  sourceName: string | null
  sourceUrl: string | null
  finalUrl: string | null
  httpStatus: number
  pageTitle: string | null
  pageRelevance: 'high' | 'medium' | 'low' | 'none' | null
  summary: CommitSummary
  warnings: string[]
}

interface ErrorResponse extends BaseResponseFields {
  // Discriminator: mode is null for guard-rejection responses (before
  // dispatch). Keeps the JSON shape narrow so the client can branch on
  // typeof body.mode without inferring richer shapes.
  mode: null
}

type RunResponse = PreviewResponse | CommitResponse | ErrorResponse

function errorBody(
  sourceKey: string | null,
  errors: string[],
): ErrorResponse {
  return {
    ok: false,
    source: 'generic-webpage',
    mode: null,
    sourceKey,
    errors,
  }
}

/**
 * POST /api/admin/crawlers/generic-webpage/run
 *
 * Admin-only manual trigger for the generic_webpage parser.
 *
 * Body shapes:
 *
 *   Preview (P1-B1 unchanged):
 *     { "sourceKey": string, "mode"?: "preview" }
 *
 *   Commit (P1-B2):
 *     { "sourceKey": string, "mode": "commit", "confirmCommit": true }
 *
 * Hard guarantees:
 *   - Never writes to `events` table; only to event_candidates (commit mode).
 *   - review_status is always 'pending' — admin must approve in /admin/event-candidates.
 *   - Never bypasses Cloudflare / bot protection / paywall.
 *   - Commit requires confirmCommit === true (explicit boolean) AND a single
 *     sourceKey string. Arrays / multiple sources are refused.
 *   - Cron and admin sync-all fan-out cannot reach this route — the dispatch
 *     guard in runActiveCrawlerSources unconditionally skips generic_webpage.
 *
 * Auth: getCurrentAdmin() must succeed. Same admin check applies to both
 * preview and commit modes.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<RunResponse>> {
  // ── Guard 1: admin auth (applies to BOTH preview and commit) ────────────
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return NextResponse.json(errorBody(null, ['未授權：需要管理員身份']), {
      status: 401,
    })
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = (await request.json()) as Record<string, unknown>
  } catch {
    // empty / non-JSON body — handled below
  }

  // ── Guard 2: batch ban (sourceKeys array is rejected before any work) ──
  if ('sourceKeys' in rawBody) {
    return NextResponse.json(
      errorBody(null, ['batch commit not supported in v1']),
      { status: 400 },
    )
  }

  // ── Guard 3: single sourceKey string required ──────────────────────────
  const sourceKey =
    typeof rawBody.sourceKey === 'string' && rawBody.sourceKey.trim().length > 0
      ? rawBody.sourceKey.trim()
      : null
  if (!sourceKey) {
    return NextResponse.json(
      errorBody(null, ['sourceKey required (single string only)']),
      { status: 400 },
    )
  }

  // ── Guard 4: mode whitelist ────────────────────────────────────────────
  const mode = typeof rawBody.mode === 'string' ? rawBody.mode : 'preview'
  if (mode !== 'preview' && mode !== 'commit') {
    return NextResponse.json(
      errorBody(sourceKey, ['mode must be preview or commit']),
      { status: 400 },
    )
  }

  // ── Guard 5: commit mode requires explicit confirmCommit === true ──────
  if (mode === 'commit' && rawBody.confirmCommit !== true) {
    return NextResponse.json(
      errorBody(sourceKey, ['confirmCommit must be true for mode=commit']),
      { status: 400 },
    )
  }

  // ── Dispatch ───────────────────────────────────────────────────────────
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(errorBody(sourceKey, ['Supabase 未設定']), {
      status: 500,
    })
  }

  if (mode === 'preview') {
    const result = await runGenericWebpagePreview(supabase, { sourceKey })
    const body: PreviewResponse = {
      ok: result.errors.length === 0,
      source: result.source,
      mode: 'preview',
      sourceKey: result.sourceKey,
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl,
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      bytesRead: result.bytesRead,
      wasByteTruncated: result.wasByteTruncated,
      pageTitle: result.pageTitle,
      metaDescription: result.metaDescription,
      bodyTextLength: result.bodyTextLength,
      bodyTextTruncated: result.bodyTextTruncated,
      hintIdolName: result.hintIdolName,
      pageRelevance: result.pageRelevance,
      parserNote: result.parserNote,
      events: result.events,
      truncatedEvents: result.truncatedEvents,
      model: result.model,
      errors: result.errors,
      warnings: result.warnings,
    }
    return NextResponse.json(body, { status: result.status })
  }

  // mode === 'commit'
  const result = await runGenericWebpageCommit(supabase, { sourceKey })
  const body: CommitResponse = {
    ok: result.errors.length === 0,
    source: result.source,
    mode: 'commit',
    sourceKey: result.sourceKey,
    sourceName: result.sourceName,
    sourceUrl: result.sourceUrl,
    finalUrl: result.finalUrl,
    httpStatus: result.httpStatus,
    pageTitle: result.pageTitle,
    pageRelevance: result.pageRelevance,
    summary: result.summary,
    warnings: result.warnings,
    errors: result.errors,
  }
  return NextResponse.json(body, { status: result.status })
}
