'use client'

import { useRef } from 'react'
import { TICKET_PLATFORMS } from '@/lib/ticketPlatforms'
import { ELIGIBILITY_LABELS, STAGE_LABELS, TICKET_SALE_ELIGIBILITIES, TICKET_SALE_STAGES, TICKET_SALE_VERIFICATIONS, VERIFICATION_LABELS } from '@/lib/ticketSales'
import { emptyTicketSaleFormRow, ticketSaleRowWarning, type TicketSaleFormRow } from '@/lib/admin/ticketSalesForm'
import { REGIONS } from '@/lib/regions'

export type EditorRow = TicketSaleFormRow & { key: string }

const inputCls =
  'w-full rounded-xl border border-card-border bg-bg px-3 py-2.5 text-sm text-text-base placeholder:text-muted/40 focus:outline-none focus:border-violet-500/60 transition-colors'
const selectCls = inputCls + ' cursor-pointer'

export function withKeys(rows: TicketSaleFormRow[]): EditorRow[] {
  return rows.map((row, i) => ({ ...row, key: row.id ?? `sale-${i}` }))
}

export function stripKeys(rows: EditorRow[]): TicketSaleFormRow[] {
  return rows.map((row) => {
    const copy: Partial<EditorRow> = { ...row }
    delete copy.key
    return copy as TicketSaleFormRow
  })
}

/** T35：國家代碼下拉（其他＝NULL，保留手填的國家文字）。 */
export function CountryCodeSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} aria-label="國家代碼">
      {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.flag} {r.code} {r.name}</option>)}
      <option value="">其他（不設代碼）</option>
    </select>
  )
}

export const TIME_STATUS_OPTIONS = [
  { value: 'unknown', label: '尚未查到（時間未定）' },
  { value: 'announced', label: '已公布' },
  { value: 'tba', label: '官方尚未公布' },
] as const

export function TimeStatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} aria-label="時間狀態">
      {TIME_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/** T35：售票階段編輯器（新增／刪除／上下移）。上下移只影響畫面；前台依開賣時間排序。 */
export default function TicketSalesEditor({ rows, onChange }: { rows: EditorRow[]; onChange: (rows: EditorRow[]) => void }) {
  const nextKey = useRef(rows.length)
  const update = (key: string, patch: Partial<TicketSaleFormRow>) => onChange(rows.map((r) => r.key === key ? { ...r, ...patch } : r))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const copy = [...rows]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    onChange(copy)
  }
  const duplicateKeys = new Set(rows.map((r) => `${r.stage}\u0000${r.label.trim()}`).filter((k, i, all) => k.split('\u0000')[1] && all.indexOf(k) !== i))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] text-muted/60 leading-snug -mt-1">
        時間一律以<strong>台北時間</strong>輸入。上下移只影響這裡的順序，前台依開賣時間排序。購票連結若不在已知官方平台，仍可存檔但會紅字警示。
      </p>
      {rows.map((row, i) => {
        const warning = ticketSaleRowWarning(row)
        const duplicate = duplicateKeys.has(`${row.stage}\u0000${row.label.trim()}`)
        return (
          <div key={row.key} className="flex flex-col gap-3 rounded-xl border border-card-border p-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted">售票階段 {i + 1}</p>
              <div className="ml-auto flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg px-2 py-1 text-xs text-muted disabled:opacity-40" aria-label={`上移售票階段 ${i + 1}`}>↑</button>
                <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded-lg px-2 py-1 text-xs text-muted disabled:opacity-40" aria-label={`下移售票階段 ${i + 1}`}>↓</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="階段" required>
                <select value={row.stage} onChange={(e) => update(row.key, { stage: e.target.value })} className={selectCls}>
                  {TICKET_SALE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </Field>
              <Field label="名稱" required>
                <input type="text" required value={row.label} onChange={(e) => update(row.key, { label: e.target.value })} placeholder="例：My Day 會員預購" className={inputCls} />
              </Field>
            </div>
            {duplicate && <p className="text-xs font-semibold text-red-400">同一活動不可有相同的「階段＋名稱」</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始（台北時間）">
                <input type="datetime-local" value={row.startsAt} onChange={(e) => update(row.key, { startsAt: e.target.value })} className={inputCls} />
              </Field>
              <Field label="結束（台北時間）">
                <input type="datetime-local" value={row.endsAt} onChange={(e) => update(row.key, { endsAt: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="平台">
                <select value={row.platform} onChange={(e) => update(row.key, { platform: e.target.value })} className={selectCls}>
                  <option value="">（不選）</option>
                  {TICKET_PLATFORMS.map((p) => <option key={p.code} value={p.code}>{p.name}{p.verified ? '' : '（未驗證）'}</option>)}
                  <option value="other">其他</option>
                </select>
              </Field>
              <Field label="資格" required>
                <select value={row.eligibility} onChange={(e) => update(row.key, { eligibility: e.target.value })} className={selectCls}>
                  {TICKET_SALE_ELIGIBILITIES.map((v) => <option key={v} value={v}>{ELIGIBILITY_LABELS[v]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="購票連結">
              <input type="url" value={row.url} onChange={(e) => update(row.key, { url: e.target.value })} placeholder="https://…" className={inputCls} />
            </Field>
            {warning && <p className="text-xs font-semibold text-red-400">⚠ {warning}（仍可存檔，前台會在連結旁標示）</p>}
            <Field label="資格說明">
              <input type="text" value={row.eligibilityNote} onChange={(e) => update(row.key, { eligibilityNote: e.target.value })} placeholder="例：須先在 FANS 完成預購登記" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="購票前置步驟（來源明講才填）">
                <select value={row.requiresVerification} onChange={(e) => update(row.key, { requiresVerification: e.target.value })} className={selectCls}>
                  <option value="">（無／未明講）</option>
                  {TICKET_SALE_VERIFICATIONS.map((v) => <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>)}
                </select>
              </Field>
              <Field label="資訊出處 URL">
                <input type="url" value={row.sourceUrl} onChange={(e) => update(row.key, { sourceUrl: e.target.value })} placeholder="https://…" className={inputCls} />
              </Field>
            </div>
            <button type="button" onClick={() => onChange(rows.filter((r) => r.key !== row.key))} className="self-start text-xs text-red-400">刪除此售票階段</button>
          </div>
        )
      })}
      <button type="button" className="self-start text-xs text-violet-500" onClick={() => {
        onChange([...rows, { ...emptyTicketSaleFormRow(), key: `new-sale-${nextKey.current++}` }])
      }}>＋ 新增售票階段</button>
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
