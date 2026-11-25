import { Ticket } from 'lucide-react'
import { nextTicketSaleBadge } from '@/lib/ticketSales'

/** T35：卡片上的「11/28 12:00 開賣」徽章（台北時間）。沒有未來的開賣時間就不渲染。 */
export default function TicketSaleBadge({ startsAt, className = '' }: { startsAt?: readonly string[]; className?: string }) {
  const label = nextTicketSaleBadge(startsAt)
  if (!label) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ${className}`}>
      <Ticket aria-hidden="true" className="h-3 w-3" />
      {label}
    </span>
  )
}
