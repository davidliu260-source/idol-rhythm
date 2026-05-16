/**
 * AI candidate parser — wraps Anthropic Claude to extract structured fields
 * from a free-text announcement, with strict whitelist validation on every
 * field we accept back.
 *
 * Trust boundary: NEVER trust the LLM blindly.
 *   - JSON.parse is wrapped in try/catch.
 *   - Every enum-typed field is checked against the same hard-coded
 *     whitelist used by the existing manual-import server action.
 *   - detected_idol_slug is resolved against the caller-supplied
 *     known_idols list; an LLM-invented slug returns null (not the LLM's
 *     value).
 *   - The LLM never sees or returns UUIDs.
 *   - confidence is clamped to [0, 1] regardless of what the LLM emits.
 *
 * Errors from the SDK or from invalid JSON surface as Error with a
 * Chinese-friendly message; the route handler relays that to the UI.
 */

import Anthropic from '@anthropic-ai/sdk'

// ── Whitelists (must match supabase/migrations/001_initial_schema.sql) ──────

export const EVENT_TYPES = [
  'concert',
  'ticketing',
  'livestream',
  'streaming',
  'media',
  'brand',
  'official',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const SOURCE_TYPES = [
  'official_sns',
  'official_website',
  'media_outlet',
  'fan_account',
  'community',
  'unknown',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

// ── Public types ────────────────────────────────────────────────────────────

export interface KnownIdol {
  id: string // UUID — never sent to the LLM
  slug: string
  name: string
}

export interface ParseInput {
  rawText: string
  knownIdols: KnownIdol[]
}

export interface ParsedCandidate {
  detected_idol_slug: string | null
  detected_idol_id: string | null // resolved from slug → UUID server-side
  detected_event_type: EventType | null
  detected_date: string | null // YYYY-MM-DD
  source_name: string | null
  source_type: SourceType | null
  confidence: number // 0..1
  reason: string
  /** The exact model id used for this call (echoed back for raw_data audit). */
  model: string
}

// ── Limits ──────────────────────────────────────────────────────────────────

export const RAW_TEXT_MIN_CHARS = 20
export const RAW_TEXT_MAX_CHARS = 12_000

// ── Model selection ────────────────────────────────────────────────────────

/** Resolve the Anthropic model id at call time (allows env override). */
export function resolveAnthropicModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim()
  if (fromEnv) return fromEnv
  return 'claude-haiku-4-5-20251001'
}

// ── Validation helpers ──────────────────────────────────────────────────────

function isEventType(v: unknown): v is EventType {
  return typeof v === 'string' && (EVENT_TYPES as readonly string[]).includes(v)
}

function isSourceType(v: unknown): v is SourceType {
  return typeof v === 'string' && (SOURCE_TYPES as readonly string[]).includes(v)
}

function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return Math.round(v * 100) / 100
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    'You extract structured event metadata from a free-text K-pop / idol announcement.',
    'Your output MUST be a single JSON object — no markdown, no commentary, no code fences.',
    '',
    'Output schema (all keys required; use null if uncertain):',
    '{',
    '  "detected_idol_slug": string | null,',
    '  "detected_event_type": "concert" | "ticketing" | "livestream" | "streaming" | "media" | "brand" | "official" | null,',
    '  "detected_date": "YYYY-MM-DD" | null,',
    '  "source_name": string | null,',
    '  "source_type": "official_sns" | "official_website" | "media_outlet" | "fan_account" | "community" | "unknown" | null,',
    '  "confidence": number between 0.0 and 1.0,',
    '  "reason": string (one short sentence explaining the call, may be Chinese or English)',
    '}',
    '',
    'Rules:',
    '- detected_idol_slug MUST be exactly one of the slugs in the known_idols list, or null. Never invent a slug.',
    '- If multiple idols are mentioned, pick the primary subject; if ambiguous, return null.',
    '- detected_event_type MUST be one of the listed enum values or null. Do not invent new types.',
    '- detected_date MUST be in YYYY-MM-DD form. If the text mentions a range, pick the first day. If unclear, return null.',
    '- source_type MUST be one of the listed enum values. If you cannot tell, use "unknown" or null.',
    '- Set confidence honestly. Use < 0.5 when guessing.',
    '- Do not output UUIDs.',
    '- Do not output extra keys.',
  ].join('\n')
}

function buildUserPrompt(rawText: string, knownIdols: KnownIdol[]): string {
  const idolList = knownIdols
    .map((i) => `- ${i.slug}: ${i.name}`)
    .join('\n')
  return [
    'known_idols:',
    idolList || '(none)',
    '',
    'announcement:',
    '"""',
    rawText,
    '"""',
    '',
    'Return the JSON object now.',
  ].join('\n')
}

// ── JSON extraction (defensive, in case the model wraps in fences) ──────────

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenceMatch ? fenceMatch[1] : trimmed
  // Fallback: locate the first `{` and last `}`.
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('LLM 回傳格式錯誤：找不到 JSON 物件')
  }
  const sliced = body.slice(firstBrace, lastBrace + 1)
  return JSON.parse(sliced)
}

// ── Main entry ──────────────────────────────────────────────────────────────

/**
 * Run a parse. Throws on any failure (network, bad JSON, schema mismatch).
 * The caller (route handler) maps exceptions to a Chinese error response.
 */
export async function parseCandidateWithClaude(
  input: ParseInput,
): Promise<ParsedCandidate> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未設定（請至 Vercel env vars 補上）')
  }

  // Input validation
  const rawText = input.rawText
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error('請貼上公告文字後再執行 AI 解析')
  }
  if (rawText.trim().length < RAW_TEXT_MIN_CHARS) {
    throw new Error(`公告文字太短（至少 ${RAW_TEXT_MIN_CHARS} 字）`)
  }
  if (rawText.length > RAW_TEXT_MAX_CHARS) {
    throw new Error(
      `公告文字過長（上限 ${RAW_TEXT_MAX_CHARS} 字，目前 ${rawText.length}）`,
    )
  }

  const model = resolveAnthropicModel()
  const client = new Anthropic({ apiKey })

  let responseText: string
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(rawText, input.knownIdols) }],
    })
    // SDK returns an array of content blocks; we asked for a single JSON text.
    const textBlock = resp.content.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('LLM 沒有回傳文字內容')
    }
    responseText = textBlock.text
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 呼叫失敗：${msg}`)
  }

  // Parse + validate
  let parsed: Record<string, unknown>
  try {
    const obj = extractJsonObject(responseText)
    if (!obj || typeof obj !== 'object') {
      throw new Error('LLM 回傳不是 JSON 物件')
    }
    parsed = obj as Record<string, unknown>
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 回傳格式錯誤：${msg}`)
  }

  // detected_idol_slug — must be in known_idols
  const rawSlug = parsed.detected_idol_slug
  const slugSet = new Set(input.knownIdols.map((i) => i.slug))
  const detected_idol_slug =
    typeof rawSlug === 'string' && slugSet.has(rawSlug) ? rawSlug : null
  const detected_idol_id =
    detected_idol_slug != null
      ? (input.knownIdols.find((i) => i.slug === detected_idol_slug)?.id ?? null)
      : null

  // detected_event_type
  const detected_event_type = isEventType(parsed.detected_event_type)
    ? parsed.detected_event_type
    : null

  // detected_date
  const detected_date = isIsoDate(parsed.detected_date)
    ? (parsed.detected_date as string)
    : null

  // source_name
  const source_name =
    typeof parsed.source_name === 'string' && parsed.source_name.trim().length > 0
      ? parsed.source_name.trim()
      : null

  // source_type
  const source_type = isSourceType(parsed.source_type)
    ? parsed.source_type
    : null

  // confidence
  const confidence = clampConfidence(parsed.confidence)

  // reason
  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
      ? parsed.reason.trim().slice(0, 1000)
      : ''

  return {
    detected_idol_slug,
    detected_idol_id,
    detected_event_type,
    detected_date,
    source_name,
    source_type,
    confidence,
    reason,
    model,
  }
}
