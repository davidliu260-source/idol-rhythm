import { taipeiToday } from '../taipeiDate'
import type { ChineseDisplayInput, GeneratedChineseDisplay } from './generateChineseDisplay'
import { findOfficialNoticeUrl } from '../officialNotice'

export const AUTO_TRANSLATE_ENABLED = true
export const AUTO_TRANSLATE_MAX_PER_RUN = 100
export const AUTO_TRANSLATE_TIME_BUDGET_MS = 240_000
export const AUTO_TRANSLATE_MAX_ATTEMPTS = 3
export const TRANSLATION_CLAIM_MS = 10 * 60_000
export const BACKFILL_BATCH_SIZE = 25
export const BACKFILL_BATCH_MAX = 50
export const TRANSLATION_COST_USD = { typical: 0.0015, conservative: 0.0021, upper: 0.0046 }

type ChineseFields = {
  display_title_zh: string | null
  display_summary_zh: string | null
  location_name_zh: string | null
}

type EventSource = { label: string | null; type: string | null; url?: string | null }

export type TranslationEvent = ChineseFields & {
  title: string
  description: string | null
  idol_name: string | null
  type: string | null
  sub_type: string | null
  date: string
  date_label: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  city: string | null
  venue_name: string | null
  address: string | null
  is_published: boolean
  translation_status: string
  translation_attempts: number
  translation_attempted_at: string | null
  translation_last_error: string | null
  event_sources: EventSource[] | null
}

type SuccessPatch = ChineseFields & {
  translation_status: 'machine'
  translation_source: 'ai'
  translation_updated_at: string
  translation_last_error: null
}

export interface TranslationStore {
  getEvent(id: string): Promise<TranslationEvent | null>
  claim(id: string, at: string, requirePublished: boolean, attempts: number): Promise<boolean>
  writeSuccess(id: string, at: string, patch: SuccessPatch): Promise<boolean>
  writeFailure(id: string, at: string, attempts: number, error: string): Promise<boolean>
  resetAttempts(id: string, at: string): Promise<boolean>
  restoreClaim(id: string, at: string, event: TranslationEvent): Promise<void>
}

export interface PublishedTranslationStore extends TranslationStore {
  markDeferred(ids: readonly string[], reason: NonNullable<TranslationSummary['stoppedBy']>): Promise<void>
  listPendingForCron(now: Date, limit: number, excluded: ReadonlySet<string>): Promise<string[]>
  listBackfillCandidates(now: Date, limit: number): Promise<string[]>
  countBackfill(now: Date): Promise<{ eligible: number; exhausted: number }>
  hasBatchInProgress(now: Date): Promise<boolean>
}

export type TranslationDeps<S extends TranslationStore = TranslationStore> = {
  store: S
  translator: (input: ChineseDisplayInput) => Promise<Pick<GeneratedChineseDisplay, 'displayTitleZh' | 'displaySummaryZh' | 'locationNameZh'>>
  clock: () => number
}

export class TranslatorConfigError extends Error {}
export class TranslatorApiError extends Error {}

export function hasChineseDisplay(event: ChineseFields): boolean {
  return Boolean(event.display_title_zh?.trim() || event.display_summary_zh?.trim() || event.location_name_zh?.trim())
}

export function isTranslatable(event: ChineseFields & { title: string; translation_status: string }): boolean {
  return event.translation_status !== 'manual' && event.translation_status !== 'reviewed' &&
    !hasChineseDisplay(event) && Boolean(event.title.trim())
}

export function isUnfinished(event: Pick<TranslationEvent, 'end_date' | 'start_date' | 'date'>, now: Date): boolean {
  return (event.end_date ?? event.start_date ?? event.date) >= taipeiToday(now)
}

/** MUST #10：活動任一來源是 YG／SMTOWN 公告頁，就只翻名稱與地點，不送正文、不寫摘要。 */
export function isFactsOnlyNoticeEvent(event: Pick<TranslationEvent, 'event_sources'>): boolean {
  return !!findOfficialNoticeUrl(event.event_sources)
}

export function buildChineseDisplayInput(event: TranslationEvent, sources: EventSource[]): ChineseDisplayInput {
  return {
    title: event.title,
    content: isFactsOnlyNoticeEvent({ event_sources: sources }) ? null : event.description,
    idolName: event.idol_name,
    eventType: event.type,
    eventSubType: event.sub_type,
    dateText: event.date_label || [event.start_date, event.end_date].filter(Boolean).join(' - ') || event.date,
    locationText: [event.location, event.city, event.venue_name, event.address].filter(Boolean).join(' / '),
    sourceName: sources[0]?.label ?? null,
    sourceType: sources[0]?.type ?? null,
  }
}

type TranslationResult =
  | { outcome: 'translated' }
  | { outcome: 'skipped'; reason: string; message?: string }
  | { outcome: 'failed'; reason: string; message: string }

export function translationErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/sk-ant-[\w-]+/gi, '[redacted]').slice(0, 200)
    : '翻譯發生未知錯誤'
}

function chineseFields(generated: Awaited<ReturnType<TranslationDeps['translator']>>, factsOnlyNotice: boolean): ChineseFields {
  if (!generated || ![generated.displayTitleZh, generated.displaySummaryZh, generated.locationNameZh]
    .every(value => value === null || typeof value === 'string')) {
    throw new Error('AI 回傳格式錯誤')
  }
  const fields = {
    display_title_zh: generated.displayTitleZh?.trim() || null,
    display_summary_zh: factsOnlyNotice ? null : generated.displaySummaryZh?.trim() || null,
    location_name_zh: generated.locationNameZh?.trim() || null,
  }
  if (!hasChineseDisplay(fields)) throw new Error('AI 未產生可寫入的繁中欄位')
  return fields
}

export async function translateEvent(
  { store, translator, clock }: TranslationDeps,
  id: string,
  { resetAttempts = false, requirePublished = false }: { resetAttempts?: boolean; requirePublished?: boolean } = {},
): Promise<TranslationResult> {
  let step = 'get_event'
  try {
    const event = await store.getEvent(id)
    if (!event) return { outcome: 'skipped', reason: 'not_found', message: '找不到活動' }
    if (!isTranslatable(event)) {
      if (event.translation_status === 'manual' || event.translation_status === 'reviewed') {
        return { outcome: 'skipped', reason: 'protected', message: '此活動的中文欄位已是人工編輯或已審閱狀態，為避免覆蓋不自動產生' }
      }
      if (hasChineseDisplay(event)) {
        return { outcome: 'skipped', reason: 'has_chinese', message: '此活動已有中文顯示欄位，第一版不支援覆蓋既有內容' }
      }
      return { outcome: 'skipped', reason: 'missing_title', message: '缺少原始標題，無法產生繁中顯示文案' }
    }
    if (requirePublished && !event.is_published) return { outcome: 'skipped', reason: 'unpublished' }
    if (!resetAttempts && event.translation_attempts >= AUTO_TRANSLATE_MAX_ATTEMPTS) {
      return { outcome: 'skipped', reason: 'attempts_exhausted' }
    }

    step = 'claim'
    const at = new Date(clock()).toISOString()
    if (!await store.claim(id, at, requirePublished, event.translation_attempts)) return { outcome: 'skipped', reason: 'claimed_or_changed' }
    if (resetAttempts) {
      step = 'reset_attempts'
      if (!await store.resetAttempts(id, at)) return { outcome: 'skipped', reason: 'state_changed' }
    }

    let fields: ChineseFields
    try {
      fields = chineseFields(await translator(buildChineseDisplayInput(event, event.event_sources ?? [])), isFactsOnlyNoticeEvent(event))
    } catch (error) {
      if (error instanceof TranslatorConfigError) {
        try {
          await store.restoreClaim(id, at, event)
        } catch (restoreError) {
          throw new TranslatorConfigError(`${error.message}（還原翻譯認領失敗：${translationErrorMessage(restoreError)}）`)
        }
        throw error
      }
      const message = translationErrorMessage(error)
      step = 'write_failure'
      await store.writeFailure(id, at, (resetAttempts ? 0 : event.translation_attempts) + 1, message)
      return { outcome: 'failed', reason: error instanceof TranslatorApiError ? 'api' : 'translator', message }
    }

    step = 'write_success'
    const updated = await store.writeSuccess(id, at, {
      ...fields,
      translation_status: 'machine',
      translation_source: 'ai',
      translation_updated_at: new Date(clock()).toISOString(),
      translation_last_error: null,
    })
    return updated ? { outcome: 'translated' } : { outcome: 'skipped', reason: 'state_changed' }
  } catch (error) {
    if (error instanceof TranslatorConfigError) throw error
    return { outcome: 'failed', reason: step, message: translationErrorMessage(error) }
  }
}

export type TranslationSummary = {
  attempted: number
  translated: number
  skipped: number
  failed: number
  stoppedBy: null | 'limit' | 'time' | 'config' | 'api'
  failures: Array<{ eventId: string; step: string; message: string }>
  /** 本輪實際翻譯成功的活動，供公開頁立即刷新使用。 */
  translatedIds: string[]
}

export function emptyTranslationSummary(): TranslationSummary {
  return { attempted: 0, translated: 0, skipped: 0, failed: 0, stoppedBy: null, failures: [], translatedIds: [] }
}

export async function translateEvents(
  deps: TranslationDeps,
  eventIds: readonly string[],
  { maxCount, deadlineMs, now, requirePublished = false }: {
    maxCount: number
    deadlineMs: number
    now?: Date
    requirePublished?: boolean
  },
  summary = emptyTranslationSummary(),
  batch = { consecutiveApiFailures: 0 },
): Promise<TranslationSummary> {
  for (const eventId of eventIds) {
    if (summary.attempted >= maxCount) { summary.stoppedBy = 'limit'; break }
    if (Math.max(now?.getTime() ?? -Infinity, deps.clock()) >= deadlineMs) { summary.stoppedBy = 'time'; break }

    summary.attempted++
    try {
      const result = await translateEvent(deps, eventId, { requirePublished })
      summary[result.outcome]++
      if (result.outcome === 'translated') summary.translatedIds.push(eventId)
      if (result.outcome === 'failed') {
        summary.failures.push({ eventId, step: result.reason, message: result.message })
      }
      batch.consecutiveApiFailures = result.outcome === 'failed' && result.reason === 'api'
        ? batch.consecutiveApiFailures + 1 : 0
      if (batch.consecutiveApiFailures >= 3) {
        summary.stoppedBy = 'api'
        break
      }
    } catch (error) {
      summary.skipped++
      summary.stoppedBy = 'config'
      summary.failures.push({ eventId, step: 'config', message: translationErrorMessage(error) })
      break
    }
  }
  return summary
}

export async function translateAfterAutoPublish(
  deps: TranslationDeps<PublishedTranslationStore>,
  publishedIds: readonly string[],
  startedAt: number,
  summary = emptyTranslationSummary(),
): Promise<TranslationSummary> {
  const ids = new Set(publishedIds)
  const options = {
    maxCount: AUTO_TRANSLATE_MAX_PER_RUN,
    deadlineMs: startedAt + AUTO_TRANSLATE_TIME_BUDGET_MS,
    now: new Date(startedAt),
    requirePublished: true,
  }
  const firstPass = [...ids]
  const batch = { consecutiveApiFailures: 0 }
  const attemptedBefore = summary.attempted
  await translateEvents(deps, firstPass, options, summary, batch)
  if (summary.stoppedBy) {
    // A config error restores the claim, so that event also needs to be queued again.
    const processed = summary.attempted - attemptedBefore - (summary.stoppedBy === 'config' ? 1 : 0)
    const deferred = firstPass.slice(processed)
    if (deferred.length) await deps.store.markDeferred(deferred, summary.stoppedBy)
    return summary
  }
  if (deps.clock() >= options.deadlineMs) {
    if (summary.attempted < options.maxCount) summary.stoppedBy = 'time'
    return summary
  }
  // One extra ID lets the loop identify when the limit leaves work pending.
  const pending = await deps.store.listPendingForCron(
    new Date(deps.clock()), options.maxCount - summary.attempted + 1, ids,
  )
  return translateEvents(deps, pending, options, summary, batch)
}

function backfillSize(size: number): number {
  return Math.max(1, Math.min(BACKFILL_BATCH_MAX, Math.floor(size)))
}

export async function previewPublishedBackfill(
  store: PublishedTranslationStore,
  now: Date,
  size = BACKFILL_BATCH_SIZE,
) {
  const { eligible, exhausted } = await store.countBackfill(now)
  const batchCount = Math.min(eligible, backfillSize(size))
  return {
    eligible, exhausted, batchCount,
    estimatedTypicalUsd: batchCount * TRANSLATION_COST_USD.typical,
    estimatedConservativeUsd: batchCount * TRANSLATION_COST_USD.conservative,
  }
}

export async function runPublishedBackfill(
  deps: TranslationDeps<PublishedTranslationStore>,
  size = BACKFILL_BATCH_SIZE,
) {
  const startedAt = deps.clock()
  const now = new Date(startedAt)
  if (await deps.store.hasBatchInProgress(now)) throw new Error('已有補翻批次進行中，請稍後再試')
  const maxCount = backfillSize(size)
  const eventIds = await deps.store.listBackfillCandidates(now, maxCount)
  const summary = await translateEvents(deps, eventIds, {
    maxCount,
    deadlineMs: startedAt + AUTO_TRANSLATE_TIME_BUDGET_MS,
    now,
    requirePublished: true,
  })
  return { summary, eventIds: eventIds.slice(0, summary.attempted) }
}
