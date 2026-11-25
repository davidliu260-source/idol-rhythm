import { ExternalLink, ShieldAlert, Ticket } from 'lucide-react'
import { TICKET_SAFETY_NOTICE, TICKET_SAFETY_TITLE } from '@/lib/ticketSafetyCopy'
import { hasTicketInfo, platformPrerequisites, toTicketSaleView, type TicketSale, type TicketSaleStatus } from '@/lib/ticketSales'
import { unknownTicketPlatformWarning } from '@/lib/ticketPlatforms'

const STATUS_CLASS: Record<TicketSaleStatus, string> = {
  upcoming: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  open: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
  started: 'border-sky-300/25 bg-sky-300/10 text-sky-100',
  ended: 'border-white/10 bg-white/[0.04] text-white/55',
  unknown: 'border-white/10 bg-white/[0.04] text-white/65',
}

/**
 * T35 A-3：「票務 & 購票」售票階段列表＋前置提醒＋防詐提醒。
 * 沒有售票階段時只顯示提醒（單一購票連結仍由既有的售票列與按鈕負責，回歸不變）。
 * 沒有任何票務資訊時整塊不顯示。
 */
export default function EventTicketSales({ sales, ticketUrl, now = new Date() }: { sales: TicketSale[]; ticketUrl?: string; now?: Date }) {
  if (!hasTicketInfo(sales, ticketUrl)) return null
  const views = sales.map((sale) => toTicketSaleView(sale, now))
  const prerequisites = platformPrerequisites(sales, ticketUrl)
  const ticketUrlWarning = sales.length === 0 ? unknownTicketPlatformWarning(ticketUrl) : null

  return (
    <section aria-labelledby="ticket-sales-heading" className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <Ticket aria-hidden="true" className="h-4 w-4 text-[#b6a9ff]" />
          <h2 id="ticket-sales-heading" className="text-sm font-semibold text-white">票務 & 購票</h2>
        </div>
        {views.length > 0 && <span className="text-[11px] font-medium text-white/65">時間皆為台北時間</span>}
      </div>

      {views.length > 0 && (
        <ol className="flex flex-col gap-2.5">
          {views.map((v) => (
            <li key={v.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-[#b6a9ff]/30 bg-[#b6a9ff]/10 px-2 py-0.5 text-[11px] font-semibold text-[#d9d2ff]">{v.stageLabel}</span>
                {v.platformName && <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/80">{v.platformName}</span>}
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/80">{v.eligibilityLabel}</span>
                <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[v.status.status]}`}>{v.status.label}</span>
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-white">{v.label}</p>
              <p className="mt-0.5 text-xs text-white/75">
                {v.timeLabel ? <>{v.timeLabel}{v.endLabel ? ` ～ ${v.endLabel}` : ''}<span className="text-white/55">（台北時間）</span></> : '開賣時間未公布'}
              </p>
              {(v.eligibilityNote || v.verificationLabel) && (
                <p className="mt-1 text-xs leading-5 text-white/65">{[v.verificationLabel, v.eligibilityNote].filter(Boolean).join('・')}</p>
              )}
              {v.href && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={v.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/85 hover:bg-white/[0.09]">
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    前往連結
                  </a>
                  {v.unknownPlatformWarning && <span className="text-[11px] font-semibold text-red-300">{v.unknownPlatformWarning}</span>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {ticketUrlWarning && <p className="text-xs font-semibold text-red-300">購票連結：{ticketUrlWarning}</p>}

      {prerequisites.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {prerequisites.map((p) => (
            <li key={p.code} className="text-xs leading-5 text-white/75"><span className="font-semibold text-white/85">{p.name}：</span>{p.prerequisite}</li>
          ))}
        </ul>
      )}

      <div role="note" className="mt-3 flex gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2.5">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-amber-200" />
        <p className="text-xs leading-5 text-amber-100"><span className="font-semibold">{TICKET_SAFETY_TITLE}：</span>{TICKET_SAFETY_NOTICE}</p>
      </div>
    </section>
  )
}
