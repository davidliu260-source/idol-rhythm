import type { ReactNode } from 'react'
import type { Event } from '@/lib/types'
import { CalendarDays, MapPin, Ticket, ExternalLink } from 'lucide-react'
import { getCategoryTokens, getEventCategory } from '@/lib/eventCategory'
import { getInfoDateRow, getVenueRow, getTicketRow } from '@/lib/eventDetailHero'

export default function EventDetailInfoRows({ event }: { event: Event }) {
  const tokens = getCategoryTokens(getEventCategory(event))
  const date = getInfoDateRow(event)
  const venue = getVenueRow(event)
  const ticket = getTicketRow(event.ticketUrl)
  const rowClass = 'flex items-center gap-4 border-b border-white/[0.07] py-[18px]'
  function content(icon: ReactNode, label: string, main: string, sub: string | null, unavailable = false) {
    return <>
      <span aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-[14px]"
        style={{ background: tokens.infoIconBackground, boxShadow: `inset 0 0 0 1px ${tokens.infoIconBorder}`, color: tokens.accent }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-[#8a87a0]">{label}</p>
        <p className={`mt-px break-words text-[17px] font-extrabold leading-[1.35] ${unavailable ? 'text-white/60' : 'text-[#f6f4fb]'}`}>{main}</p>
        {sub && <p className="mt-px text-[13.5px] font-medium text-[#a09db4]">{sub}</p>}
      </div>
    </>
  }
  const ticketContent = content(<Ticket className="h-[22px] w-[22px]" strokeWidth={1.8} />, '售票', ticket.main, ticket.sub, !ticket.href)
  return <section aria-label="活動資訊" className="flex flex-col">
    <div className={rowClass}>{content(<CalendarDays className="h-[22px] w-[22px]" strokeWidth={1.8} />, date.key, date.main, date.sub)}</div>
    {venue && <div className={rowClass}>{content(<MapPin className="h-[22px] w-[22px]" strokeWidth={1.8} />, '地點', venue.main, venue.sub)}</div>}
    {ticket.href ? <a href={ticket.href} target="_blank" rel="noopener noreferrer" aria-label="官方售票：以官方連結為準（另開新分頁）"
      className={`${rowClass} hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>
      {ticketContent}<ExternalLink aria-hidden="true" className="ml-auto h-4 w-4 flex-none text-white/40" />
    </a> : <div className={rowClass}>{ticketContent}</div>}
  </section>
}
