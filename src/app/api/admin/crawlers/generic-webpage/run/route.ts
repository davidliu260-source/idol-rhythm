import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/supabase/adminAuth'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { runGenericWebpagePreview } from '@/lib/crawlers/runGenericWebpageFetcher'
import type { PreviewEvent } from '@/lib/crawlers/genericWebpage'

export const dynamic = 'force-dynamic'

interface RunResponse {
  ok: boolean
  source: 'generic-webpage'
  mode: 'preview'
  sourceKey: string | null
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
  errors: string[]
  warnings: string[]
}

function emptyResponse(
  ok: boolean,
  sourceKey: string | null,
  errors: string[],
): RunResponse {
  return {
    ok,
    source: 'generic-webpage',
    mode: 'preview',
    sourceKey,
    sourceName: null,
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
    errors,
    warnings: [],
  }
}

function buildResponse(
  body: RunResponse,
  status: number,
): NextResponse<RunResponse> {
  return NextResponse.json(body, { status })
}

/**
 * POST /api/admin/crawlers/generic-webpage/run
 *
 * Admin-only manual trigger for the generic_webpage parser (P1-B1, preview).
 *
 * Body:
 *   {
 *     "sourceKey": string,            // required — must match crawler_sources.source_key
 *     "mode"?: "preview" | "commit"   // optional — only "preview" accepted in P1-B1
 *   }
 *
 * - Never writes to event_candidates (P1-B1 is preview-only).
 * - Never approves. Never publishes.
 * - Never bypasses Cloudflare / bot protection / paywall.
 * - "commit" mode returns 400 — that path is reserved for P1-B2 after
 *   separate GPT audit.
 *
 * Auth: getCurrentAdmin() must succeed. There is no second layer (e.g.
 * an extra header check); the admin route + the dispatch guard in
 * runActiveCrawlerSources together cover the fan-out paths.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<RunResponse>> {
  const { isAdmin } = await getCurrentAdmin()
  if (!isAdmin) {
    return buildResponse(
      emptyResponse(false, null, ['未授權：需要管理員身份']),
      401,
    )
  }

  let sourceKey: string | null = null
  let mode: string = 'preview'
  try {
    const body = (await request.json()) as {
      sourceKey?: unknown
      mode?: unknown
    }
    if (typeof body.sourceKey === 'string' && body.sourceKey.length > 0) {
      sourceKey = body.sourceKey
    }
    if (typeof body.mode === 'string' && body.mode.length > 0) {
      mode = body.mode
    }
  } catch {
    // empty / non-JSON body — handled below
  }

  if (!sourceKey) {
    return buildResponse(
      emptyResponse(false, null, [
        '請在 body 提供 sourceKey（例如 generic-test-page）',
      ]),
      400,
    )
  }

  if (mode !== 'preview') {
    return buildResponse(
      emptyResponse(false, sourceKey, [
        `mode='${mode}' 不被支援。P1-B1 只支援 mode='preview'；commit 路徑保留給 P1-B2（需另開 GPT audit）。`,
      ]),
      400,
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return buildResponse(
      emptyResponse(false, sourceKey, ['Supabase 未設定']),
      500,
    )
  }

  const result = await runGenericWebpagePreview(supabase, { sourceKey })

  return buildResponse(
    {
      ok: result.errors.length === 0,
      source: result.source,
      mode: result.mode,
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
    },
    result.status,
  )
}
