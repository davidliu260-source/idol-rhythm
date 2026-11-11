import Anthropic from '@anthropic-ai/sdk'
import { resolveAnthropicModel } from './parseCandidate'

export interface ChineseDisplayInput {
  title: string
  content?: string | null
  idolName?: string | null
  eventType?: string | null
  eventSubType?: string | null
  dateText?: string | null
  locationText?: string | null
  sourceName?: string | null
  sourceType?: string | null
}

export interface GeneratedChineseDisplay {
  displayTitleZh: string | null
  displaySummaryZh: string | null
  locationNameZh: string | null
  notes: string
  model: string
}

const TITLE_MAX = 80
const SUMMARY_MAX = 280
const LOCATION_MAX = 80
const NOTES_MAX = 200
const INPUT_MAX = 12_000

function trimToNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenceMatch ? fenceMatch[1] : trimmed
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('LLM 回傳格式錯誤：找不到 JSON 物件')
  }
  return JSON.parse(body.slice(firstBrace, lastBrace + 1))
}

function buildSystemPrompt(): string {
  return [
    'You generate public-facing Traditional Chinese display copy for K-pop / idol events.',
    'Your output MUST be one JSON object only. No markdown, no commentary, no code fences.',
    '',
    'Output schema:',
    '{',
    '  "display_title_zh": string | null,',
    '  "display_summary_zh": string | null,',
    '  "location_name_zh": string | null,',
    '  "notes": string',
    '}',
    '',
    'Rules:',
    '- Use Traditional Chinese.',
    '- Keep artist names, official tour names, venue names, and branded event names readable.',
    '- Do not invent dates, venues, cities, countries, prices, ticket links, or source credibility.',
    '- Do not translate URLs.',
    '- If the source is too thin, return null for uncertain fields instead of guessing.',
    '- display_title_zh should be short enough for an event card.',
    '- display_summary_zh should be a concise public-facing summary, not raw scraper/debug text.',
    '- location_name_zh should only be filled when the source clearly contains a user-facing place name.',
    '- Never output IDs, publish status, trust level, or active/inactive decisions.',
  ].join('\n')
}

function buildUserPrompt(input: ChineseDisplayInput): string {
  return [
    'event_input:',
    JSON.stringify({
      title: input.title,
      content: input.content ?? null,
      idolName: input.idolName ?? null,
      eventType: input.eventType ?? null,
      eventSubType: input.eventSubType ?? null,
      dateText: input.dateText ?? null,
      locationText: input.locationText ?? null,
      sourceName: input.sourceName ?? null,
      sourceType: input.sourceType ?? null,
    }, null, 2),
    '',
    'Return the JSON object now.',
  ].join('\n')
}

export async function generateChineseDisplayWithClaude(
  input: ChineseDisplayInput,
): Promise<GeneratedChineseDisplay> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未設定（請至 Vercel env vars 補上）')
  }

  if (!input.title.trim()) {
    throw new Error('缺少原始標題，無法產生繁中顯示文案')
  }

  const prompt = buildUserPrompt(input)
  if (prompt.length > INPUT_MAX) {
    throw new Error(`輸入內容過長（上限 ${INPUT_MAX} 字，目前 ${prompt.length}）`)
  }

  const model = resolveAnthropicModel()
  const client = new Anthropic({ apiKey })

  let responseText: string
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 800,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    })
    const textBlock = resp.content.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('LLM 沒有回傳文字內容')
    }
    responseText = textBlock.text
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AI 呼叫失敗：${msg}`)
  }

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

  const displayTitleZh = trimToNull(parsed.display_title_zh, TITLE_MAX)
  const displaySummaryZh = trimToNull(parsed.display_summary_zh, SUMMARY_MAX)
  const locationNameZh = trimToNull(parsed.location_name_zh, LOCATION_MAX)
  const notes = trimToNull(parsed.notes, NOTES_MAX) ?? ''

  if (!displayTitleZh && !displaySummaryZh && !locationNameZh) {
    throw new Error('AI 未產生可寫入的繁中欄位')
  }

  return {
    displayTitleZh,
    displaySummaryZh,
    locationNameZh,
    notes,
    model,
  }
}
