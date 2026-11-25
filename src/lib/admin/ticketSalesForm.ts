/**
 * T35 A-4：後台售票階段編輯器的驗證與轉換（純函式，前後端共用）。
 * - 時間以台北時間輸入（datetime-local），存成 +08:00 的 timestamptz。
 * - url 必須是 http(s)；網域不在平台表時「不擋存檔」，只回傳警示。
 * - 同一活動 (stage, label) 不可重複（對應 DB UNIQUE (event_id, stage, label)）。
 * - schema 沒有排序欄位：編輯器的上下移只影響畫面，前台一律依 starts_at 排序。
 */
import { isHttpUrl, unknownTicketPlatformWarning } from '../ticketPlatforms'
import {
  TICKET_SALE_ELIGIBILITIES, TICKET_SALE_STAGES, TICKET_SALE_VERIFICATIONS,
  isoToTaipeiLocal, taipeiLocalToIso,
  type TicketSaleEligibility, type TicketSaleStage, type TicketSaleVerification,
} from '../ticketSales'

export interface TicketSaleFormRow {
  /** 既有列的 id；新增列為 null。 */
  id: string | null
  stage: string
  label: string
  /** datetime-local（台北時間），可空白 */
  startsAt: string
  endsAt: string
  platform: string
  url: string
  eligibility: string
  eligibilityNote: string
  requiresVerification: string
  sourceUrl: string
}

export interface TicketSaleWrite {
  stage: TicketSaleStage
  label: string
  starts_at: string | null
  ends_at: string | null
  platform: string | null
  url: string | null
  eligibility: TicketSaleEligibility
  eligibility_note: string | null
  requires_verification: TicketSaleVerification | null
  source_url: string | null
}

export const emptyTicketSaleFormRow = (): TicketSaleFormRow => ({
  id: null, stage: 'general', label: '', startsAt: '', endsAt: '', platform: '', url: '',
  eligibility: 'public', eligibilityNote: '', requiresVerification: '', sourceUrl: '',
})

export function ticketSaleRowToForm(row: {
  id: string; stage: string; label: string; starts_at: string | null; ends_at: string | null
  platform: string | null; url: string | null; eligibility: string; eligibility_note: string | null
  requires_verification: string | null; source_url: string | null
}): TicketSaleFormRow {
  return {
    id: row.id, stage: row.stage, label: row.label,
    startsAt: isoToTaipeiLocal(row.starts_at), endsAt: isoToTaipeiLocal(row.ends_at),
    platform: row.platform ?? '', url: row.url ?? '', eligibility: row.eligibility,
    eligibilityNote: row.eligibility_note ?? '', requiresVerification: row.requires_verification ?? '',
    sourceUrl: row.source_url ?? '',
  }
}

/** 表單紅字警示（不擋存檔）：購票連結不在已知官方平台。 */
export function ticketSaleRowWarning(row: Pick<TicketSaleFormRow, 'url'>): string | null {
  const url = row.url.trim()
  return url && isHttpUrl(url) ? unknownTicketPlatformWarning(url) : null
}

const has = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v)

export type TicketSalesValidation =
  | { ok: true; rows: Array<TicketSaleWrite & { id: string | null }> }
  | { ok: false; error: string }

export function validateTicketSaleRows(rows: readonly TicketSaleFormRow[]): TicketSalesValidation {
  const out: Array<TicketSaleWrite & { id: string | null }> = []
  const keys = new Set<string>()
  for (const [i, row] of rows.entries()) {
    const n = `售票階段 ${i + 1}`
    const label = row.label.trim()
    if (!has(TICKET_SALE_STAGES, row.stage)) return { ok: false, error: `${n}：階段不正確` }
    if (!label) return { ok: false, error: `${n}：名稱不可空白` }
    const key = `${row.stage}\u0000${label}`
    if (keys.has(key)) return { ok: false, error: `${n}：同一活動不可有相同的「階段＋名稱」（${label}）` }
    keys.add(key)
    if (!has(TICKET_SALE_ELIGIBILITIES, row.eligibility)) return { ok: false, error: `${n}：資格不正確` }
    const verification = row.requiresVerification.trim()
    if (verification && !has(TICKET_SALE_VERIFICATIONS, verification)) return { ok: false, error: `${n}：購票前置步驟不正確` }
    const startsAt = taipeiLocalToIso(row.startsAt)
    const endsAt = taipeiLocalToIso(row.endsAt)
    if (startsAt === undefined) return { ok: false, error: `${n}：開始時間格式不正確` }
    if (endsAt === undefined) return { ok: false, error: `${n}：結束時間格式不正確` }
    if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) return { ok: false, error: `${n}：結束時間不可早於開始時間` }
    const url = row.url.trim()
    if (url && !isHttpUrl(url)) return { ok: false, error: `${n}：購票連結必須是 http(s) 網址` }
    const sourceUrl = row.sourceUrl.trim()
    if (sourceUrl && !isHttpUrl(sourceUrl)) return { ok: false, error: `${n}：資訊出處必須是 http(s) 網址` }
    out.push({
      id: row.id,
      stage: row.stage,
      label,
      starts_at: startsAt,
      ends_at: endsAt,
      platform: row.platform.trim().toLowerCase() || null,
      url: url || null,
      eligibility: row.eligibility,
      eligibility_note: row.eligibilityNote.trim() || null,
      requires_verification: verification ? verification as TicketSaleVerification : null,
      source_url: sourceUrl || null,
    })
  }
  return { ok: true, rows: out }
}

/** 去掉表單用的 id（新增列寫入 DB 時由 DB 產生）。 */
export function withoutId(row: TicketSaleWrite & { id: string | null }): TicketSaleWrite {
  const copy: Partial<TicketSaleWrite & { id: string | null }> = { ...row }
  delete copy.id
  return copy as TicketSaleWrite
}

/** 存檔計畫：先刪掉被移除的列，再更新既有列，最後新增（減少唯一鍵暫時衝突）。 */
export function planTicketSaleChanges(existingIds: readonly string[], rows: ReadonlyArray<TicketSaleWrite & { id: string | null }>) {
  const kept = new Set(rows.flatMap(r => r.id ? [r.id] : []))
  const unknown = rows.find(r => r.id && !existingIds.includes(r.id))
  if (unknown) return { ok: false as const, error: '售票階段已被其他人修改，請重新整理頁面後再編輯' }
  return {
    ok: true as const,
    deleteIds: existingIds.filter(id => !kept.has(id)),
    updates: rows.filter((r): r is TicketSaleWrite & { id: string } => !!r.id),
    inserts: rows.filter(r => !r.id).map(withoutId),
  }
}
