import { WISH_TLDS } from './fanWishes'
export { classifyWantRpcError as classifyReportRpcError } from './eventWants'

export const ERROR_REPORT_REASONS = {
  date: '日期有誤',
  time: '時間有誤',
  venue: '地點或場地有誤',
  ticket: '售票資訊有誤',
  source: '資訊來源有誤',
  cancelled: '活動已取消或延期',
  other: '其他',
} as const

export type ErrorReportReason = keyof typeof ERROR_REPORT_REASONS
export const NOTE_MAX = 200

const forbiddenCharacters = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/
const forbiddenNote = new RegExp(`(://|www\\.|https?:|@|<|>|\\.(${WISH_TLDS})([/?# ]|$))`, 'i')

export function validateNoteClient(raw: string | null | undefined): { ok: true; note: string | null } | { ok: false } {
  if (raw == null) return { ok: true, note: null }
  const singleLine = raw.replace(/[\r\n\t]+/g, ' ')
  if (Array.from(raw).length > 400 || forbiddenCharacters.test(singleLine)) return { ok: false }

  const note = singleLine.normalize('NFKC').replace(/[ \u1680]+/g, ' ').trim()
  if (Array.from(note).length > NOTE_MAX || forbiddenNote.test(note)) return { ok: false }
  return { ok: true, note: note || null }
}

export type ReportResult = { kind: 'ok' | 'duplicate' | 'rate_limited' | 'invalid' | 'gone' }

export function resolveReportResult(row: { status_code?: unknown } | null | undefined): ReportResult {
  const kind = row?.status_code
  if (kind === 'ok' || kind === 'duplicate' || kind === 'rate_limited' || kind === 'invalid') return { kind }
  return { kind: 'gone' }
}
