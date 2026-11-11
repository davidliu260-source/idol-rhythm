'use client'

import {
  Clapperboard,
  Disc3,
  Images,
  Megaphone,
  Music,
  PenLine,
  ShoppingBag,
  Store,
  Ticket,
  Tv,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  type EventType,
  type EventSubType,
} from '@/lib/mockEvents'
import clsx from 'clsx'

interface EventTypeBadgeProps {
  type: EventType | string
  subType?: EventSubType | string | null
  size?: 'sm' | 'md'
  className?: string
}

const EVENT_ICON_MAP: Record<string, LucideIcon> = {
  concert: Music,
  fanmeet: Users,
  fansign: PenLine,
  musicshow: Tv,
  variety: Clapperboard,
  interview: Tv,
  award: Music,
  ticketing: Ticket,
  livestream: Video,
  streaming: Video,
  media: Tv,
  magazine: Images,
  brand: ShoppingBag,
  popup_store: Store,
  exhibition: Images,
  brand_event: ShoppingBag,
  release: Disc3,
  official: Megaphone,
  announcement: Megaphone,
}

function getEventTypeLabel(type: string, subType?: string | null): string {
  if (subType && subType in EVENT_SUBTYPE_LABELS) {
    return EVENT_SUBTYPE_LABELS[subType as EventSubType]
  }
  if (type in EVENT_TYPE_LABELS) {
    return EVENT_TYPE_LABELS[type as EventType]
  }
  return subType || type
}

export default function EventTypeBadge({
  type,
  subType,
  size = 'sm',
  className,
}: EventTypeBadgeProps) {
  const label = getEventTypeLabel(type, subType)
  const Icon = EVENT_ICON_MAP[subType || type] ?? Megaphone
  const colorClass =
    type in EVENT_TYPE_COLORS
      ? EVENT_TYPE_COLORS[type as EventType]
      : 'bg-card border-card-border text-muted'

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 font-medium',
        colorClass,
        size === 'sm' ? 'py-0.5 text-xs' : 'py-1 text-sm',
        className,
      )}
    >
      <Icon className={clsx('flex-shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {label}
    </span>
  )
}
